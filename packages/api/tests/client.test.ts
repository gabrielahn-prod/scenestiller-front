import { describe, expect, it } from 'vitest'
import { ApiError, createApiClient } from '../src/client'

const ok = (body: unknown, status = 200): Response =>
  ({ ok: status < 400, status, json: async () => body }) as Response

interface Call { readonly url: string; readonly init: RequestInit }

const spyClient = (responder: (call: Call) => Response, token: string | null = 'tok') => {
  const calls: Call[] = []
  const api = createApiClient({
    baseUrl: 'https://api.example.com/v1/',
    getToken: async () => token,
    fetchImpl: (async (url: string, init: RequestInit = {}) => {
      const call = { url, init }
      calls.push(call)
      return responder(call)
    }) as unknown as typeof fetch,
  })
  return { api, calls }
}

describe('요청 만들기', () => {
  it('baseUrl 의 끝 슬래시를 겹치지 않게 붙인다', async () => {
    const { api, calls } = spyClient(() => ok({ stores: [] }))
    await api.listStores()
    expect(calls[0]!.url).toBe('https://api.example.com/v1/stores')
  })

  it('토큰이 있으면 Authorization 을 붙인다', async () => {
    const { api, calls } = spyClient(() => ok({ stores: [] }))
    await api.listStores()
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer tok')
  })

  it('토큰이 없으면 헤더를 비운 채 보낸다 — 401 은 서버가 판단한다', async () => {
    const { api, calls } = spyClient(() => ok({ stores: [] }), null)
    await api.listStores()
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  it('빈 쿼리는 물음표조차 붙이지 않는다', async () => {
    const { api, calls } = spyClient(() => ok({ items: [], nextCursor: null }))
    await api.listEvents('store_1')
    expect(calls[0]!.url).toBe('https://api.example.com/v1/stores/store_1/events')
  })

  it('쿼리 값은 인코딩한다', async () => {
    const { api, calls } = spyClient(() => ok({ items: [], nextCursor: null }))
    await api.listEvents('store_1', { cameraId: 'cam 1', risk: 'high', limit: 20 })
    expect(calls[0]!.url).toContain('cameraId=cam%201')
    expect(calls[0]!.url).toContain('risk=high')
    expect(calls[0]!.url).toContain('limit=20')
  })
})

describe('상태 변경', () => {
  it('모바일에서 바꿨다는 사실을 함께 보낸다 — PC 와 동기화 이력에 남는다', async () => {
    const { api, calls } = spyClient(() => ok({ event: { id: 'evt_1' } }))
    await api.setEventState('evt_1', 'confirmed')
    expect(calls[0]!.init.method).toBe('PATCH')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ state: 'confirmed', source: 'mobile' })
  })

  it('사유가 있으면 같이 싣는다', async () => {
    const { api, calls } = spyClient(() => ok({ event: { id: 'evt_1' } }))
    await api.setEventState('evt_1', 'false_positive', { reason: '직원이었음' })
    expect(JSON.parse(String(calls[0]!.init.body)).reason).toBe('직원이었음')
  })
})

describe('오류', () => {
  it('계약대로 error.code / message 를 꺼낸다', async () => {
    const { api } = spyClient(() => ok({ error: { code: 'store_not_found', message: '매장이 없습니다' } }, 404))
    await expect(api.getMonitoring('nope')).rejects.toThrow(ApiError)
    await expect(api.getMonitoring('nope')).rejects.toMatchObject({
      status: 404, code: 'store_not_found', message: '매장이 없습니다',
    })
  })

  it('본문이 JSON 이 아니어도 상태 코드는 살려 올린다', async () => {
    const { api } = spyClient(() => ({
      ok: false, status: 502, json: async () => { throw new Error('not json') },
    }) as Response)
    await expect(api.listStores()).rejects.toMatchObject({ status: 502, code: 'unknown', message: 'HTTP 502' })
  })

  it('204 는 본문을 읽지 않는다', async () => {
    const { api } = spyClient(() => ({
      ok: true, status: 204, json: async () => { throw new Error('본문을 읽으면 안 된다') },
    }) as Response)
    await expect(api.sendTestNotification('store_1')).resolves.toBeUndefined()
  })
})

describe('푸시 기기', () => {
  it('등록은 platform 과 token 을 보낸다', async () => {
    const { api, calls } = spyClient(() => ok({}, 204))
    await api.registerPushDevice('expo', 'ExponentPushToken[abc]')
    expect(calls[0]!.url).toBe('https://api.example.com/v1/push/devices')
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ platform: 'expo', token: 'ExponentPushToken[abc]' })
  })

  it('해제는 토큰만 보낸다', async () => {
    const { api, calls } = spyClient(() => ok({}, 204))
    await api.unregisterPushDevice('ExponentPushToken[abc]')
    expect(calls[0]!.init.method).toBe('DELETE')
  })
})

describe('거절당한 토큰 (401)', () => {
  /** 토큰을 바꿔 가며 답하는 서버. 'new' 만 받아 준다. */
  const serverThatOnlyTakes = (good: string) => {
    const calls: { url: string; auth: string | undefined }[] = []
    const fetchImpl = (async (url: string, init: RequestInit = {}) => {
      const auth = (init.headers as Record<string, string> | undefined)?.authorization
      calls.push({ url, auth })
      return auth === `Bearer ${good}`
        ? ({ ok: true, status: 200, json: async () => ({ stores: [] }) } as Response)
        : ({ ok: false, status: 401, json: async () => ({ error: { code: 'unauthorized', message: '로그인이 필요합니다' } }) } as Response)
    }) as unknown as typeof fetch
    return { calls, fetchImpl }
  }

  it('새 토큰을 받아 그 요청만 다시 보낸다', async () => {
    const { calls, fetchImpl } = serverThatOnlyTakes('new')
    const api = createApiClient({
      baseUrl: 'https://api.example.com',
      getToken: async () => 'old',
      renewToken: async () => 'new',
      fetchImpl,
    })

    await expect(api.listStores()).resolves.toEqual([])
    expect(calls.map((call) => call.auth)).toEqual(['Bearer old', 'Bearer new'])
  })

  it('같은 토큰을 돌려주면 다시 보내지 않는다', async () => {
    const { calls, fetchImpl } = serverThatOnlyTakes('new')
    const api = createApiClient({
      baseUrl: 'https://api.example.com',
      getToken: async () => 'old',
      renewToken: async () => 'old',
      fetchImpl,
    })

    await expect(api.listStores()).rejects.toBeInstanceOf(ApiError)
    expect(calls).toHaveLength(1)
  })

  it('다시 받아 올 곳이 없으면 401 을 그대로 올린다', async () => {
    const { calls, fetchImpl } = serverThatOnlyTakes('new')
    const api = createApiClient({ baseUrl: 'https://api.example.com', getToken: async () => 'old', fetchImpl })

    await expect(api.listStores()).rejects.toMatchObject({ status: 401, code: 'unauthorized' })
    expect(calls).toHaveLength(1)
  })
})
