import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLiveApi, liveDemoState } from '../../src/renderer/lib/live/live-api'
import { manifestUrlForApp } from '../../src/renderer/lib/live/manifest'
import type { LiveConfig } from '../../src/renderer/lib/live/config'
import type { CameraDto, ServerStreamMessage } from '../../src/shared/server-types'
import type { SegmentMeta } from '../../src/shared/types'

const config: LiveConfig = {
  apiUrl: 'https://api.test', supabaseUrl: 'https://auth.test', supabaseAnonKey: 'anon-test',
  email: 'demo@test.invalid', password: 'test-only', deviceToken: 'device-test', storeId: 'store-test',
}
const manifest = {
  segmentSeconds: 30,
  videos: [0, 1, 2].map((n) => ({
    id: `demo-${n}`, name: `카메라 ${n + 1}`, file: `${n}/full.mp4`, codec: 'h264',
    width: 854, height: 480, fps: 25, durationMs: 30_000,
    segments: [{ file: `${n}/seg-0.mp4`, offsetMs: 0, durationMs: 30_000, sizeBytes: 3 }],
  })),
}
const camera = (n: number): CameraDto => ({
  id: `server-${n}`, agentCameraId: `demo-${n}`, storeId: config.storeId, name: `카메라 ${n + 1}`,
  locationTag: null, sortOrder: n, streamProfile: 'sub', state: 'connected',
  lastFrameAt: null, lastSegmentAt: null,
})

const backend = () => {
  const cameras = new Map([[camera(0).id, camera(0)]])
  const uploads: SegmentMeta[] = []
  const stream: { controller?: ReadableStreamDefaultController<Uint8Array> } = {}
  const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status })
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const path = url.pathname
    if (path === '/auth/v1/token') return reply({
      access_token: 'user-test', refresh_token: 'refresh-test', expires_in: 3600,
      user: { id: 'owner-test', email: config.email },
    })
    if (path.endsWith('/manifest.json')) return reply(manifest)
    if (path.endsWith('.mp4')) return new Response(new Uint8Array([1, 2, 3]))
    if (path === '/stores') return reply({ stores: [{
      id: config.storeId, name: '테스트 매장', segmentSeconds: 30,
      device: { deviceId: 'pc-test' },
    }] })
    if (path === `/stores/${config.storeId}/cameras`) {
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body))
        const n = Number(body.agentCameraId.replace('demo-', ''))
        const row = { ...camera(n), ...body }
        cameras.set(row.id, row)
        return reply({ camera: row }, 201)
      }
      return reply({ cameras: [...cameras.values()] })
    }
    if (path.startsWith('/cameras/') && init?.method === 'DELETE') {
      cameras.delete(path.slice('/cameras/'.length))
      return new Response(null, { status: 204 })
    }
    if (path === '/v1/devices/heartbeat') return reply({ segmentSeconds: 30 })
    if (path === '/v1/segments') {
      const form = init?.body as FormData
      uploads.push(JSON.parse(await (form.get('meta') as Blob).text()))
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer device-test')
      return reply({}, 201)
    }
    if (path.endsWith('/stream')) {
      const body = new ReadableStream<Uint8Array>({ start: (controller) => { stream.controller = controller } })
      return new Response(body, { headers: { 'content-type': 'text/event-stream' } })
    }
    throw new Error(`예상하지 못한 요청: ${init?.method ?? 'GET'} ${path}`)
  })
  return { fetch, cameras, uploads, stream }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  const storage = new Map<string, string>()
  vi.stubGlobal('window', { location: { origin: 'https://demo.test' } })
  vi.stubGlobal('sessionStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  })
})
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals() })

describe('실서버 데모 사용자 흐름', () => {
  it('설정 누락을 기능이 막힌 미리보기로 숨기지 않는다', async () => {
    const server = backend()
    vi.stubGlobal('fetch', server.fetch)
    const api = createLiveApi({ ...config, password: '' })
    expect(await liveDemoState.ready()).toEqual({ ok: false, message: expect.stringContaining('LIVE_PASSWORD') })
    expect(await api.authGetSession()).toEqual({ signedIn: false })
    expect(server.fetch).not.toHaveBeenCalled()
  })

  it('자동 로그인 후 카메라 추가·삭제를 서버와 수집기에 반영하고 새 진입에서도 유지한다', async () => {
    const server = backend()
    vi.stubGlobal('fetch', server.fetch)
    const api = createLiveApi(config)
    expect((await liveDemoState.ready()).ok).toBe(true)
    expect((await api.authGetSession()).signedIn).toBe(true)
    expect(liveDemoState.videos()).toHaveLength(3)
    expect((await api.getConfig()).cameras.map((c) => c.id)).toEqual(['demo-0'])

    await api.serverRequest({ method: 'POST', path: '/stores/store-test/cameras', body: {
      agentCameraId: 'demo-1', name: '새 입구', locationTag: 'entrance', streamProfile: 'sub',
    } })
    const first = (await api.getConfig()).cameras[0]!
    const added = { ...first, id: 'demo-1', name: '새 입구', rtspUri: 'demo-video://demo-1' }
    await api.start([first, added])
    await api.setConfig({ cameras: [first, added] })
    expect((await api.getStatus()).cameras.map((c) => c.cameraId)).toEqual(['demo-0', 'demo-1'])
    expect(await api.previewStart(added.rtspUri)).toEqual({ ok: true, url: expect.stringContaining('/1/full.mp4#t=') })

    expect((await api.serverRequest({ method: 'DELETE', path: '/cameras/server-0' })).ok).toBe(true)
    await api.start([added])
    await api.setConfig({ cameras: [added] })
    expect((await api.getStatus()).cameras.map((c) => c.cameraId)).toEqual(['demo-1'])
    await api.stop()
    const reopened = createLiveApi(config)
    await liveDemoState.ready()
    expect((await reopened.getConfig()).cameras.map((c) => c.id)).toEqual(['demo-1'])
  })

  it('재생 시각에 맞춰 실제 업로드 API를 호출하고 서버 SSE 위험 이벤트를 전달한다', async () => {
    const server = backend()
    vi.stubGlobal('fetch', server.fetch)
    const api = createLiveApi(config)
    await liveDemoState.ready()
    await vi.advanceTimersByTimeAsync(30_500)
    for (let i = 0; i < 10; i++) await new Promise<void>((resolve) => setImmediate(resolve))
    expect(server.uploads).toHaveLength(1)
    expect(server.uploads[0]).toMatchObject({ storeId: 'store-test', deviceId: 'pc-test', camera: { id: 'demo-0' } })
    expect((await api.getStatus()).cameras[0]?.uploadedCount).toBe(1)

    const messages: ServerStreamMessage[] = []
    api.onServerStream((message) => messages.push(message))
    await api.serverStreamStart(config.storeId)
    for (let i = 0; i < 10 && !server.stream.controller; i++) await Promise.resolve()
    server.stream.controller!.enqueue(new TextEncoder().encode('event: event.created\ndata: {"id":"event-test","risk":"high","state":"unconfirmed"}\n\n'))
    for (let i = 0; i < 10 && messages.length === 0; i++) await Promise.resolve()
    expect(messages).toContainEqual({ type: 'event.created', data: { id: 'event-test', risk: 'high', state: 'unconfirmed' } })
    await api.serverStreamStop()
  })

  it('URL 끝 슬래시가 생략돼도 빌드 기준 경로로 시연 영상을 찾는다', () => {
    expect(manifestUrlForApp('/wanted-test/pc/', 'https://demo.test'))
      .toBe('https://demo.test/wanted-test/demo-video/manifest.json')
  })
})
