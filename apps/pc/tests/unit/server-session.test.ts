import { describe, expect, it, vi } from 'vitest'
import {
  createServerSession,
  SessionError,
  toE164Kr,
  type SessionTokens,
  type TokenStore,
} from '../../src/main/services/server-session'

const memoryStore = (initial: SessionTokens | null = null): TokenStore & { current: () => SessionTokens | null } => {
  const box = { value: initial }
  return {
    load: () => box.value,
    save: (tokens) => {
      box.value = tokens
    },
    clear: () => {
      box.value = null
    },
    current: () => box.value,
  }
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const grant = (access: string, refresh: string, expiresIn = 3600) => ({
  access_token: access,
  refresh_token: refresh,
  expires_in: expiresIn,
  token_type: 'bearer',
  user: { id: 'user-1', phone: '821012345678' },
})

const NOW = Date.parse('2026-09-16T05:00:00.000Z')

const setup = (options: {
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  store?: ReturnType<typeof memoryStore>
  now?: () => number
}) => {
  const store = options.store ?? memoryStore()
  const fetchMock = vi.fn(options.fetch)
  const session = createServerSession({
    getConfig: () => ({ supabaseUrl: 'https://proj.supabase.co', supabaseAnonKey: 'anon' }),
    fetch: fetchMock as unknown as typeof fetch,
    store,
    now: options.now ?? (() => NOW),
  })
  return { session, store, fetchMock }
}

describe('toE164Kr', () => {
  it('한국 휴대폰 번호를 E.164 로 바꾼다', () => {
    expect(toE164Kr('010-1234-5678')).toBe('+821012345678')
    expect(toE164Kr('01012345678')).toBe('+821012345678')
    expect(toE164Kr('010 1234 5678')).toBe('+821012345678')
  })

  it('이미 E.164 면 그대로 둔다', () => {
    expect(toE164Kr('+821012345678')).toBe('+821012345678')
  })

  it('휴대폰 번호가 아니면 null', () => {
    expect(toE164Kr('02-123-4567')).toBeNull()
    expect(toE164Kr('010-12')).toBeNull()
    expect(toE164Kr('')).toBeNull()
  })
})

describe('createServerSession', () => {
  it('인증번호 확인에 성공하면 토큰을 저장하고, 요약에는 토큰을 싣지 않는다', async () => {
    const { session, store } = setup({ fetch: async () => json(200, grant('A1', 'R1')) })
    const summary = await session.verifyOtp('010-1234-5678', '123456')

    expect(summary).toEqual({ userId: 'user-1', phone: '+821012345678' })
    // 렌더러로 가는 요약에 토큰이 새면 안 된다.
    expect(JSON.stringify(summary)).not.toContain('A1')
    expect(store.current()?.refreshToken).toBe('R1')
  })

  it('verify 요청에 전화번호·토큰·sms 타입을 싣는다', async () => {
    const { session, fetchMock } = setup({ fetch: async () => json(200, grant('A1', 'R1')) })
    await session.verifyOtp('010-1234-5678', '123456')
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://proj.supabase.co/auth/v1/verify')
    expect(JSON.parse(String(init?.body))).toEqual({ phone: '+821012345678', token: '123456', type: 'sms' })
    expect((init?.headers as Record<string, string>).apikey).toBe('anon')
  })

  it('만료가 멀면 캐시된 액세스 토큰을 쓴다', async () => {
    const store = memoryStore({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW + 3_600_000, userId: 'u', phone: '+82' })
    const { session, fetchMock } = setup({ fetch: async () => json(500, {}), store })
    expect(await session.accessToken()).toBe('A1')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('만료가 가까우면 갱신한다', async () => {
    const store = memoryStore({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW + 30_000, userId: 'u', phone: '+82' })
    const { session, fetchMock } = setup({ fetch: async () => json(200, grant('A2', 'R2')), store })
    expect(await session.accessToken()).toBe('A2')
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('grant_type=refresh_token')
    expect(store.current()?.refreshToken).toBe('R2')
  })

  it('동시에 여러 곳이 토큰을 요구해도 갱신은 한 번만 한다', async () => {
    // Supabase 리프레시 토큰은 1회용이다. 같은 토큰으로 두 번 갱신하면
    // 재사용으로 판정돼 세션 전체가 폐기된다 — 화면 여러 곳이 동시에
    // API 를 부르는 순간 로그아웃되는 버그가 된다.
    const store = memoryStore({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW - 1, userId: 'u', phone: '+82' })
    const release = { fn: (_: Response) => undefined as void }
    const { session, fetchMock } = setup({
      store,
      fetch: () => new Promise<Response>((resolve) => { release.fn = resolve }),
    })

    const calls = [session.accessToken(), session.accessToken(), session.accessToken()]
    release.fn(json(200, grant('A2', 'R2')))

    expect(await Promise.all(calls)).toEqual(['A2', 'A2', 'A2'])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('갱신이 거절되면 세션을 지운다 — 다시 로그인해야 한다', async () => {
    const store = memoryStore({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW - 1, userId: 'u', phone: '+82' })
    const { session } = setup({ store, fetch: async () => json(400, { error: 'invalid_grant' }) })
    expect(await session.accessToken()).toBeNull()
    expect(session.summary()).toBeNull()
    expect(store.current()).toBeNull()
  })

  it('네트워크가 끊겨 갱신을 못 하면 세션을 지우지 않는다', async () => {
    // 매장 인터넷이 잠깐 끊겼다고 사장님을 로그아웃시키면 안 된다.
    const store = memoryStore({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW - 1, userId: 'u', phone: '+82' })
    const { session } = setup({ store, fetch: async () => { throw new TypeError('fetch failed') } })
    expect(await session.accessToken()).toBeNull()
    expect(store.current()?.refreshToken).toBe('R1')
    expect(session.summary()).not.toBeNull()
  })

  it('invalidate 는 만료 전이어도 강제로 갱신한다 (서버가 401 을 준 경우)', async () => {
    const store = memoryStore({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW + 3_600_000, userId: 'u', phone: '+82' })
    const { session } = setup({ store, fetch: async () => json(200, grant('A2', 'R2')) })
    expect(await session.invalidate()).toBe('A2')
  })

  it('로그아웃은 서버 호출이 실패해도 로컬 세션을 지운다', async () => {
    const store = memoryStore({ accessToken: 'A1', refreshToken: 'R1', expiresAt: NOW + 3_600_000, userId: 'u', phone: '+82' })
    const { session } = setup({ store, fetch: async () => { throw new TypeError('offline') } })
    await session.signOut()
    expect(store.current()).toBeNull()
    expect(session.summary()).toBeNull()
  })

  describe('사람이 읽는 에러', () => {
    it('인증번호가 틀리면', async () => {
      const { session } = setup({ fetch: async () => json(403, { code: 'otp_expired', msg: 'Token has expired or is invalid' }) })
      await expect(session.verifyOtp('010-1234-5678', '000000')).rejects.toThrow('인증번호가 맞지 않거나 만료되었습니다')
    })

    it('너무 자주 요청하면', async () => {
      const { session } = setup({ fetch: async () => json(429, { msg: 'rate limit' }) })
      await expect(session.sendOtp('010-1234-5678')).rejects.toThrow('잠시 후 다시')
    })

    it('휴대폰 번호 형식이 아니면 서버에 묻지도 않는다', async () => {
      const { session, fetchMock } = setup({ fetch: async () => json(200, {}) })
      await expect(session.sendOtp('02-123-4567')).rejects.toBeInstanceOf(SessionError)
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('서버 설정이 비어 있으면 어디를 고쳐야 하는지 알려준다', async () => {
      const session = createServerSession({
        getConfig: () => ({ supabaseUrl: '', supabaseAnonKey: '' }),
        fetch: vi.fn() as unknown as typeof fetch,
        store: memoryStore(),
        now: () => NOW,
      })
      await expect(session.sendOtp('010-1234-5678')).rejects.toThrow('설정 ▸ 고급')
    })
  })

  describe('데모 계정 로그인 (웹 체험판)', () => {
    it('이메일·비밀번호로 토큰을 받고, 화면에는 휴대폰 로그인과 같은 모양의 번호를 보인다', async () => {
      const { session, store, fetchMock } = setup({ fetch: async () => json(200, grant('a1', 'r1')) })

      const summary = await session.signInWithPassword(' demo@scene.test ', 'pw')

      expect(summary).toEqual({ userId: 'user-1', phone: '+821012345678' })
      const [url, init] = fetchMock.mock.calls[0]!
      expect(url).toBe('https://proj.supabase.co/auth/v1/token?grant_type=password')
      expect(JSON.parse(String(init?.body))).toEqual({ email: 'demo@scene.test', password: 'pw' })
      expect(store.current()?.accessToken).toBe('a1')
      await expect(session.accessToken()).resolves.toBe('a1')
    })

    it('번호가 없는 계정이면 이메일을 보인다', async () => {
      const { session } = setup({
        fetch: async () =>
          json(200, { ...grant('a1', 'r1'), user: { id: 'user-1', phone: '', email: 'store-test@scene.test' } }),
      })
      await expect(session.signInWithPassword('store-test@scene.test', 'pw')).resolves.toEqual({
        userId: 'user-1',
        phone: 'store-test@scene.test',
      })
    })

    it('계정이 틀리면 인증번호 문구가 아니라 계정 설정을 보라고 한다', async () => {
      const { session } = setup({
        fetch: async () => json(400, { code: 'invalid_credentials', msg: 'Invalid login credentials' }),
      })
      await expect(session.signInWithPassword('demo@scene.test', 'wrong')).rejects.toThrow(
        '데모 계정으로 로그인하지 못했습니다',
      )
    })
  })
})
