import { ulid } from 'ulid'
import { createHeartbeat } from '../../../main/services/heartbeat'
import { createServerClient } from '../../../main/services/server-client'
import { createServerSession, SessionError, type SessionTokens, type TokenStore } from '../../../main/services/server-session'
import { createServerStream } from '../../../main/services/server-stream'
import type { AgentApi, ServerRequest, ServerResult, SessionSummary, StreamConnectionState } from '../../../shared/ipc'
import type { ServerStreamMessage, StoreDto } from '../../../shared/server-types'
import { DEFAULT_CONFIG, type AgentConfig, type AgentStatus } from '../../../shared/types'
import { createCollector, type Collector } from './collector'
import { liveConfig, missingLiveConfig, type LiveConfig } from './config'
import { loadManifest, type DemoManifest, type DemoVideo } from './manifest'

/**
 * 실서버 데모의 AgentApi — Electron 의 preload 가 주는 것과 같은 모양이다.
 * 화면들은 자기가 데모인지 모른다.
 *
 * 서버 쪽 절반(로그인·API·실시간 채널·하트비트)은 메인 프로세스의 모듈을 그대로 쓴다.
 * 전부 fetch 만 쓰도록 짜여 있어서 브라우저에서도 돈다. 에이전트 쪽 절반(카메라 검색·
 * RTSP·ffmpeg)만 시연 영상 수집기(collector.ts)로 바뀐다.
 */

export type LiveBootResult =
  | { readonly ok: true; readonly storeName: string; readonly cameraCount: number }
  | { readonly ok: false; readonly message: string }

/** 바깥 데모 셸(/wanted-test)이 iframe 너머로 보는 손잡이. 시작하지 못했을 때 이유를 띄우는 데만 쓴다. */
export interface LiveDemoControl {
  readonly configMissing: readonly string[]
  readonly ready: Promise<LiveBootResult>
}

declare global {
  interface Window {
    __sceneStealerLive?: LiveDemoControl
  }
}

/**
 * '카메라 추가' 위저드(AddCamera.tsx)가 쓰는 손잡이 — 시연 영상 풀을 읽기만 한다.
 * `createLiveApi`(모듈당 한 번, api.ts 가 부른다)의 클로저 밖에서도 풀을 볼 수 있게
 * 모듈 스코프에 둔다. `AgentApi`(Electron 앱과 공유하는 타입)에는 넣지 않는다 — 이 기능은
 * 실서버 데모에만 있다.
 */
let latestManifest: (() => DemoManifest | null) | null = null
let latestReady: Promise<LiveBootResult> | null = null

export const liveDemoState = {
  /** 시연 영상 전체 목록(=카메라 후보 풀). 아직 boot 이 안 끝났으면 빈 배열. */
  videos: (): readonly DemoVideo[] => latestManifest?.()?.videos ?? [],
  /** boot 이 끝날 때까지 기다린다. */
  ready: (): Promise<LiveBootResult> =>
    latestReady ?? Promise.resolve({ ok: false, message: '아직 시작되지 않았습니다' }),
}

const SESSION_KEY = 'scene-stealer:live:session'
/** 매장 PC 앱의 카메라 검색 시간 (main/ipc.ts). */
const DISCOVER_MS = 5000

/** 탭을 닫으면 사라지는 세션 저장소. 새로고침해도 다시 로그인하지 않게만 한다. */
const tabTokenStore = (): TokenStore => ({
  load: () => {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw) as SessionTokens) : null
    } catch {
      return null
    }
  },
  save: (tokens) => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(tokens))
    } catch {
      // 저장이 막혀도 이 탭 안에서는 메모리로 돈다.
    }
  },
  clear: () => {
    try {
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      // 위와 같다.
    }
  },
})

const idleStatus: AgentStatus = {
  running: false,
  upload: 'idle',
  cameras: [],
  bytesUploadedToday: 0,
  spoolLimitBytesPerCamera: DEFAULT_CONFIG.spoolLimitBytes,
  lastError: null,
}

export const createLiveApi = (config: LiveConfig = liveConfig): AgentApi => {
  // 브라우저의 fetch 는 window 에 묶여 있어야 한다. 그냥 넘기면 'Illegal invocation'.
  const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init)

  const session = createServerSession({
    getConfig: () => ({ supabaseUrl: config.supabaseUrl, supabaseAnonKey: config.supabaseAnonKey }),
    fetch: browserFetch,
    store: tabTokenStore(),
  })
  const client = createServerClient({ getBaseUrl: () => config.apiUrl, session, fetch: browserFetch })

  const streamListeners = new Set<(message: ServerStreamMessage) => void>()
  const streamStateListeners = new Set<(state: StreamConnectionState) => void>()
  const stream = createServerStream({
    getBaseUrl: () => config.apiUrl,
    session,
    fetch: browserFetch,
    onMessage: (message) => streamListeners.forEach((listener) => listener(message)),
    onState: (next) => streamStateListeners.forEach((listener) => listener(next)),
  })

  const statusListeners = new Set<(status: AgentStatus) => void>()

  const state = {
    config: {
      ...DEFAULT_CONFIG,
      deviceId: 'web-demo',
      backendBaseUrl: config.apiUrl,
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      deviceToken: config.deviceToken,
    } as AgentConfig,
    collector: null as Collector | null,
    manifest: null as DemoManifest | null,
  }

  const summary = (): SessionSummary => {
    const current = session.summary()
    return current ? { signedIn: true, ...current } : { signedIn: false }
  }

  const request = (req: ServerRequest): Promise<ServerResult> => client.request(req)

  const fail = (message: string): LiveBootResult => ({ ok: false, message })

  const boot = async (): Promise<LiveBootResult> => {
    const missing = missingLiveConfig(config)
    if (missing.length > 0) {
      return fail(`실서버 설정이 이 배포에 없습니다: ${missing.join(', ')}`)
    }

    // 1) 데모 계정 로그인. 이 탭에서 이미 했으면 그 세션을 쓴다(만료가 가까우면 갱신).
    const existing = session.summary() ? await session.accessToken() : null
    if (!existing) {
      try {
        await session.signInWithPassword(config.email, config.password)
      } catch (error) {
        return fail(
          error instanceof SessionError
            ? error.message
            : '로그인 서버(Supabase)에 연결할 수 없습니다. 주소를 확인해 주세요.',
        )
      }
    }

    // 2) 매장. 데모 계정의 매장 중 지정한 것, 없으면 첫 번째.
    const stores = await request({ method: 'GET', path: '/stores' })
    if (!stores.ok) {
      return fail(
        stores.status === 0
          ? // 브라우저는 CORS 거절도 '연결 실패'로만 알려 준다. 가장 흔한 원인부터 적는다.
            `백엔드(${new URL(config.apiUrl).host})에 연결할 수 없습니다. 이 페이지가 백엔드와 같은 도메인의 https 주소로 ` +
            `열렸는지(CORS — *.vercel.app 은 막힌다), 백엔드가 떠 있고 HTTPS 인증서가 있는지 확인해 주세요.`
          : `매장을 불러오지 못했습니다: ${stores.error}`,
      )
    }
    const list = (stores.data as { stores?: StoreDto[] } | null)?.stores ?? []
    const store = (config.storeId ? list.find((candidate) => candidate.id === config.storeId) : list[0]) ?? null
    if (!store) {
      return fail(
        config.storeId
          ? `데모 계정에서 매장(${config.storeId})을 찾지 못했습니다.`
          : '데모 계정에 매장이 없습니다. 매장을 먼저 만들어 주세요.',
      )
    }

    // 3) 시연 영상 = 카메라.
    let manifest: DemoManifest
    try {
      manifest = await loadManifest(browserFetch)
    } catch (error) {
      return fail(error instanceof Error ? error.message : '시연 영상 목록을 읽지 못했습니다')
    }
    if (manifest.videos.length === 0) {
      return fail('시연 영상이 없습니다. public/demo-video 에 영상을 넣고 다시 배포해 주세요.')
    }
    state.manifest = manifest

    // 시연 영상 풀(manifest.videos) 전부를 카메라로 켜지는 않는다 — '카메라 추가' 위저드에서
    // 고를 수 있게 일부는 남겨 둔다. '이미 추가된 카메라'는 서버에 이 매장 카메라로 등록돼 있는
    // 것으로 정의한다(=단일 출처). 그래서 새로고침해도, 다른 탭에서 봐도 같은 카메라가 보인다.
    //
    // 시연 영상을 통째로 바꾸면(파일 교체) 예전 영상의 카메라가 서버에 남아 '중지'로 보이고,
    // 쌓이면 매장당 8대 제한에 걸려 등록이 막힌다. 지금 풀에 없는 시연 카메라(demo-…)는 지운다
    // (soft delete, 다시 넣으면 되살아난다). 지금 풀에도 있는 건 그대로 '켜진 카메라'로 이어간다.
    const listed = await request({ method: 'GET', path: `/stores/${encodeURIComponent(store.id)}/cameras` })
    if (!listed.ok) {
      return fail(`카메라 목록을 불러오지 못했습니다: ${listed.error}`)
    }
    const poolIds = new Set(manifest.videos.map((video) => video.id))
    const existingCameras = (listed.data as { cameras?: { id: string; agentCameraId: string }[] } | null)?.cameras ?? []
    await Promise.all(
      existingCameras
        .filter((camera) => camera.agentCameraId.startsWith('demo-') && !poolIds.has(camera.agentCameraId))
        .map((camera) => request({ method: 'DELETE', path: `/cameras/${encodeURIComponent(camera.id)}` })),
    )
    const activeVideoIds = existingCameras
      .filter((camera) => poolIds.has(camera.agentCameraId))
      .map((camera) => camera.agentCameraId)

    // 조각 길이는 매장 설정이 단일 출처다. 미리 자른 길이와 맞춰 둔다 (30초 / 1분 / 5분만 된다).
    if (store.segmentSeconds !== manifest.segmentSeconds && [30, 60, 300].includes(manifest.segmentSeconds)) {
      await request({
        method: 'PATCH',
        path: `/stores/${encodeURIComponent(store.id)}`,
        body: { segmentSeconds: manifest.segmentSeconds },
      })
    }

    const collector = createCollector({
      manifest,
      activeVideoIds,
      apiUrl: config.apiUrl,
      deviceToken: config.deviceToken,
      storeId: store.id,
      deviceId: store.device?.deviceId ?? state.config.deviceId,
      fetch: browserFetch,
      newSegmentId: () => ulid(),
    })
    state.collector = collector
    state.config = {
      ...state.config,
      storeId: store.id,
      deviceId: store.device?.deviceId ?? state.config.deviceId,
      segmentSeconds: manifest.segmentSeconds,
      cameras: collector.cameras,
    }
    collector.onStatus((status) => statusListeners.forEach((listener) => listener(status)))

    // 들어오자마자 돈다. 심사위원이 누를 것은 없다.
    collector.start()

    // 하트비트는 탭이 열려 있는 동안 계속 간다 — 모바일의 'PC 켜짐'이 여기서 나온다.
    // 수집기를 먼저 켜야 첫 하트비트부터 카메라가 connected 로 간다. 영상이 끝나도 connected 이고,
    // '일시 중지'를 누르면 에이전트처럼 unknown 으로 보고된다.
    createHeartbeat({
      getConfig: () => state.config,
      getStatus: () => collector.status(),
      fetch: browserFetch,
      onSegmentSeconds: () => undefined,
    }).start()
    return { ok: true, storeName: store.name, cameraCount: activeVideoIds.length }
  }

  const ready = boot().catch(
    (error: unknown): LiveBootResult => fail(error instanceof Error ? error.message : '실서버 데모를 시작하지 못했습니다'),
  )
  latestManifest = () => state.manifest
  latestReady = ready

  window.__sceneStealerLive = { configMissing: missingLiveConfig(config), ready }

  return {
    // 브라우저는 매장 네트워크의 카메라에 닿을 수 없다. 카메라가 없는 네트워크에 놓인 매장 PC 앱과
    // 똑같이 보이게 한다 — 검색은 찾은 것 없이 끝나고, 주소를 넣으면 연결하지 못한다 (문구는 main/ipc.ts).
    discover: async (timeoutMs) => {
      await new Promise((resolve) => setTimeout(resolve, timeoutMs ?? DISCOVER_MS))
      return { ok: true, cameras: [] }
    },
    probe: async () => ({ ok: false, kind: 'unreachable', message: '카메라에 연결하지 못했습니다: 응답이 없습니다' }),
    probeRtsp: async () => ({
      ok: false,
      kind: 'unreachable',
      message: '이 주소에서 영상을 읽지 못했습니다. 주소·아이디·비밀번호를 확인해 주세요.',
    }),
    snapshot: async () => ({ ok: false, message: '미리보기를 가져오지 못했습니다' }),

    previewStart: async (rtspUri) => {
      await ready
      // '카메라 추가' 위저드는 아직 카메라로 켜지 않은(=collector.cameras 에 없는) 풀 영상도
      // 미리 봐야 하니, 활성 카메라뿐 아니라 시연 영상 풀 전체에서 찾는다.
      const match = /^demo-video:\/\/(.+)$/.exec(rtspUri)
      const video = match ? state.manifest?.videos.find((candidate) => candidate.id === match[1]) : undefined
      if (!video) return { ok: false, message: '시연 영상을 찾지 못했습니다' }
      const collector = state.collector
      const isActive = collector?.cameras.some((candidate) => candidate.id === video.id) ?? false
      // 이미 켜진 카메라면 수집기가 올리고 있는 지점부터 튼다 — 화면에 보이는 장면이 곧 서버로
      // 가는 조각이다. 아직 추가 전(미리보기만)이면 처음부터 튼다. 영상이 끝났으면 끝 직전에서
      // 틀어 마지막 장면에 멈추게 한다 (끝에서 열면 브라우저가 처음부터 틀 수 있다).
      const seconds = isActive && collector
        ? Math.min(collector.playheadMs(video.id), Math.max(0, video.durationMs - 100)) / 1000
        : 0
      return { ok: true, url: `${video.url}#t=${seconds.toFixed(2)}` }
    },
    previewStop: async () => undefined,

    start: async (cameras) => {
      await ready
      const collector = state.collector
      if (!collector) return
      // '카메라 추가/삭제'가 서버에 등록/해제한 뒤 여기로 새 카메라 목록을 넘긴다 — 서버가
      // 아는 것과 수집기가 트는 것을 맞춘다. (실제 Electron 앱에서도 같은 자리에서
      // ffmpeg 캡처 목록을 이 목록으로 맞춘다.)
      collector.setActive(cameras.map((camera) => camera.id))
      collector.start()
    },
    stop: async () => {
      await ready
      // 카메라 목록은 그대로 두고 업로드만 멈춘다 — Live.tsx 의 '일시 중지' 도 이 자리를 쓴다.
      // (마지막 카메라를 삭제했을 때도 여기로 오지만, 그 카메라는 이미 config.cameras 에서
      // 빠져 있어 화면 타일은 사라진다 — 수집기 안에 남는 건 아무 데서도 안 보이는 값이다.)
      state.collector?.stop()
    },
    getConfig: async () => {
      await ready
      return state.config
    },
    setConfig: async (patch) => {
      await ready
      state.config = { ...state.config, ...patch }
      return state.config
    },
    getStatus: async () => {
      await ready
      return state.collector?.status() ?? idleStatus
    },
    onStatus: (listener) => {
      statusListeners.add(listener)
      return () => {
        statusListeners.delete(listener)
      }
    },
    openSpoolFolder: async () => undefined,

    authSendOtp: async () => ({ ok: false, message: '체험판은 데모 계정으로 자동 로그인됩니다.' }),
    authVerifyOtp: async () => ({ ok: false, message: '체험판은 데모 계정으로 자동 로그인됩니다.' }),
    authSignOut: async () => {
      // 이 주소로 들어온 것 자체가 데모 계정 로그인이다. 로그아웃하면 새로 열려 처음부터 다시 돈다.
      stream.stop()
      await session.signOut()
      window.location.reload()
    },
    authGetSession: async () => {
      await ready
      return summary()
    },

    serverRequest: request,
    serverStreamStart: async (storeId) => stream.start(storeId),
    serverStreamStop: async () => stream.stop(),
    onServerStream: (listener) => {
      streamListeners.add(listener)
      return () => {
        streamListeners.delete(listener)
      }
    },
    onServerStreamState: (listener) => {
      streamStateListeners.add(listener)
      return () => {
        streamStateListeners.delete(listener)
      }
    },

    attention: async (on) => {
      // 브라우저에는 '최상위 창'이 없다. 제목만 바꿔 눈에 띄게 한다.
      document.title = on ? '⚠ 위험 감지 — Scene Stealer' : 'Scene Stealer'
    },
    openExternal: async (url) => {
      window.open(url, '_blank', 'noopener')
      return true
    },
    copyText: async (text) => {
      await navigator.clipboard?.writeText(text).catch(() => undefined)
    },
  }
}
