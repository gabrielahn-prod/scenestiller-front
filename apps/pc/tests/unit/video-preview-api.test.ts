import { describe, expect, it } from 'vitest'
import { createVideoPreviewApi } from '../../src/renderer/lib/live/video-preview-api'
import { manifestUrlForApp, type DemoManifest } from '../../src/renderer/lib/live/manifest'

const manifest: DemoManifest = {
  segmentSeconds: 30,
  videos: ['매장', '입구', '계산대'].map((name, index) => ({
    id: `demo-${index}`, name, url: `https://demo.test/wanted-test/demo-video/${index}/full.mp4`,
    codec: 'h264', width: 854, height: 480, fps: 25, durationMs: 60_000,
    segments: [],
  })),
}

describe('로그인 없는 CCTV 영상 미리보기', () => {
  it('로그인 요청 없이 원본 영상 세 개를 각각의 카메라로 연다', async () => {
    const { api, ready } = createVideoPreviewApi(async () => manifest)
    expect(await ready).toEqual({ ok: true, storeName: '데모 매장', cameraCount: 3 })
    expect((await api.authGetSession()).signedIn).toBe(true)
    const config = await api.getConfig()
    expect(config.cameras.map((camera) => camera.name)).toEqual(['매장', '입구', '계산대'])
    for (const [index, camera] of config.cameras.entries()) {
      expect(await api.previewStart(camera.rtspUri)).toEqual({ ok: true, url: manifest.videos[index]!.url })
    }
    expect((await api.getStatus()).cameras.every((camera) => camera.camera === 'streaming')).toBe(true)
  })

  it('서버 분석·업로드·위험 이벤트를 지어내지 않는다', async () => {
    const { api } = createVideoPreviewApi(async () => manifest)
    const status = await api.getStatus()
    expect(status.upload).toBe('offline')
    expect(status.bytesUploadedToday).toBe(0)
    expect(await api.serverRequest({ method: 'GET', path: '/stores/video-preview/events?limit=10' }))
      .toEqual({ ok: true, status: 200, data: { items: [], nextCursor: null } })
    const monitoring = await api.serverRequest({ method: 'GET', path: '/stores/video-preview/monitoring' })
    expect(monitoring.ok && (monitoring.data as { lastAnalyzedAt: unknown }).lastAnalyzedAt).toBeNull()
    expect((await api.serverRequest({ method: 'DELETE', path: '/cameras/demo-0' })).ok).toBe(false)
  })

  it('일시 중지와 다시 시작을 모든 카메라와 구독자에게 반영한다', async () => {
    const { api, ready } = createVideoPreviewApi(async () => manifest)
    await ready
    const updates: boolean[] = []
    const off = api.onStatus((status) => updates.push(status.running))
    await api.stop()
    expect((await api.getStatus()).cameras.every((camera) => camera.camera === 'idle')).toBe(true)
    await api.start((await api.getConfig()).cameras)
    expect(updates).toEqual([false, true])
    off()
    await api.stop()
    expect(updates).toEqual([false, true])
  })

  it('영상이 없거나 목록을 불러오지 못하면 시작 실패를 반환한다', async () => {
    expect((await createVideoPreviewApi(async () => ({ ...manifest, videos: [] })).ready).ok).toBe(false)
    expect(await createVideoPreviewApi(async () => { throw new Error('목록 오류') }).ready)
      .toEqual({ ok: false, message: '목록 오류' })
  })

  it('앱 주소의 마지막 슬래시와 무관하게 빌드 경로로 영상 목록을 찾는다', () => {
    expect(manifestUrlForApp('/wanted-test/pc/', 'https://demo.test'))
      .toBe('https://demo.test/wanted-test/demo-video/manifest.json')
  })
})
