import { describe, expect, it, vi } from 'vitest'
import { createServerStream } from '../../src/main/services/server-stream'
import type { StreamConnectionState } from '../../src/shared/ipc'
import type { ServerStreamMessage } from '../../src/shared/server-types'

/** 테스트가 조각을 밀어 넣고 닫을 수 있는 SSE 응답. */
const controllableStream = () => {
  const encoder = new TextEncoder()
  const handle = { controller: null as ReadableStreamDefaultController<Uint8Array> | null }
  const body = new ReadableStream<Uint8Array>({
    start: (controller) => {
      handle.controller = controller
    },
  })
  return {
    response: new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    send: (text: string) => handle.controller?.enqueue(encoder.encode(text)),
    end: () => handle.controller?.close(),
  }
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const until = async (check: () => boolean, tries = 200) => {
  for (let i = 0; i < tries && !check(); i += 1) await tick()
}

const setup = (options: {
  responses: (() => Response | Promise<Response>)[]
  token?: string | null
  refreshed?: string | null
  idleTimeoutMs?: number
}) => {
  const messages: ServerStreamMessage[] = []
  const states: StreamConnectionState[] = []
  const queue = [...options.responses]
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const next = queue.shift()
    if (!next) {
      // 더 줄 응답이 없으면 abort 될 때까지 매달려 있는다.
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
      })
    }
    return next()
  })
  const session = {
    accessToken: vi.fn(async () => (options.token === undefined ? 'A1' : options.token)),
    invalidate: vi.fn(async () => (options.refreshed === undefined ? 'A2' : options.refreshed)),
  }
  const stream = createServerStream({
    getBaseUrl: () => 'https://api.scene.kr',
    session,
    fetch: fetchMock as unknown as typeof fetch,
    onMessage: (message) => messages.push(message),
    onState: (state) => states.push(state),
    // 재연결 대기는 테스트에서 즉시 끝낸다.
    delay: async () => undefined,
    idleTimeoutMs: options.idleTimeoutMs ?? 60_000,
  })
  return { stream, messages, states, fetchMock, session }
}

describe('createServerStream', () => {
  it('매장 SSE 를 사용자 JWT 로 연다', async () => {
    const sse = controllableStream()
    const { stream, fetchMock } = setup({ responses: [() => sse.response] })
    stream.start('store-1')
    await until(() => fetchMock.mock.calls.length > 0)

    const [url, init] = fetchMock.mock.calls[0] ?? []
    expect(url).toBe('https://api.scene.kr/stores/store-1/stream')
    expect((init?.headers as Record<string, string>).authorization).toBe('Bearer A1')
    expect((init?.headers as Record<string, string>).accept).toBe('text/event-stream')
    stream.stop()
  })

  it('이벤트를 파싱해 type/data 로 넘긴다', async () => {
    const sse = controllableStream()
    const { stream, messages } = setup({ responses: [() => sse.response] })
    stream.start('store-1')
    await tick()

    sse.send('event: event.created\ndata: {"id":"e1","risk":"high"}\n\n')
    await until(() => messages.length > 0)

    expect(messages).toEqual([{ type: 'event.created', data: { id: 'e1', risk: 'high' } }])
    stream.stop()
  })

  it('연결 중 → 열림 순서로 상태를 알린다', async () => {
    const sse = controllableStream()
    const { stream, states } = setup({ responses: [() => sse.response] })
    stream.start('store-1')
    await until(() => states.includes('open'))
    expect(states.slice(0, 2)).toEqual(['connecting', 'open'])
    stream.stop()
  })

  it('서버가 스트림을 닫으면 다시 붙는다', async () => {
    const first = controllableStream()
    const second = controllableStream()
    const { stream, states, fetchMock } = setup({
      responses: [() => first.response, () => second.response],
    })
    stream.start('store-1')
    await until(() => states.includes('open'))

    first.end()
    await until(() => fetchMock.mock.calls.length === 2)

    expect(states).toContain('reconnecting')
    expect(fetchMock).toHaveBeenCalledTimes(2)
    stream.stop()
  })

  it('stop 하면 더 이상 붙지 않고 idle 로 끝난다', async () => {
    const sse = controllableStream()
    const { stream, states, fetchMock } = setup({ responses: [() => sse.response] })
    stream.start('store-1')
    await until(() => states.includes('open'))

    stream.stop()
    await tick()
    await tick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(states.at(-1)).toBe('idle')
  })

  it('401 이면 토큰을 갱신해서 다시 연다', async () => {
    const sse = controllableStream()
    const { stream, fetchMock, session } = setup({
      responses: [() => new Response('{"error":"만료"}', { status: 401 }), () => sse.response],
    })
    stream.start('store-1')
    await until(() => fetchMock.mock.calls.length === 2)

    expect(session.invalidate).toHaveBeenCalled()
    expect((fetchMock.mock.calls[1]?.[1]?.headers as Record<string, string>).authorization).toBe('Bearer A2')
    stream.stop()
  })

  it('로그인이 안 됐으면 요청하지 않고 unauthorized', async () => {
    const { stream, states, fetchMock } = setup({ responses: [], token: null })
    stream.start('store-1')
    await until(() => states.includes('unauthorized'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('남의 매장(404)이면 재시도하지 않는다', async () => {
    // 권한 없는 매장에 백오프로 영원히 두드리면 서버 로그만 쌓인다.
    const { stream, states, fetchMock } = setup({
      responses: [() => new Response('{"error":"매장을 찾을 수 없습니다"}', { status: 404 })],
    })
    stream.start('store-x')
    await until(() => states.includes('unauthorized'))
    await tick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('모르는 이벤트 이름은 무시한다 — 서버가 먼저 새 이벤트를 추가해도 깨지지 않는다', async () => {
    const sse = controllableStream()
    const { stream, messages } = setup({ responses: [() => sse.response] })
    stream.start('store-1')
    await tick()

    sse.send('event: device.state\ndata: {"online":false}\n\nevent: ping\ndata: {}\n\n')
    await until(() => messages.length > 0)

    expect(messages).toEqual([{ type: 'ping', data: {} }])
    stream.stop()
  })

  it('data 가 JSON 이 아니면 그 이벤트만 버리고 스트림은 유지한다', async () => {
    const sse = controllableStream()
    const { stream, messages } = setup({ responses: [() => sse.response] })
    stream.start('store-1')
    await tick()

    sse.send('event: event.created\ndata: {깨진\n\nevent: event.updated\ndata: {"id":"e2"}\n\n')
    await until(() => messages.length > 0)

    expect(messages).toEqual([{ type: 'event.updated', data: { id: 'e2' } }])
    stream.stop()
  })

  it('다른 매장으로 start 하면 이전 스트림을 닫는다', async () => {
    const first = controllableStream()
    const second = controllableStream()
    const { stream, fetchMock } = setup({ responses: [() => first.response, () => second.response] })

    stream.start('store-1')
    await until(() => fetchMock.mock.calls.length === 1)
    stream.start('store-2')
    await until(() => fetchMock.mock.calls.length === 2)

    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('/stores/store-2/stream')
    stream.stop()
  })

  it('ping 조차 오지 않으면 죽은 연결로 보고 다시 붙는다', async () => {
    // 매장 공유기(NAT)는 유휴 연결을 조용히 끊는다. TCP 는 반쯤 열린 채로
    // 남아서 에러도 안 나고 이벤트만 영원히 안 온다.
    const silent = controllableStream()
    const next = controllableStream()
    const { stream, fetchMock } = setup({
      responses: [() => silent.response, () => next.response],
      idleTimeoutMs: 20,
    })
    stream.start('store-1')
    await until(() => fetchMock.mock.calls.length === 2, 500)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    stream.stop()
  })
})

describe('createServerStream — 재연결 간격', () => {
  it('오래 붙어 있다가 끊기면 간격을 처음부터 센다', async () => {
    // 매일 몇 번씩 끊기는 매장 회선에서 간격이 최대치(30초)에 눌어붙으면,
    // 끊길 때마다 알림 공백이 30초씩 생긴다.
    const delays: number[] = []
    const streams = Array.from({ length: 4 }, () => controllableStream())
    const queue = streams.map((s) => () => s.response)
    const fetchMock = vi.fn(async () => {
      const next = queue.shift()
      return next ? next() : new Promise<Response>(() => undefined)
    })
    const stream = createServerStream({
      getBaseUrl: () => 'https://api.scene.kr',
      session: { accessToken: async () => 'A1', invalidate: async () => 'A2' },
      fetch: fetchMock as unknown as typeof fetch,
      onMessage: () => undefined,
      onState: () => undefined,
      delay: async (ms) => {
        delays.push(ms)
      },
    })

    stream.start('store-1')
    for (const [index, s] of streams.slice(0, 3).entries()) {
      await until(() => fetchMock.mock.calls.length === index + 1)
      await tick()
      s.end() // 매번 한 번 열렸다가 끊긴다
    }
    await until(() => delays.length === 3)
    stream.stop()

    // nextDelayMs(0) 은 지터 포함 [500, 1000]. 전부 첫 단계여야 한다.
    expect(delays.every((ms) => ms <= 1000)).toBe(true)
  })
})
