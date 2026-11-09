import type { Session } from './session-types'

/**
 * 휴대폰 번호 OTP — PC 앱과 같은 방식(Supabase Auth)이다.
 *
 * supabase-js 를 쓰지 않고 REST 를 직접 부른다. 필요한 건 두 엔드포인트뿐이고,
 * PC 앱도 같은 이유로 직접 호출한다. 의존성이 하나 줄어든다.
 *
 * Supabase 주소가 설정돼 있지 않으면 **가짜 인증**으로 떨어진다 —
 * 백엔드·Supabase 프로젝트가 아직 없어서 화면을 그렇게 만들고 있다.
 */

export interface AuthBackend {
  readonly kind: 'supabase' | 'mock'
  sendOtp(phone: string): Promise<void>
  verifyOtp(phone: string, code: string): Promise<Session>
}

const normalizePhone = (raw: string): string => {
  const digits = raw.replace(/[^\d+]/g, '')
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('0')) return `+82${digits.slice(1)}`
  return `+82${digits}`
}

export const createSupabaseAuth = (url: string, anonKey: string): AuthBackend => {
  const call = async (path: string, body: unknown): Promise<unknown> => {
    const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: anonKey },
      body: JSON.stringify(body),
    })
    const json = await response.json().catch(() => null)
    if (!response.ok) {
      const message = (json as { msg?: string; error_description?: string } | null)
      throw new Error(message?.msg ?? message?.error_description ?? `인증 실패 (HTTP ${response.status})`)
    }
    return json
  }

  return {
    kind: 'supabase',
    sendOtp: async (phone) => {
      await call('otp', { phone: normalizePhone(phone) })
    },
    verifyOtp: async (phone, code) => {
      const json = (await call('verify', {
        phone: normalizePhone(phone), token: code, type: 'sms',
      })) as { access_token?: string; refresh_token?: string; expires_at?: number; user?: { id?: string; phone?: string } }
      if (!json.access_token) throw new Error('인증 응답에 토큰이 없습니다')
      return {
        accessToken: json.access_token,
        refreshToken: json.refresh_token ?? null,
        expiresAt: json.expires_at ? json.expires_at * 1000 : null,
        userId: json.user?.id ?? null,
        phone: json.user?.phone ?? normalizePhone(phone),
      }
    },
  }
}

/**
 * 실서버 시연(/wanted-test)의 데모 계정 로그인 — 이메일·비밀번호.
 * 사장님 앱의 로그인은 휴대폰 인증뿐이고, 이 길은 체험판 전용이다.
 * 화면에는 계정의 휴대폰 번호가 보인다. 번호가 없는 계정이면 이메일이 보인다.
 */
export const signInWithPassword = async (
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<Session> => {
  const response = await fetch(`${url.replace(/\/+$/, '')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: anonKey },
    body: JSON.stringify({ email, password }),
  })
  const json = (await response.json().catch(() => null)) as {
    access_token?: string
    refresh_token?: string
    expires_in?: number
    expires_at?: number
    user?: { id?: string; phone?: string; email?: string }
    msg?: string
    error_description?: string
  } | null
  if (!response.ok || !json?.access_token) {
    throw new Error(
      response.status === 400
        ? '데모 계정으로 로그인하지 못했습니다. 계정 설정(이메일·비밀번호)을 확인해 주세요.'
        : (json?.msg ?? json?.error_description ?? `로그인 실패 (HTTP ${response.status})`),
    )
  }
  const expiresAt = json.expires_at
    ? json.expires_at * 1000
    : json.expires_in
      ? Date.now() + json.expires_in * 1000
      : null
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token ?? null,
    expiresAt,
    userId: json.user?.id ?? null,
    phone: json.user?.phone || json.user?.email || email,
  }
}

/** 코드 6자리면 통과. 서버 없이 화면을 끝까지 볼 수 있게 한다. */
export const createMockAuth = (): AuthBackend => ({
  kind: 'mock',
  sendOtp: async () => {
    await new Promise((r) => setTimeout(r, 300))
  },
  verifyOtp: async (phone, code) => {
    await new Promise((r) => setTimeout(r, 300))
    if (!/^\d{6}$/.test(code)) throw new Error('인증번호 6자리를 입력해 주세요')
    return {
      accessToken: 'mock-access-token',
      refreshToken: null,
      expiresAt: Date.now() + 3_600_000,
      userId: 'mock-user',
      phone: normalizePhone(phone),
    }
  },
})
