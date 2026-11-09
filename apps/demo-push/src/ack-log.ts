/**
 * 확인(ack) 로그 — 페어링 코드 하나당 Durable Object 인스턴스 하나.
 *
 * KV 를 안 쓰는 이유가 이 파일의 존재 이유다. 데스크톱이 폴링을 먼저 돌리면 KV 는 "비어 있음" 을
 * 그 colo 에 최소 60초 캐시해 버린다. 폰은 보통 다른 colo(LTE)에서 쓰기 때문에, 심사위원이 누른
 * 확인이 최대 1분 뒤에야 보인다 — 게다가 두 기기가 같은 Wi-Fi 면 재현도 안 된다.
 * DO 는 쓰기와 읽기가 같은 인스턴스를 지나므로 쓴 직후 반드시 읽힌다.
 *
 * 클래스인 건 취향이 아니라 플랫폼 계약이다 (DO 는 클래스여야 한다).
 * `cloudflare:workers` 의 DurableObject 를 상속하지 않는 것도 의도다 — 그걸 import 하면 이 파일이
 * Node 에서 안 열려서 테스트를 못 돌린다. 구식 문법(constructor + fetch)도 그대로 지원된다.
 */

export const ACK_STATES = ['confirmed', 'false_positive'] as const
export type AckState = (typeof ACK_STATES)[number]

export interface AckEntry {
  readonly eventId: string
  readonly state: AckState
  /** 서버 시계로 찍는다. 같은 코드 안에서는 반드시 증가한다 (아래 append 주석 참고). */
  readonly at: string
}

/** 심사가 길어져도 로그가 무한히 자라지 않게. 데스크톱은 최근 것만 본다. */
export const ACK_LOG_LIMIT = 50
/** KV 시절의 24시간 만료를 그대로 지킨다. DO 저장소엔 TTL 이 없어서 쓸 때마다 훑어 지운다. */
export const ACK_MAX_AGE_MS = 24 * 60 * 60 * 1000

/** Workers 런타임 타입을 설치하지 않으려고 쓰는 만큼만 선언한다. */
interface SqlCursor {
  toArray(): Record<string, unknown>[]
}

interface SqlStorage {
  exec(query: string, ...bindings: unknown[]): SqlCursor
}

export interface AckLogState {
  readonly storage: { readonly sql: SqlStorage }
}

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

const toEntry = (row: Record<string, unknown>): AckEntry => ({
  eventId: row.event_id as string,
  state: row.state as AckState,
  at: row.at as string,
})

export class AckLog {
  readonly #sql: SqlStorage

  constructor(state: AckLogState) {
    this.#sql = state.storage.sql
    // DO 는 깨어날 때마다 생성자를 다시 탄다. IF NOT EXISTS 가 그래서 필요하다
    this.#sql.exec(
      `CREATE TABLE IF NOT EXISTS acks (
         seq INTEGER PRIMARY KEY AUTOINCREMENT,
         event_id TEXT NOT NULL,
         state TEXT NOT NULL,
         at TEXT NOT NULL
       )`,
    )
  }

  /**
   * 확인 하나를 적고 그 시각을 돌려준다.
   *
   * at 을 "직전 것보다 최소 1ms 뒤" 로 강제하는 이유: 데스크톱은 마지막으로 본 at 을 since 로 되돌려
   * 주고 우리는 `at > since` 로 거른다. 같은 밀리초에 두 개가 들어오면 뒤엣것이 영영 안 보인다.
   *
   * INSERT 한 줄인 것도 의도다. 읽고-고쳐-쓰기(전체 배열을 JSON 으로 덮어쓰기)였다면 동시에 들어온
   * 확인 하나가 통째로 묻혔다.
   *
   * 이 메서드에 await 이 없는 건 지켜야 할 성질이다. SELECT 와 INSERT 사이가 끊기지 않아야
   * 두 확인이 같은 at 을 받지 않는다 — 여기에 await 을 넣으면 그 틈으로 버그가 돌아온다.
   */
  append(eventId: string, state: AckState): string {
    const [latest] = this.#sql.exec('SELECT at FROM acks ORDER BY seq DESC LIMIT 1').toArray()
    const previousMs = latest === undefined ? 0 : Date.parse(latest.at as string)
    const at = new Date(Math.max(Date.now(), previousMs + 1)).toISOString()

    this.#sql.exec('INSERT INTO acks (event_id, state, at) VALUES (?, ?, ?)', eventId, state, at)
    this.#prune()
    return at
  }

  list(since: string | null): readonly AckEntry[] {
    const sinceMs = since === null ? Number.NaN : Date.parse(since)
    // since 가 없거나 날짜로 못 읽으면 전부 준다 — 폴링을 400 으로 끊는 것보다 낫다
    const rows = Number.isNaN(sinceMs)
      ? this.#sql.exec('SELECT event_id, state, at FROM acks ORDER BY seq').toArray()
      : // 클라이언트가 준 문자열을 그대로 비교하면 형식이 달라질 수 있어 ISO 로 정규화한다.
        // 같은 형식의 UTC ISO 끼리는 문자열 비교가 곧 시간 비교다
        this.#sql
          .exec(
            'SELECT event_id, state, at FROM acks WHERE at > ? ORDER BY seq',
            new Date(sinceMs).toISOString(),
          )
          .toArray()
    return rows.map(toEntry)
  }

  #prune(): void {
    this.#sql.exec(
      'DELETE FROM acks WHERE seq NOT IN (SELECT seq FROM acks ORDER BY seq DESC LIMIT ?)',
      ACK_LOG_LIMIT,
    )
    this.#sql.exec('DELETE FROM acks WHERE at < ?', new Date(Date.now() - ACK_MAX_AGE_MS).toISOString())
  }

  /** Worker 가 스텁으로 부르는 입구. 바깥에 노출되는 경로가 아니라 내부 프로토콜이다. */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/append') {
      const { eventId, state } = (await request.json()) as { eventId: string; state: AckState }
      return json({ at: this.append(eventId, state) })
    }
    if (request.method === 'GET' && url.pathname === '/list') {
      return json({ acks: this.list(url.searchParams.get('since')) })
    }
    return json({ error: 'unknown-internal-route' }, 404)
  }
}
