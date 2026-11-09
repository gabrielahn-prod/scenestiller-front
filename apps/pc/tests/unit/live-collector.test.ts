import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCollector, sequenceFor, type CollectorDeps } from '../../src/renderer/lib/live/collector'
import { parseManifest, type DemoManifest } from '../../src/renderer/lib/live/manifest'
import type { SegmentMeta } from '../../src/shared/types'

const MANIFEST_URL = 'https://demo.test/demo-video/manifest.json'
const START = Date.parse('2026-09-18T05:00:00.000Z')

const rawManifest = {
  version: 1,
  segmentSeconds: 30,
  videos: [
    {
      id: 'demo-aaaa1111',
      name: '계산대',
      source: '01-계산대.mp4',
      file: 'demo-aaaa1111/full.mp4',
      codec: 'h264',
      width: 854,
      height: 480,
      fps: 15,
      durationMs: 70_000,
      segments: [
        { file: 'demo-aaaa1111/seg-000.mp4', offsetMs: 0, durationMs: 30_000, sizeBytes: 3 },
        { file: 'demo-aaaa1111/seg-001.mp4', offsetMs: 30_000, durationMs: 30_000, sizeBytes: 3 },
        { file: 'demo-aaaa1111/seg-002.mp4', offsetMs: 60_000, durationMs: 10_000, sizeBytes: 3 },
      ],
    },
  ],
}

const manifest = (): DemoManifest => {
  const parsed = parseManifest(rawManifest, MANIFEST_URL)
  if (!parsed) throw new Error('manifest')
  return parsed
}

interface Upload {
  readonly meta: SegmentMeta
  readonly headers: Record<string, string>
  readonly videoName: string
  readonly videoSize: number
}

/** 조각 파일 GET 과 POST /v1/segments 를 흉내 낸다. 응답 코드는 차례로 꺼내 쓴다. */
const fakeServer = (statuses: number[] = []) => {
  const uploads: Upload[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url.endsWith('.mp4')) return new Response(new Blob([new Uint8Array([1, 2, 3])]))
    if (url === 'https://api.test/v1/segments' && init?.method === 'POST') {
      const form = init.body as FormData
      const meta = JSON.parse(await (form.get('meta') as Blob).text()) as SegmentMeta
      const video = form.get('video') as File
      uploads.push({
        meta,
        headers: init.headers as Record<string, string>,
        videoName: video.name,
        videoSize: video.size,
      })
      return new Response(null, { status: statuses.shift() ?? 201 })
    }
    return new Response(null, { status: 404 })
  })
  return { uploads, fetchMock }
}

const setup = (statuses: number[] = []) => {
  const server = fakeServer(statuses)
  let id = 0
  const m = manifest()
  const deps: CollectorDeps = {
    manifest: m,
    // 예전엔 manifest 의 영상 전부가 곧 카메라였다 — 테스트는 그 전제를 그대로 쓴다.
    activeVideoIds: m.videos.map((video) => video.id),
    apiUrl: 'https://api.test/',
    deviceToken: 'ss_dev_demo',
    storeId: 'store-1',
    deviceId: 'pc-demo',
    fetch: server.fetchMock as unknown as typeof fetch,
    newSegmentId: () => `seg-${(id += 1)}`,
    sleep: async () => undefined,
  }
  return { ...server, collector: createCollector(deps) }
}

/**
 * 타이머를 돌리고, 그 사이 걸린 업로드가 끝날 때까지 기다린다.
 * Blob 읽기는 Node 내부에서 setImmediate 로 돈다 — 그건 진짜로 두고 여기서 몇 바퀴 흘려보낸다.
 */
const advance = async (ms: number): Promise<void> => {
  await vi.advanceTimersByTimeAsync(ms)
  for (let i = 0; i < 20; i += 1) await new Promise<void>((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(START)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('parseManifest', () => {
  it('파일 경로를 manifest 위치 기준의 절대 주소로 바꾼다', () => {
    const parsed = manifest()
    expect(parsed.segmentSeconds).toBe(30)
    expect(parsed.videos[0]?.url).toBe('https://demo.test/demo-video/demo-aaaa1111/full.mp4')
    expect(parsed.videos[0]?.segments[1]?.url).toBe('https://demo.test/demo-video/demo-aaaa1111/seg-001.mp4')
  })

  it('모양이 틀린 영상만 버리고 나머지는 살린다', () => {
    const parsed = parseManifest(
      { ...rawManifest, videos: [...rawManifest.videos, { id: 'broken', segments: [] }] },
      MANIFEST_URL,
    )
    expect(parsed?.videos.map((video) => video.id)).toEqual(['demo-aaaa1111'])
  })

  it('목록 자체가 아니면 null', () => {
    expect(parseManifest({ videos: 'nope' }, MANIFEST_URL)).toBeNull()
  })
})

describe('createCollector', () => {
  it('조각은 재생이 그 조각의 끝을 지난 뒤에야 올린다', async () => {
    const { collector, uploads } = setup()
    collector.start()

    await advance(29_000)
    expect(uploads).toHaveLength(0)

    await advance(2_000)
    expect(uploads).toHaveLength(1)
  })

  it('에이전트와 같은 모양으로 올린다 — 기기 토큰, 멱등 키, 조각 시각은 재생한 실제 시각', async () => {
    const { collector, uploads } = setup()
    collector.start()
    await advance(31_000)

    const [first] = uploads
    expect(first?.headers).toMatchObject({ authorization: 'Bearer ss_dev_demo', 'idempotency-key': 'seg-1' })
    expect(first?.videoName).toBe('seg-1.mp4')
    expect(first?.videoSize).toBe(3)
    expect(first?.meta).toMatchObject({
      segmentId: 'seg-1',
      storeId: 'store-1',
      deviceId: 'pc-demo',
      camera: { id: 'demo-aaaa1111', name: '계산대', streamProfile: 'sub' },
      video: { codec: 'h264', width: 854, height: 480, fps: 15, durationMs: 30_000, sizeBytes: 3, container: 'mp4' },
      startedAt: '2026-09-18T05:00:00.000Z',
      endedAt: '2026-09-18T05:00:30.000Z',
      sequence: sequenceFor(START),
    })
  })

  it('영상은 한 번만 올린다 — 끝난 뒤에도 카메라는 켜져 있고, 멈추는 것은 일시 중지뿐이다', async () => {
    const { collector, uploads } = setup()
    collector.start()
    expect(collector.status().cameras[0]?.camera).toBe('streaming')

    await advance(31_000)
    await advance(30_000)
    await advance(14_000)
    expect(uploads.map((upload) => upload.meta.startedAt)).toEqual([
      '2026-09-18T05:00:00.000Z',
      '2026-09-18T05:00:30.000Z',
      '2026-09-18T05:01:00.000Z',
    ])
    expect(uploads[2]?.meta.video.durationMs).toBe(10_000)
    expect(collector.progress().phase).toBe('finished')
    expect(collector.status()).toMatchObject({ running: true, upload: 'idle' })
    expect(collector.status().cameras[0]).toMatchObject({ camera: 'streaming', uploadedCount: 3 })

    await advance(120_000)
    expect(uploads).toHaveLength(3)
    expect(collector.status().cameras[0]?.camera).toBe('streaming')

    collector.stop()
    expect(collector.status()).toMatchObject({ running: false })
    expect(collector.status().cameras[0]?.camera).toBe('idle')
  })

  it('서버가 잠깐 죽으면 같은 조각 번호로 다시 보낸다', async () => {
    const { collector, uploads } = setup([503, 503])
    collector.start()
    await advance(31_000)

    expect(uploads.map((upload) => upload.meta.segmentId)).toEqual(['seg-1', 'seg-1', 'seg-1'])
    expect(collector.progress().segments[0]?.phase).toBe('uploaded')
  })

  it('토큰이 틀리면 즉시 멈추고 이유를 남긴다 — 다음 조각도 똑같이 막힌다', async () => {
    const { collector, uploads } = setup([401])
    collector.start()
    await advance(31_000)
    await advance(45_000)

    expect(uploads).toHaveLength(1)
    expect(collector.progress().phase).toBe('error')
    expect(collector.progress().message).toContain('인증 실패')
    expect(collector.status().upload).toBe('auth-failed')
  })

  it('처음부터 다시 하면 이전 시연의 예약은 버린다', async () => {
    const { collector, uploads } = setup()
    collector.start()
    await advance(20_000)
    collector.start()
    await advance(20_000)
    expect(uploads).toHaveLength(0)

    await advance(11_000)
    expect(uploads).toHaveLength(1)
    expect(uploads[0]?.meta.startedAt).toBe('2026-09-18T05:00:20.000Z')
  })

  it('화면 타일은 수집기가 올리고 있는 지점부터 튼다', async () => {
    const { collector } = setup()
    expect(collector.playheadMs('demo-aaaa1111')).toBe(0)
    collector.start()
    await advance(12_500)
    expect(collector.playheadMs('demo-aaaa1111')).toBe(12_500)
    await advance(100_000)
    expect(collector.playheadMs('demo-aaaa1111')).toBe(70_000)
  })
})
