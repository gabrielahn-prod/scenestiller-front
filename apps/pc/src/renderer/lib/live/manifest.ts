import type { VideoCodec } from '../../../shared/types'

/**
 * 시연 영상 목록 — apps/demo-web/scripts/demo-video.mjs 가 빌드 때 만든다.
 *
 * 영상 하나가 카메라 한 대다. 조각은 에이전트가 자르는 것과 같은 방식으로 미리 잘려 있고,
 * 재생 중 조각이 끝나는 순간마다 그 파일을 서버로 올린다.
 */

export interface DemoSegment {
  readonly url: string
  /** 영상 처음부터 이 조각이 시작하는 지점. */
  readonly offsetMs: number
  readonly durationMs: number
  readonly sizeBytes: number
}

export interface DemoVideo {
  /** 서버에 등록되는 카메라 id (agentCameraId). 파일 이름에서 나와 빌드마다 같다. */
  readonly id: string
  readonly name: string
  /** 화면에 트는 영상. 조각과 같은 인코딩이다. */
  readonly url: string
  readonly codec: VideoCodec
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly durationMs: number
  readonly segments: readonly DemoSegment[]
}

export interface DemoManifest {
  readonly segmentSeconds: number
  readonly videos: readonly DemoVideo[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isPositive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0

const isNonNegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0

/**
 * 모양이 틀린 항목은 버린다. 영상 하나가 깨졌다고 나머지 카메라까지 멈추면 안 된다.
 * 파일 경로는 manifest 위치 기준이라 여기서 절대 주소로 바꿔 둔다.
 */
export const parseManifest = (raw: unknown, manifestUrl: string): DemoManifest | null => {
  if (!isRecord(raw) || !Array.isArray(raw.videos) || !isPositive(raw.segmentSeconds)) return null
  const resolve = (file: string): string => new URL(file, manifestUrl).href

  const videos = raw.videos.flatMap((entry): DemoVideo[] => {
    if (!isRecord(entry) || !Array.isArray(entry.segments)) return []
    const { id, name, file, codec, width, height, fps, durationMs } = entry
    if (!isText(id) || !isText(name) || !isText(file)) return []
    if (codec !== 'h264' && codec !== 'h265') return []
    if (!isPositive(width) || !isPositive(height) || !isPositive(fps) || !isPositive(durationMs)) return []

    const segments = entry.segments.flatMap((segment): DemoSegment[] =>
      isRecord(segment) &&
      isText(segment.file) &&
      isNonNegative(segment.offsetMs) &&
      isPositive(segment.durationMs) &&
      isPositive(segment.sizeBytes)
        ? [{
            url: resolve(segment.file),
            offsetMs: segment.offsetMs,
            durationMs: segment.durationMs,
            sizeBytes: segment.sizeBytes,
          }]
        : [],
    )
    if (segments.length === 0) return []

    return [{ id, name, url: resolve(file), codec, width, height, fps, durationMs, segments }]
  })

  return { segmentSeconds: raw.segmentSeconds, videos }
}

/** 배포본에서 PC 앱은 `/<base>/pc/` 에 있고 영상은 한 칸 위 `/<base>/demo-video/` 에 있다. */
export const defaultManifestUrl = (): string => new URL('../demo-video/manifest.json', document.baseURI).href

export const loadManifest = async (
  fetchImpl: typeof fetch = fetch,
  url: string = defaultManifestUrl(),
): Promise<DemoManifest> => {
  const response = await fetchImpl(url, { cache: 'no-cache' })
  if (!response.ok) throw new Error(`시연 영상 목록을 찾을 수 없습니다 (HTTP ${response.status})`)
  const manifest = parseManifest(await response.json(), url)
  if (!manifest) throw new Error('시연 영상 목록의 형식이 올바르지 않습니다')
  return manifest
}
