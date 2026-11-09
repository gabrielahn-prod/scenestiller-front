import type { ServerStreamMessage } from './server-types'
import type {
  AgentConfig,
  AgentStatus,
  DiscoveredCamera,
  SelectedCamera,
  StreamProfile,
} from './types'

export const IPC = {
  discover: 'agent:discover',
  probe: 'agent:probe',
  probeRtsp: 'agent:probe-rtsp',
  snapshot: 'agent:snapshot',
  previewStart: 'agent:preview-start',
  previewStop: 'agent:preview-stop',
  start: 'agent:start',
  stop: 'agent:stop',
  getConfig: 'agent:get-config',
  setConfig: 'agent:set-config',
  getStatus: 'agent:get-status',
  statusChanged: 'agent:status-changed',
  openSpoolFolder: 'agent:open-spool-folder',

  // 사장님 로그인 (요구사항 1.1 · 1.6) — 메인 프로세스가 Supabase Auth 를 대신 부른다.
  authSendOtp: 'auth:send-otp',
  authVerifyOtp: 'auth:verify-otp',
  authSignOut: 'auth:sign-out',
  authGetSession: 'auth:get-session',

  // 백엔드 호출 프록시 (docs/api-contract.md). 렌더러 CSP 가 교차 출처를 막는다.
  serverRequest: 'server:request',
  serverStreamStart: 'server:stream-start',
  serverStreamStop: 'server:stream-stop',
  serverStreamMessage: 'server:stream-message',
  serverStreamState: 'server:stream-state',

  // 2d 위험 팝업 — 창을 최상위로 올리고 작업표시줄을 깜빡인다.
  attention: 'window:attention',
  // 클립 저장 — 서명 URL 을 기본 브라우저로 연다. 렌더러 안에서 열면 앱 창이 이동한다.
  openExternal: 'window:open-external',
  // 112 신고 안내문 복사.
  copyText: 'window:copy-text',
} as const

/** 실패 사유를 구분해 화면이 제조사별 안내를 띄울 수 있게 한다. */
export type ProbeFailure = 'auth' | 'unreachable' | 'unknown'

export type ProbeResult =
  | { readonly ok: true; readonly profiles: readonly StreamProfile[] }
  | { readonly ok: false; readonly kind: ProbeFailure; readonly message: string }

/** 검색이 '0대'인 것과 '검색 자체가 실패'한 것을 구분한다. 섞으면 사용자가 네트워크를 의심하게 된다. */
export type DiscoverResult =
  | { readonly ok: true; readonly cameras: readonly DiscoveredCamera[] }
  | { readonly ok: false; readonly message: string }

export type PreviewResult =
  | { readonly ok: true; readonly url: string }
  | { readonly ok: false; readonly message: string }

export type SnapshotResult =
  | { readonly ok: true; readonly dataUrl: string }
  | { readonly ok: false; readonly message: string }

export type SessionSummary =
  | { readonly signedIn: true; readonly userId: string; readonly phone: string }
  | { readonly signedIn: false }

export type AuthResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly message: string }

export interface ServerRequest {
  readonly method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  /** '/stores' 처럼 / 로 시작하는 경로. 설정된 백엔드로만 간다. */
  readonly path: string
  readonly body?: unknown
}

/**
 * status 0 = 네트워크 실패(서버에 닿지 못함). 그 외는 HTTP 상태 코드.
 * 실패여도 data 를 싣는다 — 409 의 existingDevice 같은 정보를 화면이 쓴다.
 */
export type ServerResult =
  | { readonly ok: true; readonly status: number; readonly data: unknown }
  | { readonly ok: false; readonly status: number; readonly error: string; readonly data?: unknown }

export type StreamConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'unauthorized'

/** 라이브 격자의 작은 타일은 가볍게, 크게 볼 때만 제대로 뽑는다. */
export type PreviewQuality = 'tile' | 'full'

export interface PreviewOptions {
  /** 동시에 여러 카메라를 띄우기 위한 구분자. 같은 키는 스트림을 갈아끼운다. */
  readonly key?: string
  readonly quality?: PreviewQuality
}

export interface ProbeArgs {
  readonly xaddr: string
  readonly username: string
  readonly password: string
}

export interface AgentApi {
  discover(timeoutMs?: number): Promise<DiscoverResult>
  probe(args: ProbeArgs): Promise<ProbeResult>
  /** ONVIF 검색에 안 잡히는 카메라를 위한 수동 경로. RTSP 주소를 직접 조사한다. */
  probeRtsp(rtspUri: string): Promise<ProbeResult>
  snapshot(rtspUri: string): Promise<SnapshotResult>
  /** 실시간 미리보기 스트림을 켜고 <img src> 에 넣을 URL 을 받는다. */
  previewStart(rtspUri: string, options?: PreviewOptions): Promise<PreviewResult>
  /** key 를 주면 그 스트림만, 안 주면 전부 끈다. */
  previewStop(key?: string): Promise<void>
  /** 감시할 카메라 목록. 통째로 갈아끼운다. */
  start(cameras: readonly SelectedCamera[]): Promise<void>
  stop(): Promise<void>
  getConfig(): Promise<AgentConfig>
  setConfig(patch: Partial<AgentConfig>): Promise<AgentConfig>
  getStatus(): Promise<AgentStatus>
  /** 구독 해제 함수를 돌려준다. */
  onStatus(listener: (status: AgentStatus) => void): () => void
  openSpoolFolder(): Promise<void>

  authSendOtp(phone: string): Promise<AuthResult<null>>
  authVerifyOtp(phone: string, code: string): Promise<AuthResult<SessionSummary>>
  authSignOut(): Promise<void>
  authGetSession(): Promise<SessionSummary>

  serverRequest(request: ServerRequest): Promise<ServerResult>
  /** 매장 하나의 SSE 를 연다. 다른 매장으로 바꾸면 이전 스트림은 닫힌다. */
  serverStreamStart(storeId: string): Promise<void>
  serverStreamStop(): Promise<void>
  onServerStream(listener: (message: ServerStreamMessage) => void): () => void
  onServerStreamState(listener: (state: StreamConnectionState) => void): () => void

  /** 위험 팝업이 떠 있는 동안 창을 최상위로 붙잡는다. */
  attention(on: boolean): Promise<void>
  /** http(s) 주소만 연다. */
  openExternal(url: string): Promise<boolean>
  copyText(text: string): Promise<void>
}
