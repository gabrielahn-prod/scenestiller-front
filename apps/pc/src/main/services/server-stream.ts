import type { StreamConnectionState } from '../../shared/ipc'
import type { ServerStreamMessage } from '../../shared/server-types'
import { nextDelayMs } from '../lib/backoff'
import { createSseParser } from '../lib/sse-parser'
import type { ServerSession } from './server-session'

/**
 * 매장 실시간 채널 (요구사항 4.2, 계약 6절).
 *
 * 새 위험 이벤트 → 2d 팝업, 상태 변경 → PC·모바일 동기, 카메라 상태 → 타일 갱신.
 * 이 연결이 끊긴 동안 사장님은 알림을 못 받는다. 그래서 끊김을 숨기지 않고
 * 상태로 알리고(화면의 '서버 연결 끊김' 배너), 조용히 끝없이 다시 붙는다.
 *
 * SSE 는 재생을 보장하지 않는다 — 다시 붙은 뒤 놓친 구간은 렌더러가 목록
 * 조회로 채운다 (계약 6절 마지막 줄).
 */

export interface ServerStreamDeps {
  readonly getBaseUrl: () => string
  readonly session: Pick<ServerSession, 'accessToken' | 'invalidate'>
  readonly fetch: typeof fetch
  readonly onMessage: (message: ServerStreamMessage) => void
  readonly onState: (state: StreamConnectionState) => void
  readonly delay?: (ms: number, signal: AbortSignal) => Promise<void>
  /**
   * 이 시간 동안 바이트가 하나도 안 오면 죽은 연결로 본다. 백엔드가 15초마다
   * ping 을 보내므로(backend/app/realtime.py) 세 번 놓친 셈이다.
   */
  readonly idleTimeoutMs?: number
}

export interface ServerStream {
  start(storeId: string): void
  stop(): void
}

const KNOWN_EVENTS = new Set<ServerStreamMessage['type']>([
  'ready',
  'ping',
  'event.created',
  'event.updated',
  'camera.state',
])

const DEFAULT_IDLE_TIMEOUT_MS = 45_000

const abortableDelay = (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })

type Outcome = 'retry' | 'renew' | 'forbidden' | 'aborted'

interface Attempt {
  readonly outcome: Outcome
  /** 한 번이라도 열렸는지. 열렸다면 그동안은 정상이었으니 백오프를 처음부터 센다. */
  readonly opened: boolean
}

export const createServerStream = (deps: ServerStreamDeps): ServerStream => {
  const delay = deps.delay ?? abortableDelay
  const idleTimeoutMs = deps.idleTimeoutMs ?? DEFAULT_IDLE_TIMEOUT_MS
  const state = { controller: null as AbortController | null }

  const forward = (event: string, data: string): void => {
    if (!KNOWN_EVENTS.has(event as ServerStreamMessage['type'])) return
    try {
      deps.onMessage({ type: event, data: JSON.parse(data) } as ServerStreamMessage)
    } catch {
      // 한 이벤트가 깨졌다고 스트림 전체를 끊지 않는다.
    }
  }

  /** 스트림 하나를 열고 끝날 때까지 읽는다. 끝난 이유를 돌려준다. */
  const connectOnce = async (storeId: string, token: string, outer: AbortSignal): Promise<Attempt> => {
    // 바이트가 안 오면 이 연결만 끊는다. 바깥(stop) 취소와는 구분한다.
    const connection = new AbortController()
    const handle = { reader: null as ReadableStreamDefaultReader<Uint8Array> | null }
    const abortConnection = (): void => {
      connection.abort()
      // fetch 의 abort 가 본문 스트림까지 끊어 준다는 보장이 구현체마다 없다.
      // 리더를 직접 취소해야 반쯤 열린 연결에서 read() 가 확실히 풀린다.
      void handle.reader?.cancel().catch(() => undefined)
    }
    outer.addEventListener('abort', abortConnection)
    const watchdog = { timer: null as NodeJS.Timeout | null }
    const arm = (): void => {
      if (watchdog.timer) clearTimeout(watchdog.timer)
      watchdog.timer = setTimeout(abortConnection, idleTimeoutMs)
    }

    const ended = (opened: boolean): Attempt => ({ outcome: outer.aborted ? 'aborted' : 'retry', opened })

    try {
      arm()
      const url = `${deps.getBaseUrl().replace(/\/$/, '')}/stores/${encodeURIComponent(storeId)}/stream`
      const response = await deps.fetch(url, {
        headers: { authorization: `Bearer ${token}`, accept: 'text/event-stream' },
        signal: connection.signal,
      })

      if (response.status === 401) return { outcome: 'renew', opened: false }
      // 남의 매장이거나 매장이 지워졌다. 두드려 봐야 결과는 같다.
      if (response.status === 403 || response.status === 404) return { outcome: 'forbidden', opened: false }
      if (!response.ok || !response.body) return ended(false)

      deps.onState('open')
      const reader = response.body.getReader()
      handle.reader = reader
      const decoder = new TextDecoder()
      const push = createSseParser(({ event, data }) => forward(event, data))

      for (;;) {
        const { done, value } = await reader.read()
        if (done) return ended(true)
        arm()
        // stream: true — UTF-8 한 글자가 청크 경계에 걸쳐 잘려 와도 깨지지 않게.
        push(decoder.decode(value, { stream: true }))
      }
    } catch {
      return ended(handle.reader !== null)
    } finally {
      if (watchdog.timer) clearTimeout(watchdog.timer)
      outer.removeEventListener('abort', abortConnection)
    }
  }

  const run = async (storeId: string, controller: AbortController): Promise<void> => {
    const { signal } = controller
    const loop = {
      /** 연속 실패 횟수. 한 번이라도 열리면 0 으로 돌아간다. */
      failures: 0,
      first: true,
      // 401 로 갱신받은 토큰. 다음 시도에 바로 쓴다 — 다시 accessToken() 을 불러
      // 세션이 그 값을 들고 있기를 기대하지 않는다.
      renewedToken: null as string | null,
    }

    while (!signal.aborted) {
      deps.onState(loop.first ? 'connecting' : 'reconnecting')
      loop.first = false

      const token = loop.renewedToken ?? (await deps.session.accessToken())
      loop.renewedToken = null
      if (signal.aborted) return
      if (!token) {
        deps.onState('unauthorized')
        return
      }

      const { outcome, opened } = await connectOnce(storeId, token, signal)
      if (outcome === 'aborted' || signal.aborted) return
      if (outcome === 'forbidden') {
        deps.onState('unauthorized')
        return
      }
      if (outcome === 'renew') {
        const renewed = await deps.session.invalidate()
        if (!renewed) {
          deps.onState('unauthorized')
          return
        }
        loop.renewedToken = renewed
        continue // 새 토큰으로 바로 다시 연다
      }

      // 몇 시간 잘 붙어 있다가 한 번 끊긴 것과, 서버가 계속 튕겨내는 것은 다르다.
      // 열렸던 적이 있으면 처음부터 세서 바로 다시 붙고, 연속 실패일 때만 간격을
      // 벌린다. 상한 30초 — 그동안 사장님은 알림을 못 받으므로 너무 길게 두지 않는다.
      loop.failures = opened ? 0 : loop.failures + 1
      deps.onState('reconnecting')
      await delay(nextDelayMs(loop.failures, { baseMs: 1000, maxMs: 30_000 }), signal)
    }
  }

  const stop = (): void => {
    const controller = state.controller
    state.controller = null
    if (!controller) return
    controller.abort()
    deps.onState('idle')
  }

  return {
    start: (storeId) => {
      stop()
      const controller = new AbortController()
      state.controller = controller
      void run(storeId, controller)
    },
    stop,
  }
}
