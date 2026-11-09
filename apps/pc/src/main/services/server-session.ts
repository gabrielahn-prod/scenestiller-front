/**
 * 사장님 로그인 세션 (요구사항 1.1 · 1.6, 계약 3.1).
 *
 * 휴대폰 인증은 백엔드가 아니라 Supabase Auth 가 직접 처리한다. supabase-js 를
 * 렌더러에 넣지 않고 메인 프로세스에서 REST 로 부르는 이유:
 *  - 렌더러 CSP 가 default-src 'self' 라 교차 출처 요청이 막힌다
 *  - 토큰을 렌더러 JS 힙에 두지 않는다 — 렌더러로는 요약(userId, phone)만 간다
 *  - 이미 메인 프로세스가 네트워크를 맡는 구조다 (업로더)
 */

export interface SessionTokens {
  readonly accessToken: string
  readonly refreshToken: string
  /** epoch ms */
  readonly expiresAt: number
  readonly userId: string
  readonly phone: string
}

/** 렌더러로 내보내는 모양. 토큰을 절대 싣지 않는다. */
export interface SessionSummary {
  readonly userId: string
  readonly phone: string
}

export interface TokenStore {
  load(): SessionTokens | null
  save(tokens: SessionTokens): void
  clear(): void
}

export interface SessionConfig {
  readonly supabaseUrl: string
  readonly supabaseAnonKey: string
}

export interface ServerSessionDeps {
  readonly getConfig: () => SessionConfig
  readonly fetch: typeof fetch
  readonly store: TokenStore
  readonly now?: () => number
}

export interface ServerSession {
  sendOtp(phone: string): Promise<void>
  verifyOtp(phone: string, code: string): Promise<SessionSummary>
  /**
   * 이메일·비밀번호 로그인 — 웹 데모(/wanted-test)의 데모 계정 전용이다. 매장 PC 는 휴대폰 인증만 쓴다.
   * 화면에는 계정의 휴대폰 번호가 보인다. 번호가 없는 계정이면 이메일이 보인다.
   */
  signInWithPassword(email: string, password: string): Promise<SessionSummary>
  signOut(): Promise<void>
  summary(): SessionSummary | null
  /** 유효한 액세스 토큰. 만료가 가까우면 갱신한다. 로그인 안 됐으면 null. */
  accessToken(): Promise<string | null>
  /** 서버가 401 을 줬을 때 — 만료 전이어도 강제로 갱신한다. */
  invalidate(): Promise<string | null>
}

/** 화면에 그대로 띄울 수 있는 한글 메시지를 담는다. */
export class SessionError extends Error {
  override readonly name = 'SessionError'
}

// 만료 직전 토큰으로 요청을 보내면 서버 도착 시점엔 이미 만료다.
const REFRESH_SKEW_MS = 60_000

/** 010-1234-5678 → +821012345678. 휴대폰 번호가 아니면 null. */
export const toE164Kr = (input: string): string | null => {
  const digits = input.replace(/[^\d+]/g, '')
  if (/^\+8210\d{8}$/.test(digits)) return digits
  const local = digits.replace(/^\+?82/, '0')
  return /^010\d{8}$/.test(local) ? `+82${local.slice(1)}` : null
}

interface GrantResponse {
  readonly access_token: string
  readonly refresh_token: string
  readonly expires_in: number
  readonly user?: { readonly id?: string; readonly phone?: string; readonly email?: string }
}

const isGrant = (value: unknown): value is GrantResponse => {
  const v = value as Partial<GrantResponse> | null
  return typeof v?.access_token === 'string' && typeof v.refresh_token === 'string' && typeof v.expires_in === 'number'
}

/** GoTrue 의 에러 응답을 사장님이 읽을 문장으로. */
const toSessionError = (status: number, body: unknown): SessionError => {
  const raw = body as { code?: string; msg?: string; error?: string; error_description?: string } | null
  const text = `${raw?.code ?? ''} ${raw?.msg ?? ''} ${raw?.error ?? ''} ${raw?.error_description ?? ''}`.toLowerCase()

  if (status === 429 || text.includes('rate')) {
    return new SessionError('요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.')
  }
  if (text.includes('otp') || text.includes('token') || status === 403) {
    return new SessionError('인증번호가 맞지 않거나 만료되었습니다. 다시 확인해 주세요.')
  }
  if (text.includes('phone') && text.includes('provider')) {
    // Supabase 대시보드에서 Phone Auth 를 켜지 않은 경우 (계약 11절).
    return new SessionError('휴대폰 인증이 서버에 설정되지 않았습니다. 관리자에게 문의해 주세요.')
  }
  return new SessionError(`로그인에 실패했습니다 (${status}).`)
}

export const createServerSession = (deps: ServerSessionDeps): ServerSession => {
  const now = deps.now ?? Date.now
  const state = {
    tokens: deps.store.load(),
    // 갱신은 반드시 한 번에 하나. Supabase 리프레시 토큰은 1회용이라, 같은
    // 토큰으로 두 번 갱신하면 재사용으로 판정돼 세션 전체가 폐기된다.
    refreshing: null as Promise<string | null> | null,
  }

  const endpoint = (path: string): { url: string; headers: Record<string, string> } => {
    const { supabaseUrl, supabaseAnonKey } = deps.getConfig()
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new SessionError('로그인 서버 설정이 비어 있습니다. 설정 ▸ 고급에서 입력해 주세요.')
    }
    return {
      url: `${supabaseUrl.replace(/\/$/, '')}/auth/v1${path}`,
      headers: { apikey: supabaseAnonKey, 'content-type': 'application/json' },
    }
  }

  const post = async (path: string, body: unknown, extraHeaders: Record<string, string> = {}): Promise<unknown> => {
    const { url, headers } = endpoint(path)
    const response = await deps.fetch(url, {
      method: 'POST',
      headers: { ...headers, ...extraHeaders },
      body: JSON.stringify(body),
    })
    const parsed = await response.json().catch(() => null)
    if (!response.ok) throw toSessionError(response.status, parsed)
    return parsed
  }

  const adopt = (grant: GrantResponse, phone: string): SessionTokens => {
    const tokens: SessionTokens = {
      accessToken: grant.access_token,
      refreshToken: grant.refresh_token,
      expiresAt: now() + grant.expires_in * 1000,
      userId: grant.user?.id ?? state.tokens?.userId ?? '',
      phone,
    }
    state.tokens = tokens
    deps.store.save(tokens)
    return tokens
  }

  const clear = (): void => {
    state.tokens = null
    deps.store.clear()
  }

  const refresh = (): Promise<string | null> => {
    if (state.refreshing) return state.refreshing
    const current = state.tokens
    if (!current) return Promise.resolve(null)

    state.refreshing = (async () => {
      try {
        const grant = await post('/token?grant_type=refresh_token', { refresh_token: current.refreshToken })
        if (!isGrant(grant)) throw new SessionError('로그인 서버 응답이 올바르지 않습니다.')
        return adopt(grant, current.phone).accessToken
      } catch (error) {
        // 서버가 거절했다 = 토큰이 죽었다 → 다시 로그인해야 한다.
        // 네트워크 실패 = 매장 인터넷이 잠깐 끊겼다 → 세션은 살려 둔다.
        if (error instanceof SessionError) clear()
        return null
      } finally {
        state.refreshing = null
      }
    })()
    return state.refreshing
  }

  return {
    sendOtp: async (phone) => {
      const e164 = toE164Kr(phone)
      if (!e164) throw new SessionError('휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)')
      await post('/otp', { phone: e164 })
    },

    verifyOtp: async (phone, code) => {
      const e164 = toE164Kr(phone)
      if (!e164) throw new SessionError('휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)')
      const grant = await post('/verify', { phone: e164, token: code.trim(), type: 'sms' })
      if (!isGrant(grant)) throw new SessionError('로그인 서버 응답이 올바르지 않습니다.')
      const tokens = adopt(grant, e164)
      return { userId: tokens.userId, phone: tokens.phone }
    },

    signInWithPassword: async (email, password) => {
      const grant = await post('/token?grant_type=password', { email: email.trim(), password }).catch(
        (error: unknown) => {
          // 인증번호용 문구('인증번호가 맞지 않거나…')가 나가면 무엇이 틀렸는지 모른다.
          if (error instanceof SessionError && !error.message.includes('잦습니다')) {
            throw new SessionError('데모 계정으로 로그인하지 못했습니다. 계정 설정(이메일·비밀번호)을 확인해 주세요.')
          }
          throw error
        },
      )
      if (!isGrant(grant)) throw new SessionError('로그인 서버 응답이 올바르지 않습니다.')
      // Supabase 는 번호를 '821012345678' 로 준다. 휴대폰 로그인과 같은 모양(+82…)으로 맞춘다.
      const phone = grant.user?.phone ? (toE164Kr(grant.user.phone) ?? grant.user.phone) : null
      const tokens = adopt(grant, phone ?? grant.user?.email ?? email.trim())
      return { userId: tokens.userId, phone: tokens.phone }
    },

    signOut: async () => {
      const current = state.tokens
      clear()
      if (!current) return
      try {
        await post('/logout', {}, { authorization: `Bearer ${current.accessToken}` })
      } catch {
        // 서버에 못 알려도 이 PC 에서는 로그아웃된 것이다.
      }
    },

    summary: () => (state.tokens ? { userId: state.tokens.userId, phone: state.tokens.phone } : null),

    accessToken: async () => {
      const current = state.tokens
      if (!current) return null
      if (current.expiresAt - now() > REFRESH_SKEW_MS) return current.accessToken
      return refresh()
    },

    invalidate: () => refresh(),
  }
}
