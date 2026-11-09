import { describe, expect, it, vi } from 'vitest'
import { createServerClient } from '../../src/main/services/server-client'

const json = (status: number, body: unknown): Response =>
  new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const fakeSession = (tokens: readonly (string | null)[] = ['A1'], refreshed: string | null = 'A2') => ({
  accessToken: vi.fn(async () => tokens[0] ?? null),
  invalidate: vi.fn(async () => refreshed),
})

const setup = (
  respond: (url: string, init?: RequestInit) => Promise<Response>,
  session = fakeSession(),
  baseUrl = 'https://api.scene.kr',
) => {
  const fetchMock = vi.fn(respond)
  const client = createServerClient({
    getBaseUrl: () => baseUrl,
    session,
    fetch: fetchMock as unknown as typeof fetch,
  })
  return { client, fetchMock, session }
}

describe('createServerClient', () => {
  it('사용자 JWT 를 붙여 백엔드로 보낸다', async () => {
    const { client, fetchMock } = setup(async () => json(200, { stores: [] }))
    const result = await client.request({ method: 'GET', path: '/stores' })

    expect(result).toEqual({ ok: true, status: 200, data: { stores: [] } })
    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.scene.kr/stores')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer A1')
  })

  it('body 를 JSON 으로 싣는다', async () => {
    const { client, fetchMock } = setup(async () => json(200, {}))
    await client.request({ method: 'PATCH', path: '/events/e1/state', body: { state: 'confirmed' } })
    const init = fetchMock.mock.calls[0]?.[1]
    expect(init?.method).toBe('PATCH')
    expect(JSON.parse(String(init?.body))).toEqual({ state: 'confirmed' })
  })

  it('401 이면 토큰을 갱신해서 한 번 더 보낸다', async () => {
    const responses = [json(401, { error: '만료' }), json(200, { ok: true })]
    const { client, fetchMock, session } = setup(async () => responses.shift() ?? json(500, {}))

    const result = await client.request({ method: 'GET', path: '/stores' })

    expect(result.ok).toBe(true)
    expect(session.invalidate).toHaveBeenCalledTimes(1)
    const retried = fetchMock.mock.calls[1]?.[1]
    expect((retried?.headers as Record<string, string>).authorization).toBe('Bearer A2')
  })

  it('갱신 후에도 401 이면 거기서 멈춘다 — 무한 재시도하지 않는다', async () => {
    const { client, fetchMock } = setup(async () => json(401, { error: '로그인이 필요합니다' }))
    const result = await client.request({ method: 'GET', path: '/stores' })
    expect(result).toMatchObject({ ok: false, status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('로그인 안 했으면 요청하지 않고 401', async () => {
    const { client, fetchMock } = setup(async () => json(200, {}), fakeSession([null]))
    expect(await client.request({ method: 'GET', path: '/stores' })).toMatchObject({ ok: false, status: 401 })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('서버 에러 본문을 그대로 넘긴다 — 409 의 existingDevice 같은 정보가 필요하다', async () => {
    const body = { error: '이미 연결된 PC 가 있습니다', existingDevice: { deviceId: 'pc-old' } }
    const { client } = setup(async () => json(409, body))
    const result = await client.request({ method: 'POST', path: '/stores/s1/devices', body: {} })
    expect(result).toEqual({ ok: false, status: 409, error: '이미 연결된 PC 가 있습니다', data: body })
  })

  it('204 는 data 가 null 이다', async () => {
    const { client } = setup(async () => json(204, null))
    expect(await client.request({ method: 'DELETE', path: '/cameras/c1' })).toEqual({
      ok: true,
      status: 204,
      data: null,
    })
  })

  it('네트워크가 끊기면 status 0 과 사람이 읽는 메시지', async () => {
    const { client } = setup(async () => {
      throw new TypeError('fetch failed')
    })
    const result = await client.request({ method: 'GET', path: '/stores' })
    expect(result).toMatchObject({ ok: false, status: 0 })
    expect(result.ok ? '' : result.error).toContain('서버에 연결할 수 없습니다')
  })

  it('서버 주소가 비어 있으면 설정으로 안내한다', async () => {
    const { client, fetchMock } = setup(async () => json(200, {}), fakeSession(), '')
    const result = await client.request({ method: 'GET', path: '/stores' })
    expect(result.ok ? '' : result.error).toContain('설정 ▸ 고급')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  describe('렌더러가 메인 프로세스를 통해 다른 호스트로 나가지 못한다', () => {
    // 렌더러가 뚫리면 이 프록시가 사용자 JWT 를 들고 아무 데나 갈 수 있게 된다.
    it.each([
      ['@evil.example/steal', 'userinfo 로 호스트 바꾸기'],
      ['//evil.example/steal', '프로토콜 상대 URL'],
      ['https://evil.example/steal', '절대 URL'],
      ['stores', '/ 로 시작하지 않음'],
    ])('%s (%s) 는 거부한다', async (path) => {
      const { client, fetchMock } = setup(async () => json(200, {}))
      const result = await client.request({ method: 'GET', path })
      expect(result).toMatchObject({ ok: false, status: 400 })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('/internal 은 막는다 — 워커 전용 경로다', async () => {
      const { client, fetchMock } = setup(async () => json(200, {}))
      const result = await client.request({ method: 'POST', path: '/internal/events/published' })
      expect(result).toMatchObject({ ok: false, status: 400 })
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('쿼리 문자열은 허용한다', async () => {
      const { client, fetchMock } = setup(async () => json(200, {}))
      await client.request({ method: 'GET', path: '/stores/s1/events?date=2026-09-16&state=unconfirmed' })
      expect(fetchMock.mock.calls[0]?.[0]).toBe(
        'https://api.scene.kr/stores/s1/events?date=2026-09-16&state=unconfirmed',
      )
    })
  })
})
