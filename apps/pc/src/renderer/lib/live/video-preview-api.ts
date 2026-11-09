import type { AgentApi, ServerResult } from '../../../shared/ipc'
import type { MonitoringCamera, StoreDto } from '../../../shared/server-types'
import { DEFAULT_CONFIG, type AgentConfig, type AgentStatus } from '../../../shared/types'
import { loadManifest, type DemoManifest } from './manifest'
import type { LiveBootResult } from './live-api'

/** 서버 설정이 없는 새 배포에서도 시연 영상은 바로 볼 수 있다. 분석 결과는 만들지 않는다. */
export const createVideoPreviewApi = (load: () => Promise<DemoManifest> = loadManifest) => {
  let manifest: DemoManifest | null = null
  let running = true
  let config: AgentConfig = { ...DEFAULT_CONFIG, deviceId: 'video-preview', storeId: 'video-preview' }
  const listeners = new Set<(status: AgentStatus) => void>()
  const status = (): AgentStatus => ({
    running,
    upload: 'offline',
    cameras: config.cameras.map((camera) => ({
      cameraId: camera.id, name: camera.name, camera: running ? 'streaming' : 'idle',
      uploadedCount: 0, pendingCount: 0, lastUploadAt: null,
      spoolBytes: 0, lastError: null, spoolEvicted: false,
    })),
    bytesUploadedToday: 0,
    spoolLimitBytesPerCamera: DEFAULT_CONFIG.spoolLimitBytes,
    lastError: null,
  })
  const emitStatus = () => listeners.forEach((listener) => listener(status()))
  const ready: Promise<LiveBootResult> = load().then((loaded): LiveBootResult => {
    if (loaded.videos.length === 0) return { ok: false, message: '재생할 시연 영상이 없습니다.' }
    manifest = loaded
    config = {
      ...config,
      segmentSeconds: loaded.segmentSeconds,
      cameras: loaded.videos.slice(0, 8).map((video) => ({
        id: video.id, name: video.name, manufacturer: null, model: null,
        rtspUri: `demo-video://${video.id}`, streamProfile: 'sub',
        codec: video.codec, width: video.width, height: video.height, fps: video.fps,
      })),
    }
    return { ok: true, storeName: '데모 매장', cameraCount: config.cameras.length }
  }).catch((error: unknown) => ({
    ok: false, message: error instanceof Error ? error.message : '시연 영상을 불러오지 못했습니다.',
  }))

  const cameras = (): MonitoringCamera[] => config.cameras.map((camera, index) => ({
    id: camera.id, agentCameraId: camera.id, storeId: config.storeId,
    name: camera.name, locationTag: null, sortOrder: index, streamProfile: 'sub',
    state: running ? 'connected' : 'unknown', lastFrameAt: null,
    lastSegmentAt: null, disconnectedForSec: null,
  }))
  const store = (): StoreDto => ({
    id: config.storeId, name: '데모 매장', address: null, opensAt: null, closesAt: null,
    segmentSeconds: 30, clipRetentionDays: 7, cameraCount: config.cameras.length,
    device: null, unconfirmedCount: 0,
  })
  const ok = (data: unknown): ServerResult => ({ ok: true, status: 200, data })
  const unavailable = { ok: false as const, message: '서버 연결 후 사용할 수 있습니다.' }
  const api: AgentApi = {
    discover: async () => ({ ok: true, cameras: [] }),
    probe: async () => ({ ...unavailable, kind: 'unreachable' }),
    probeRtsp: async () => ({ ...unavailable, kind: 'unreachable' }),
    snapshot: async () => unavailable,
    previewStart: async (uri) => {
      await ready
      const video = manifest?.videos.find((video) => uri === `demo-video://${video.id}`)
      return video ? { ok: true, url: video.url } : { ok: false, message: '영상을 찾을 수 없습니다.' }
    },
    previewStop: async () => undefined,
    start: async () => { running = true; emitStatus() },
    stop: async () => { running = false; emitStatus() },
    getConfig: async () => { await ready; return config },
    setConfig: async (patch) => { await ready; config = { ...config, ...patch }; return config },
    getStatus: async () => { await ready; return status() },
    onStatus: (listener) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    openSpoolFolder: async () => undefined,
    authSendOtp: async () => unavailable,
    authVerifyOtp: async () => unavailable,
    authSignOut: async () => { window.location.reload() },
    authGetSession: async () => ({ signedIn: true, userId: 'video-preview', phone: '데모' }),
    serverRequest: async (request) => {
      await ready
      if (request.method !== 'GET') return { ok: false, status: 503, error: unavailable.message }
      const path = request.path.split('?')[0]
      if (path === '/stores') return ok({ stores: [store()] })
      if (path === `/stores/${config.storeId}/monitoring`) return ok({
        device: null, segmentSeconds: config.segmentSeconds, cameras: cameras(),
        lastAnalyzedAt: null, monitoringCount: running ? config.cameras.length : 0,
        totalCount: config.cameras.length,
      })
      if (path === `/stores/${config.storeId}/cameras`) return ok({ cameras: cameras() })
      if (path === `/stores/${config.storeId}/events`) return ok({ items: [], nextCursor: null })
      if (path === `/stores/${config.storeId}/events/unconfirmed-count`) return ok({ count: 0 })
      return { ok: false, status: 503, error: unavailable.message }
    },
    serverStreamStart: async () => undefined,
    serverStreamStop: async () => undefined,
    onServerStream: () => () => undefined,
    onServerStreamState: () => () => undefined,
    attention: async () => undefined,
    openExternal: async (url) => { window.open(url, '_blank', 'noopener'); return true },
    copyText: async (text) => { await navigator.clipboard?.writeText(text) },
  }
  return { api, ready, manifest: () => manifest }
}
