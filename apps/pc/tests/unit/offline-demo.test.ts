import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubEnv('VITE_DEMO_MODE', '1')
  vi.stubEnv('VITE_LIVE_MODE', '')
  // 배포에 예전 LIVE_* 설정이 남아 있어도 샘플 모드는 접속하지 않는다.
  vi.stubEnv('VITE_LIVE_API_URL', 'https://unavailable.invalid')
  vi.stubGlobal('window', { location: { search: '', hash: '', origin: 'http://localhost' } })
  vi.stubGlobal('document', { baseURI: 'http://localhost/wanted-test/pc/' })
  vi.stubGlobal('sessionStorage', { getItem: () => null, setItem: vi.fn() })
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('백엔드에 접속하면 안 됩니다') }))
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

const finish = async <T>(pending: Promise<T>): Promise<T> => {
  await vi.advanceTimersByTimeAsync(1000)
  return pending
}

describe('백엔드 없는 제출용 시연', () => {
  it('쿼리 없이 로그인된 감시 화면과 재생 가능한 기록을 제공하고 확인 처리를 한다', async () => {
    const { api, isMock } = await import('../../src/renderer/lib/api')
    expect(isMock).toBe(true)
    expect((await api.authGetSession()).signedIn).toBe(true)
    const config = await api.getConfig()
    expect(config.storeId).toBe('store-gangnam-1')
    expect(config.cameras.length).toBeGreaterThan(0)
    expect((await api.getStatus()).running).toBe(true)
    expect(await finish(api.previewStart(config.cameras[0]!.rtspUri))).toEqual({
      ok: true, url: '/wanted-test/clips/sample.mp4',
    })

    const { listEvents, getEvent, changeEventState, listSegments, getMonitoring } = await import('../../src/renderer/lib/server-api')
    expect((await finish(getMonitoring(config.storeId))).cameras.length).toBeGreaterThan(0)
    const events = await finish(listEvents(config.storeId))
    const event = events.items.find((row) => row.state === 'unconfirmed')!
    expect(event).toBeDefined()
    expect((await finish(getEvent(event.id))).clipUrl).toBe('/wanted-test/clips/sample.mp4')
    const segments = await finish(listSegments(config.storeId, {
      cameraId: event.cameraId,
      from: new Date(Date.parse(event.startedAt) - 60_000).toISOString(),
      to: new Date(Date.parse(event.startedAt) + 60_000).toISOString(),
    }))
    expect(segments.length).toBeGreaterThan(0)
    expect(segments[0]?.playbackUrl).toBe('/wanted-test/clips/sample.mp4')
    expect((await finish(changeEventState(event.id, 'confirmed'))).state).toBe('confirmed')
    expect((await finish(getEvent(event.id))).state).toBe('confirmed')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('시연 버튼의 경고 이벤트를 스트림으로 전달한다', async () => {
    const { api } = await import('../../src/renderer/lib/api')
    const listener = vi.fn()
    api.onServerStream(listener)
    await api.serverStreamStart('store-gangnam-1')
    await vi.advanceTimersByTimeAsync(300)
    const triggered = window.__sceneStealer?.triggerRisk()
    expect(triggered?.eventId).toBeTruthy()
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({
      type: 'event.created', data: expect.objectContaining({ id: triggered?.eventId, risk: 'high' }),
    }))
    expect(fetch).not.toHaveBeenCalled()
  })

  it('실서버 빌드와 Electron에서는 샘플 자동 부팅을 켜지 않는다', async () => {
    vi.stubEnv('VITE_LIVE_MODE', '1')
    expect((await import('../../src/renderer/lib/demo')).isDemo).toBe(false)
    vi.resetModules()
    vi.stubEnv('VITE_LIVE_MODE', '')
    vi.stubGlobal('window', { api: {} })
    expect((await import('../../src/renderer/lib/demo')).isDemo).toBe(false)
  })
})
