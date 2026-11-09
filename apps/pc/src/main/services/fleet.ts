import { join } from 'node:path'
import {
  AGENT_VERSION,
  spoolLimitPerCamera,
  type AgentStatus,
  type SegmentMeta,
  type SelectedCamera,
  type UploadStatus,
} from '../../shared/types'
import { nextDelayMs } from '../lib/backoff'
import { cameraKey } from '../lib/camera-key'
import { createCameraWorker, type CameraWorker, type RecorderFactoryArgs } from './camera-worker'
import type { ConfigStore } from './config-store'
import type { ProbedMedia } from './media-probe'
import type { SegmentRecorder } from './segment-recorder'
import type { SpoolEntry, SpoolStore } from './spool-store'
import type { UploadArgs, UploadResult } from './uploader'

export interface FleetDeps {
  readonly config: ConfigStore
  readonly spoolRoot: string
  readonly createRecorder: (args: RecorderFactoryArgs) => SegmentRecorder
  readonly createSpool: (dir: string, limitBytes: number) => SpoolStore
  readonly upload: (args: UploadArgs) => Promise<UploadResult>
  readonly probeMedia: (path: string) => Promise<ProbedMedia | null>
  readonly newSegmentId: () => string
  readonly now: () => Date
  readonly delay: (ms: number) => Promise<void>
  readonly onStatus: (status: AgentStatus) => void
  readonly idleMs?: number
  readonly stallTimeoutMs?: number
}

export interface Fleet {
  start(cameras: readonly SelectedCamera[]): Promise<void>
  stop(): Promise<void>
  status(): AgentStatus
}

const UPLOAD_BACKOFF = { baseMs: 1000, maxMs: 300_000 } as const

/**
 * 카메라 여러 대를 함께 돌린다.
 *
 * 녹화는 카메라마다 독립이지만 업로드는 전체가 하나다. 카메라마다 따로 올리면
 * 대수만큼 동시 업로드가 일어나 매장 업링크를 다 먹기 때문이다.
 * 대신 카메라를 돌아가며 하나씩 집어(라운드로빈) 한 카메라가 밀렸다고
 * 다른 카메라가 굶지 않게 한다.
 */
export const createFleet = (deps: FleetDeps): Fleet => {
  const idleMs = deps.idleMs ?? 500

  const state = {
    running: false,
    workers: [] as CameraWorker[],
    uploadStatus: 'idle' as UploadStatus,
    bytesUploadedToday: 0,
    todayKey: '',
    lastError: null as string | null,
    uploadAttempt: 0,
    rotation: 0,
    loopRunning: false,
    loopPromise: null as Promise<void> | null,
    metaByPath: new Map<string, SegmentMeta>(),
  }

  const status = (): AgentStatus => ({
    running: state.running,
    upload: state.uploadStatus,
    cameras: state.workers.map((worker) => worker.status()),
    bytesUploadedToday: state.bytesUploadedToday,
    spoolLimitBytesPerCamera: spoolLimitPerCamera(
      deps.config.read().spoolLimitBytes,
      Math.max(1, state.workers.length),
    ),
    lastError: state.lastError,
  })

  const emit = (): void => deps.onStatus(status())

  const setUploadStatus = (next: UploadStatus): void => {
    if (state.uploadStatus === next) return
    state.uploadStatus = next
    emit()
  }

  const recordUploadedBytes = (bytes: number): void => {
    const today = deps.now().toISOString().slice(0, 10)
    const carried = state.todayKey === today ? state.bytesUploadedToday : 0
    state.todayKey = today
    state.bytesUploadedToday = carried + bytes
  }

  const refreshPending = async (): Promise<void> => {
    await Promise.all(
      state.workers.map(async (worker) => {
        const entries = await worker.spool.list()
        worker.setPending(entries.length, entries.reduce((sum, e) => sum + e.sizeBytes, 0))
      }),
    )
  }

  /**
   * 다음에 올릴 조각을 고른다.
   * 마지막에 올린 카메라의 다음 순서부터 훑어 공정하게 돌아간다.
   */
  const pickNext = async (): Promise<{ worker: CameraWorker; entry: SpoolEntry } | null> => {
    const count = state.workers.length
    for (let step = 1; step <= count; step += 1) {
      const index = (state.rotation + step) % count
      const worker = state.workers[index]
      if (!worker) continue
      const entry = await worker.spool.oldest()
      if (entry) {
        state.rotation = index
        return { worker, entry }
      }
    }
    return null
  }

  /**
   * 조각 하나의 meta 를 만들고 경로별로 기억해 둔다.
   *
   * 캐시가 핵심이다. 재시도할 때마다 새 segmentId 를 뽑으면 백엔드에 같은 5분이
   * 여러 건으로 저장되어 멱등성이 무너지고 알림이 중복 발송된다.
   */
  const metaFor = async (worker: CameraWorker, entry: SpoolEntry): Promise<SegmentMeta | null> => {
    const cached = state.metaByPath.get(entry.path)
    if (cached) return cached

    const probed = await deps.probeMedia(entry.path)
    if (!probed) return null

    const config = deps.config.read()
    const camera = worker.camera
    const meta: SegmentMeta = {
      segmentId: deps.newSegmentId(),
      storeId: config.storeId,
      deviceId: config.deviceId,
      camera: {
        id: camera.id,
        name: camera.name,
        manufacturer: camera.manufacturer,
        model: camera.model,
        streamProfile: camera.streamProfile,
      },
      video: {
        codec: probed.codec,
        width: probed.width,
        height: probed.height,
        fps: probed.fps,
        durationMs: probed.durationMs,
        sizeBytes: entry.sizeBytes,
        container: 'mp4',
      },
      // 파일명에 새겨진 시각은 조각이 '닫힌' 시각이다. 시작 시각은 실제 길이를 빼서 구한다.
      startedAt: new Date(entry.closedAt.getTime() - probed.durationMs).toISOString(),
      endedAt: entry.closedAt.toISOString(),
      sequence: deps.config.nextSequence(camera.id),
      agentVersion: AGENT_VERSION,
    }
    state.metaByPath.set(entry.path, meta)
    return meta
  }

  const runUploadLoop = async (): Promise<void> => {
    while (state.running) {
      await refreshPending()
      const next = await pickNext()
      if (!next) {
        setUploadStatus('idle')
        await deps.delay(idleMs)
        continue
      }

      const { worker, entry } = next
      const meta = await metaFor(worker, entry)
      if (!meta) {
        // ffprobe 가 못 읽는 조각은 재시도해도 못 읽는다. 스풀을 막지 않도록 버린다.
        worker.noteError(`읽을 수 없는 조각을 버렸습니다: ${entry.name}`)
        await worker.spool.remove(entry.path)
        continue
      }

      setUploadStatus('uploading')
      const config = deps.config.read()
      const result = await deps.upload({
        baseUrl: config.backendBaseUrl,
        token: config.deviceToken,
        meta,
        filePath: entry.path,
      })

      if (result.kind === 'ok' || result.kind === 'duplicate') {
        await worker.spool.remove(entry.path)
        state.metaByPath.delete(entry.path)
        worker.noteUploaded(entry.sizeBytes, deps.now())
        recordUploadedBytes(entry.sizeBytes)
        state.uploadAttempt = 0
        state.lastError = null
        continue
      }

      if (result.kind === 'retry') {
        state.lastError = result.reason
        // 서버에 닿기는 했으면 retrying, 아예 못 닿았으면 offline.
        setUploadStatus(result.reason.startsWith('HTTP ') ? 'retrying' : 'offline')
        await deps.delay(nextDelayMs(state.uploadAttempt++, UPLOAD_BACKOFF))
        continue
      }

      if (result.cause === 'missing-file') {
        state.metaByPath.delete(entry.path)
        continue
      }

      // 인증 실패나 용량 초과는 재시도로 풀리지 않는다. 조각은 남겨 두고 사람을 부른다.
      state.lastError = result.reason
      setUploadStatus(result.cause === 'auth' ? 'auth-failed' : 'payload-too-large')
      return
    }
  }

  const kickUploadLoop = (): void => {
    if (state.uploadStatus === 'auth-failed' || state.uploadStatus === 'payload-too-large') return
    if (state.loopRunning || !state.running) return
    state.loopRunning = true
    state.loopPromise = runUploadLoop().finally(() => {
      state.loopRunning = false
    })
  }

  const stop = async (): Promise<void> => {
    state.running = false
    const loop = state.loopPromise
    await Promise.all(state.workers.map((worker) => worker.stop()))
    // 루프가 파일을 만지는 도중에 호출자가 디렉토리를 지우면 곤란하다. 끝날 때까지 기다린다.
    await loop
    state.loopPromise = null
    // 워커는 남겨 둔다. 중지했다고 화면에서 카메라 카드가 사라지면
    // 사용자는 설정이 날아간 줄 안다. 목록은 start() 에서만 갈아끼운다.
    emit()
  }

  return {
    status,
    stop,

    start: async (cameras) => {
      await stop()
      state.workers = []
      deps.config.write({ cameras })
      const config = deps.config.read()
      const perCamera = spoolLimitPerCamera(config.spoolLimitBytes, Math.max(1, cameras.length))

      state.running = true
      state.uploadStatus = 'idle'
      state.uploadAttempt = 0
      state.rotation = 0
      state.lastError = null
      state.metaByPath.clear()

      state.workers = cameras.map((camera) => {
        const dir = join(deps.spoolRoot, cameraKey(camera.id))
        return createCameraWorker({
          camera,
          spool: deps.createSpool(dir, perCamera),
          spoolDir: dir,
          segmentSeconds: config.segmentSeconds,
          includeAudio: config.includeAudio,
          alignToClock: config.alignToClock,
          createRecorder: deps.createRecorder,
          onChange: emit,
          onSegment: kickUploadLoop,
          ...(deps.stallTimeoutMs === undefined ? {} : { stallTimeoutMs: deps.stallTimeoutMs }),
        })
      })

      state.workers.forEach((worker) => worker.start())
      kickUploadLoop()
      emit()
    },
  }
}
