import type { CameraRuntimeStatus, CameraStatus, SelectedCamera } from '../../shared/types'
import { nextDelayMs } from '../lib/backoff'
import type { SegmentEvent, SegmentRecorder } from './segment-recorder'
import type { SpoolStore } from './spool-store'

export interface RecorderFactoryArgs {
  readonly rtspUri: string
  readonly spoolDir: string
  readonly segmentSeconds: number
  readonly includeAudio: boolean
  readonly alignToClock: boolean
  readonly onSegment: (event: SegmentEvent) => void
  readonly onExit: (event: { code: number | null; stderr: string }) => void
  readonly onFlowing: () => void
}

export interface CameraWorkerDeps {
  readonly camera: SelectedCamera
  readonly spool: SpoolStore
  readonly spoolDir: string
  readonly segmentSeconds: number
  readonly includeAudio: boolean
  readonly alignToClock: boolean
  readonly createRecorder: (args: RecorderFactoryArgs) => SegmentRecorder
  /** 상태가 바뀌었다. Fleet 이 전체 상태를 다시 모아 화면에 보낸다. */
  readonly onChange: () => void
  /** 새 조각이 완성됐다. Fleet 의 업로드 루프를 깨운다. */
  readonly onSegment: () => void
  /** 미지정 시 조각 주기의 1.5배. */
  readonly stallTimeoutMs?: number
}

export interface CameraWorker {
  readonly camera: SelectedCamera
  readonly spool: SpoolStore
  start(): void
  stop(): Promise<void>
  status(): CameraRuntimeStatus
  /** Fleet 이 업로드 결과를 알려준다. 카메라별 집계는 여기 모인다. */
  noteUploaded(bytes: number, at: Date): void
  noteError(message: string | null): void
  setPending(count: number, bytes: number): void
}

/** RTSP 인증 실패는 재시도로 풀리지 않으므로 다른 연결 오류와 구분한다. */
export const isRtspAuthFailure = (stderr: string): boolean =>
  /401|unauthor|authentication failed/i.test(stderr)

/** ffmpeg stderr 은 길고 반복적이라 마지막 의미 있는 줄만 남긴다. */
export const summarizeStderr = (stderr: string): string =>
  stderr.split('\n').map((line) => line.trim()).filter(Boolean).at(-1) ?? '알 수 없는 오류'

const RESTART_BACKOFF = { baseMs: 1000, maxMs: 30_000 } as const

/**
 * 카메라 한 대를 맡는다. 녹화·재접속·조각 축출까지가 책임이고, 업로드는 하지 않는다.
 *
 * 업로드를 워커가 직접 하면 카메라 수만큼 동시 업로드가 일어나 매장 업링크를 다 먹는다.
 * 그래서 조각을 스풀에 놓는 데까지만 하고, 보내는 일은 Fleet 하나가 순서대로 맡는다.
 */
export const createCameraWorker = (deps: CameraWorkerDeps): CameraWorker => {
  const state = {
    running: false,
    recorder: null as SegmentRecorder | null,
    cameraStatus: 'idle' as CameraStatus,
    uploadedCount: 0,
    pendingCount: 0,
    lastUploadAt: null as string | null,
    spoolBytes: 0,
    lastError: null as string | null,
    spoolEvicted: false,
    attempt: 0,
    stallTimer: null as NodeJS.Timeout | null,
    restartTimer: null as NodeJS.Timeout | null,
  }

  const setCameraStatus = (next: CameraStatus): void => {
    if (state.cameraStatus === next) return
    state.cameraStatus = next
    deps.onChange()
  }

  const clearTimers = (): void => {
    if (state.stallTimer) clearTimeout(state.stallTimer)
    if (state.restartTimer) clearTimeout(state.restartTimer)
    state.stallTimer = null
    state.restartTimer = null
  }

  const armStallTimer = (): void => {
    if (state.stallTimer) clearTimeout(state.stallTimer)
    if (!state.running) return
    const timeoutMs = deps.stallTimeoutMs ?? deps.segmentSeconds * 1500
    state.stallTimer = setTimeout(() => void forceRestart(), timeoutMs)
  }

  const startRecorder = (): void => {
    if (!state.running) return
    state.recorder = deps.createRecorder({
      rtspUri: deps.camera.rtspUri,
      spoolDir: deps.spoolDir,
      segmentSeconds: deps.segmentSeconds,
      includeAudio: deps.includeAudio,
      alignToClock: deps.alignToClock,
      onSegment: handleSegment,
      onExit: handleExit,
      onFlowing: handleFlowing,
    })
    setCameraStatus('connecting')
    state.recorder.start()
    armStallTimer()
  }

  const forceRestart = async (): Promise<void> => {
    if (!state.running) return
    state.lastError = '스트림이 멈춰 재시작합니다'
    setCameraStatus('reconnecting')
    const recorder = state.recorder
    state.recorder = null
    await recorder?.stop()
    startRecorder()
  }

  /**
   * 영상이 들어오기 시작했다. 조각 완성을 기다리지 않고 바로 연결됨으로 바꾼다.
   * 5분 조각 설정에서 조각 완성만 기다리면 화면이 5분 내내 '연결 중'으로 남는다.
   */
  function handleFlowing(): void {
    if (!state.running) return
    state.attempt = 0
    state.lastError = null
    setCameraStatus('streaming')
  }

  function handleSegment(_event: SegmentEvent): void {
    state.attempt = 0
    setCameraStatus('streaming')
    armStallTimer()
    void (async () => {
      const evicted = await deps.spool.enforceLimit()
      if (evicted > 0) {
        state.spoolEvicted = true
        state.lastError = `저장 공간 상한을 넘어 오래된 조각 ${evicted}개를 버렸습니다`
        deps.onChange()
      }
      deps.onSegment()
    })()
  }

  function handleExit(event: { code: number | null; stderr: string }): void {
    if (!state.running) return
    state.recorder = null
    state.lastError = summarizeStderr(event.stderr)
    if (state.stallTimer) clearTimeout(state.stallTimer)
    state.stallTimer = null

    if (isRtspAuthFailure(event.stderr)) {
      setCameraStatus('auth-failed')
      return
    }
    setCameraStatus('reconnecting')
    state.restartTimer = setTimeout(() => startRecorder(), nextDelayMs(state.attempt++, RESTART_BACKOFF))
  }

  return {
    camera: deps.camera,
    spool: deps.spool,

    start: () => {
      if (state.running) return
      state.running = true
      state.attempt = 0
      state.spoolEvicted = false
      startRecorder()
    },

    stop: async () => {
      state.running = false
      clearTimers()
      const recorder = state.recorder
      state.recorder = null
      await recorder?.stop()
      state.cameraStatus = 'idle'
      deps.onChange()
    },

    status: () => ({
      cameraId: deps.camera.id,
      name: deps.camera.name,
      camera: state.cameraStatus,
      uploadedCount: state.uploadedCount,
      pendingCount: state.pendingCount,
      lastUploadAt: state.lastUploadAt,
      spoolBytes: state.spoolBytes,
      lastError: state.lastError,
      spoolEvicted: state.spoolEvicted,
    }),

    noteUploaded: (bytes, at) => {
      void bytes
      state.uploadedCount += 1
      state.lastUploadAt = at.toISOString()
    },

    noteError: (message) => {
      state.lastError = message
    },

    setPending: (count, bytes) => {
      state.pendingCount = count
      state.spoolBytes = bytes
    },
  }
}
