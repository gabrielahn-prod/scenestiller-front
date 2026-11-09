export interface BackoffOptions {
  readonly baseMs: number
  readonly maxMs: number
  readonly jitter: boolean
}

const DEFAULTS: BackoffOptions = { baseMs: 1000, maxMs: 300_000, jitter: true }

/**
 * 지수 백오프 지연 시간.
 *
 * 지터를 기본으로 켜는 이유: 정전이나 회선 장애가 풀리는 순간 여러 매장이 동시에
 * 복구를 감지하면 백엔드에 재시도가 한꺼번에 몰린다(thundering herd).
 * 지연을 [delay/2, delay] 범위로 흩뜨려 이를 완화한다.
 */
export const nextDelayMs = (attempt: number, opts: Partial<BackoffOptions> = {}): number => {
  const { baseMs, maxMs, jitter } = { ...DEFAULTS, ...opts }
  const raw = Math.min(baseMs * 2 ** Math.max(0, attempt), maxMs)
  return jitter ? Math.round(raw / 2 + Math.random() * (raw / 2)) : raw
}
