import { nextDelayMs } from '../../../main/lib/backoff'
import {
  AGENT_VERSION,
  DEFAULT_CONFIG,
  spoolLimitPerCamera,
  type AgentStatus,
  type CameraRuntimeStatus,
  type SegmentMeta,
  type SelectedCamera,
  type UploadStatus,
} from '../../../shared/types'
import { classifyStatus, segmentsEndpoint, type UploadResult } from '../../../shared/upload-policy'
import type { DemoManifest, DemoSegment, DemoVideo } from './manifest'

/**
 * 브라우저 수집기 — 실서버 데모에서 매장 PC 에이전트 대신 조각을 올린다.
 *
 * 카메라 입력만 테스트 영상으로 바뀌고 나머지는 에이전트와 같다:
 *  - 조각이 "다 찍힌" 순간(재생이 그 조각의 끝을 지난 순간) 올린다
 *  - 요청 모양은 POST /v1/segments 그대로 (multipart: meta + video, 기기 토큰)
 *  - 응답 해석·재시도는 에이전트와 같은 정책 (shared/upload-policy.ts)
 *
 * 영상은 한 번만 올린다. 반복하면 같은 사건으로 알림이 계속 가고, 탭을 열어 둔 동안 서버 분석이
 * 끝없이 쌓인다. 그래도 영상이 끝났다고 카메라를 끄지 않는다 — 실제 매장처럼 계속 '감시 중'이고,
 * 화면은 마지막 장면(사건이 지나간 뒤의 매장)에 머문다. 멈추는 것은 에이전트처럼 '일시 중지'뿐이다.
 * 다시 보려면 '일시 중지' → '감시 다시 시작'을 누르거나 페이지를 새로 연다.
 */

export const LIVE_AGENT_VERSION = `${AGENT_VERSION}-web-demo`

/** 조각이 끝나고 올리기까지. 에이전트도 파일이 닫힐 때까지 조금 기다린다. */
const FINALIZE_MS = 500
/** 한 조각을 몇 번까지 다시 보내 보나. 그 뒤에는 실패로 표시하고 다음 조각으로 간다. */
const MAX_ATTEMPTS = 8

export type SegmentPhase = 'pending' | 'uploading' | 'retrying' | 'uploaded' | 'failed'

export interface SegmentProgress {
  readonly key: string
  readonly cameraId: string
  readonly cameraName: string
  readonly index: number
  readonly total: number
  /** 이번 시연 시작부터 이 조각이 시작하는 지점. */
  readonly offsetMs: number
  readonly durationMs: number
  readonly startedAt: string
  readonly segmentId: string | null
  readonly phase: SegmentPhase
  readonly error: string | null
}

export type LivePhase = 'idle' | 'running' | 'finished' | 'stopped' | 'error'

export interface LiveProgress {
  readonly phase: LivePhase
  /** 화면에 그대로 띄울 한 줄. 문제가 있을 때만 채운다. */
  readonly message: string | null
  /** 이번 시연을 시작한 시각 (epoch ms). */
  readonly startedAt: number | null
  /** 가장 긴 영상 길이. 시연 한 번의 길이다. */
  readonly durationMs: number
  readonly segments: readonly SegmentProgress[]
}

export interface CollectorDeps {
  readonly manifest: DemoManifest
  readonly apiUrl: string
  readonly deviceToken: string
  readonly storeId: string
  readonly deviceId: string
  readonly fetch: typeof fetch
  readonly newSegmentId: () => string
  /** 처음에 '카메라'로 켜 둘 시연 영상 id들 (manifest.videos 의 부분집합). */
  readonly activeVideoIds: readonly string[]
  readonly now?: () => number
  readonly sleep?: (ms: number) => Promise<void>
}

export interface Collector {
  /** 처음부터 시작한다. 돌고 있었다면 그 시연은 버리고 새로 시작한다. */
  start(): void
  stop(): void
  /** 지금 '카메라'로 켜져 있는 시연 영상들. */
  readonly cameras: readonly SelectedCamera[]
  /** 켜 둘 카메라 집합을 바꾼다. 실제로 반영하려면 start() 를 다시 불러야 한다
   *  (카메라 추가/삭제 위저드가 서버 등록 뒤에 한다). */
  setActive(videoIds: readonly string[]): void
  status(): AgentStatus
  progress(): LiveProgress
  /** 화면 타일이 틀어야 할 지점(ms). 시작 전이면 0, 끝났으면 영상 끝. */
  playheadMs(cameraId: string): number
  onStatus(listener: (status: AgentStatus) => void): () => void
}

/** 화면과 서버가 아는 카메라 모양. id 가 곧 서버의 agentCameraId 다. */
export const cameraFor = (video: DemoVideo): SelectedCamera => ({
  id: video.id,
  name: video.name,
  manufacturer: null,
  model: '시연 영상',
  // 미리보기 요청의 열쇠로만 쓴다. 실제 RTSP 는 없다.
  rtspUri: `demo-video://${video.id}`,
  streamProfile: 'sub',
  codec: video.codec,
  width: video.width,
  height: video.height,
  fps: video.fps,
})

export const segmentKey = (cameraId: string, index: number): string => `${cameraId}:${index}`

/**
 * 조각 번호. 계약상 (기기, 카메라)마다 커지기만 하면 된다. 여러 사람이 같은 데모 계정으로
 * 동시에 돌려도 겹치지 않게 시작 시각(초)을 쓴다 — 0 부터 세면 탭마다 같은 번호가 난다.
 */
export const sequenceFor = (startedAtMs: number): number => Math.floor(startedAtMs / 1000)

export const buildSegmentMeta = (args: {
  readonly segmentId: string
  readonly storeId: string
  readonly deviceId: string
  readonly video: DemoVideo
  readonly segment: DemoSegment
  readonly startedAtMs: number
  readonly sizeBytes: number
}): SegmentMeta => {
  const { video, segment, startedAtMs } = args
  return {
    segmentId: args.segmentId,
    storeId: args.storeId,
    deviceId: args.deviceId,
    camera: {
      id: video.id,
      name: video.name,
      manufacturer: null,
      model: '시연 영상',
      streamProfile: 'sub',
    },
    video: {
      codec: video.codec,
      width: video.width,
      height: video.height,
      fps: video.fps,
      durationMs: segment.durationMs,
      sizeBytes: args.sizeBytes,
      container: 'mp4',
    },
    startedAt: new Date(startedAtMs).toISOString(),
    endedAt: new Date(startedAtMs + segment.durationMs).toISOString(),
    sequence: sequenceFor(startedAtMs),
    agentVersion: LIVE_AGENT_VERSION,
  }
}

const UPLOAD_ERROR_STATUS: Record<string, UploadStatus> = {
  auth: 'auth-failed',
  'too-large': 'payload-too-large',
}

interface Pass {
  readonly id: number
  readonly startedAt: number
  readonly timers: ReturnType<typeof setTimeout>[]
  cancelled: boolean
}

interface CameraCounters {
  uploadedCount: number
  lastUploadAt: string | null
  lastError: string | null
}

export const createCollector = (deps: CollectorDeps): Collector => {
  const now = deps.now ?? Date.now
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const videos = deps.manifest.videos
  const longestMs = videos.reduce((max, video) => Math.max(max, video.durationMs), 0)

  const statusListeners = new Set<(status: AgentStatus) => void>()

  const state = {
    pass: null as Pass | null,
    passCount: 0,
    phase: 'idle' as LivePhase,
    message: null as string | null,
    segments: new Map<string, SegmentProgress>(),
    counters: new Map<string, CameraCounters>(
      videos.map((video) => [video.id, { uploadedCount: 0, lastUploadAt: null, lastError: null }]),
    ),
    bytesUploaded: 0,
    fatal: null as UploadStatus | null,
    /** 조각 파일은 시연을 다시 해도 같으므로 한 번만 받는다. */
    blobs: new Map<string, Promise<Blob>>(),
    /** '카메라'로 켜져 있는 시연 영상 id (manifest.videos 의 부분집합) — 카메라 추가/삭제로 바뀐다. */
    activeIds: new Set<string>(deps.activeVideoIds),
  }

  /** 지금 켜져 있는 시연 영상만. */
  const activeVideos = (): DemoVideo[] => videos.filter((video) => state.activeIds.has(video.id))

  const counterOf = (cameraId: string): CameraCounters => {
    const counter = state.counters.get(cameraId)
    if (!counter) throw new Error(`모르는 카메라: ${cameraId}`)
    return counter
  }

  /** 멈추기(일시 중지 · 인증 실패) 전까지는 카메라가 켜져 있다. 영상이 끝나도 그렇다. */
  const cameraStreaming = (): boolean => {
    const pass = state.pass
    return pass !== null && !pass.cancelled
  }

  const segmentsOf = (cameraId: string): SegmentProgress[] =>
    [...state.segments.values()].filter((segment) => segment.cameraId === cameraId)

  const status = (): AgentStatus => {
    const all = [...state.segments.values()]
    const inFlight = all.filter((segment) => segment.phase === 'uploading' || segment.phase === 'retrying')
    const upload: UploadStatus =
      state.fatal ?? (all.some((segment) => segment.phase === 'retrying') ? 'retrying' : inFlight.length > 0 ? 'uploading' : 'idle')

    const streaming = cameraStreaming()
    const cameraStatuses: CameraRuntimeStatus[] = activeVideos().map((video) => {
      const counter = counterOf(video.id)
      return {
        cameraId: video.id,
        name: video.name,
        camera: streaming ? 'streaming' : 'idle',
        uploadedCount: counter.uploadedCount,
        pendingCount: segmentsOf(video.id).filter((s) => s.phase === 'uploading' || s.phase === 'retrying').length,
        lastUploadAt: counter.lastUploadAt,
        spoolBytes: 0,
        lastError: counter.lastError,
        spoolEvicted: false,
      }
    })

    return {
      running: cameraStatuses.some((camera) => camera.camera === 'streaming') || inFlight.length > 0,
      upload,
      cameras: cameraStatuses,
      bytesUploadedToday: state.bytesUploaded,
      spoolLimitBytesPerCamera: spoolLimitPerCamera(DEFAULT_CONFIG.spoolLimitBytes, Math.max(1, activeVideos().length)),
      lastError: state.message,
    }
  }

  const progress = (): LiveProgress => ({
    phase: state.phase,
    message: state.message,
    startedAt: state.pass?.startedAt ?? null,
    durationMs: longestMs,
    segments: [...state.segments.values()].sort(
      (a, b) => a.offsetMs - b.offsetMs || a.cameraName.localeCompare(b.cameraName, 'ko'),
    ),
  })

  const emit = (): void => {
    const next = status()
    statusListeners.forEach((listener) => listener(next))
  }

  const patchSegment = (key: string, patch: Partial<SegmentProgress>): void => {
    const current = state.segments.get(key)
    if (!current) return
    state.segments.set(key, { ...current, ...patch })
  }

  /** 모든 조각이 끝났으면 시연 한 번을 마친다. */
  const settleIfDone = (pass: Pass): void => {
    if (state.pass !== pass || pass.cancelled || state.phase !== 'running') return
    const all = [...state.segments.values()]
    const done = all.every((segment) => segment.phase === 'uploaded' || segment.phase === 'failed')
    if (!done) return
    state.phase = 'finished'
    emit()
  }

  const blobOf = (url: string): Promise<Blob> => {
    const cached = state.blobs.get(url)
    if (cached) return cached
    const loading = deps.fetch(url).then((response) => {
      if (!response.ok) throw new Error(`조각 파일을 읽지 못했습니다 (HTTP ${response.status})`)
      return response.blob()
    })
    state.blobs.set(url, loading)
    // 실패한 받기는 기억하지 않는다 — 다음 재시도에서 다시 받는다.
    loading.catch(() => state.blobs.delete(url))
    return loading
  }

  const sendOnce = async (meta: SegmentMeta, blob: Blob): Promise<UploadResult> => {
    const form = new FormData()
    form.append('meta', new Blob([JSON.stringify(meta)], { type: 'application/json' }))
    form.append('video', blob, `${meta.segmentId}.mp4`)
    try {
      const response = await deps.fetch(segmentsEndpoint(deps.apiUrl), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${deps.deviceToken}`,
          'idempotency-key': meta.segmentId,
        },
        body: form,
      })
      return classifyStatus(response.status)
    } catch (error) {
      // 서버에 닿지 못했다 (인터넷·CORS·서버 다운). 브라우저는 CORS 거부도 여기로 보낸다.
      return { kind: 'retry', reason: error instanceof Error ? error.message : '네트워크 오류' }
    }
  }

  const failPass = (pass: Pass, cause: UploadStatus, message: string): void => {
    if (state.pass !== pass) return
    state.fatal = cause
    state.message = message
    state.phase = 'error'
    pass.cancelled = true
    pass.timers.forEach((timer) => clearTimeout(timer))
    emit()
  }

  const uploadSegment = async (pass: Pass, video: DemoVideo, index: number): Promise<void> => {
    const segment = video.segments[index]
    // 예약된 뒤 카메라가 삭제됐을 수 있다 — 그새 빠졌으면 조용히 넘어간다.
    if (!segment || pass.cancelled || state.pass !== pass || !state.activeIds.has(video.id)) return
    const key = segmentKey(video.id, index)
    const startedAtMs = pass.startedAt + segment.offsetMs
    const segmentId = deps.newSegmentId()
    patchSegment(key, { phase: 'uploading', segmentId, error: null })
    emit()

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (pass.cancelled || state.pass !== pass) return

      const result = await blobOf(segment.url).then(
        (blob) =>
          sendOnce(
            buildSegmentMeta({
              segmentId,
              storeId: deps.storeId,
              deviceId: deps.deviceId,
              video,
              segment,
              startedAtMs,
              sizeBytes: blob.size,
            }),
            blob,
          ).then((outcome) => ({ outcome, bytes: blob.size })),
        (error: unknown) => ({
          outcome: { kind: 'retry', reason: error instanceof Error ? error.message : '조각 파일 오류' } as UploadResult,
          bytes: 0,
        }),
      )
      if (pass.cancelled || state.pass !== pass) return

      const { outcome } = result
      if (outcome.kind === 'ok' || outcome.kind === 'duplicate') {
        const counter = counterOf(video.id)
        counter.uploadedCount += 1
        counter.lastUploadAt = new Date(now()).toISOString()
        counter.lastError = null
        state.bytesUploaded += result.bytes
        patchSegment(key, { phase: 'uploaded', error: null })
        emit()
        settleIfDone(pass)
        return
      }

      if (outcome.kind === 'fatal') {
        counterOf(video.id).lastError = outcome.reason
        patchSegment(key, { phase: 'failed', error: outcome.reason })
        const cause = UPLOAD_ERROR_STATUS[outcome.cause]
        if (cause) {
          // 토큰이 틀렸거나 서버가 조각 크기를 거부한다 — 다음 조각도 똑같이 막힌다.
          failPass(pass, cause, `서버가 조각을 받지 않습니다: ${outcome.reason}`)
        } else {
          emit()
          settleIfDone(pass)
        }
        return
      }

      counterOf(video.id).lastError = outcome.reason
      patchSegment(key, { phase: 'retrying', error: outcome.reason })
      emit()
      await sleep(nextDelayMs(attempt, { baseMs: 1000, maxMs: 15_000 }))
    }

    patchSegment(key, { phase: 'failed', error: '여러 번 다시 보냈지만 서버에 닿지 않았습니다' })
    emit()
    settleIfDone(pass)
  }

  const stopPass = (): void => {
    const pass = state.pass
    if (!pass) return
    pass.cancelled = true
    pass.timers.forEach((timer) => clearTimeout(timer))
  }

  return {
    get cameras() {
      return activeVideos().map(cameraFor)
    },

    setActive: (videoIds) => {
      state.activeIds = new Set(videoIds)
    },

    start: () => {
      stopPass()
      if (videos.length === 0) {
        state.phase = 'error'
        state.message = '시연 영상이 없습니다. public/demo-video 에 영상을 넣고 다시 배포해 주세요.'
        state.segments = new Map()
        emit()
        return
      }

      const active = activeVideos()
      if (active.length === 0) {
        // 아직 아무 카메라도 추가하지 않았다 — 잘못된 상태가 아니라 정상적인 시작점이다.
        state.phase = 'idle'
        state.message = null
        state.segments = new Map()
        emit()
        return
      }

      state.passCount += 1
      const pass: Pass = { id: state.passCount, startedAt: now(), timers: [], cancelled: false }
      state.pass = pass
      state.phase = 'running'
      state.message = null
      state.fatal = null
      state.segments = new Map(
        active.flatMap((video) =>
          video.segments.map((segment, index): [string, SegmentProgress] => {
            const key = segmentKey(video.id, index)
            return [
              key,
              {
                key,
                cameraId: video.id,
                cameraName: video.name,
                index,
                total: video.segments.length,
                offsetMs: segment.offsetMs,
                durationMs: segment.durationMs,
                startedAt: new Date(pass.startedAt + segment.offsetMs).toISOString(),
                segmentId: null,
                phase: 'pending',
                error: null,
              },
            ]
          }),
        ),
      )

      active.forEach((video) => {
        video.segments.forEach((segment, index) => {
          const dueIn = segment.offsetMs + segment.durationMs + FINALIZE_MS
          pass.timers.push(setTimeout(() => void uploadSegment(pass, video, index), dueIn))
        })
      })
      emit()
    },

    stop: () => {
      stopPass()
      if (state.phase === 'running') state.phase = 'stopped'
      emit()
    },

    status,
    progress,

    playheadMs: (cameraId) => {
      const video = videos.find((candidate) => candidate.id === cameraId)
      const pass = state.pass
      if (!video || !pass) return 0
      return Math.min(Math.max(0, now() - pass.startedAt), video.durationMs)
    },

    onStatus: (listener) => {
      statusListeners.add(listener)
      return () => {
        statusListeners.delete(listener)
      }
    },
  }
}
