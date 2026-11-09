/**
 * 메인 프로세스와 렌더러가 공유하는 타입.
 * 백엔드 API 규격(SegmentMeta)의 단일 출처이기도 하다.
 */

export type StreamProfileKind = 'main' | 'sub'
export type VideoCodec = 'h264' | 'h265'

/** ONVIF 검색으로 발견된 카메라. 아직 인증 전이라 스트림 정보는 없다. */
export interface DiscoveredCamera {
  /** XAddr 기반 안정 식별자. DHCP로 IP가 바뀌어도 유지된다. */
  readonly id: string
  readonly xaddr: string
  readonly ip: string
  readonly port: number
  readonly manufacturer: string | null
  readonly model: string | null
  readonly name: string | null
}

/** 인증 후 조회한 스트림 프로필 하나. */
export interface StreamProfile {
  readonly token: string
  readonly kind: StreamProfileKind
  readonly rtspUri: string
  readonly codec: VideoCodec
  readonly width: number
  readonly height: number
  readonly fps: number
  /** 카메라가 보고한 비트레이트(kbps). 화면에서 예상 사용량을 계산하는 데 쓴다. */
  readonly bitrateKbps: number | null
}

export interface ProbedCamera {
  readonly camera: DiscoveredCamera
  readonly profiles: readonly StreamProfile[]
}

/** 사용자가 최종 선택해 수집 대상이 된 카메라. 설정에 영속된다. */
export interface SelectedCamera {
  readonly id: string
  readonly name: string
  readonly manufacturer: string | null
  readonly model: string | null
  readonly rtspUri: string
  readonly streamProfile: StreamProfileKind
  readonly codec: VideoCodec
  readonly width: number
  readonly height: number
  readonly fps: number
}

export interface AgentConfig {
  readonly backendBaseUrl: string
  /**
   * 사장님 로그인(휴대폰 인증)은 백엔드가 아니라 Supabase Auth 가 받는다
   * (docs/api-contract.md 3.1). 배포본에는 빌드 때 박히고, 설정 ▸ 고급에서 바꿀 수 있다.
   */
  readonly supabaseUrl: string
  /** 공개 키다(anon). 권한은 RLS 와 백엔드의 JWT 검증이 지킨다. */
  readonly supabaseAnonKey: string
  readonly deviceToken: string
  readonly storeId: string
  /** 최초 실행 시 자동 생성 후 영속. 사용자가 편집하지 않는다. */
  readonly deviceId: string
  readonly segmentSeconds: number
  readonly streamProfile: StreamProfileKind
  /** 보관 공간 총량. 카메라 수로 나누어 카메라마다 같은 몫을 준다. */
  readonly spoolLimitBytes: number
  readonly includeAudio: boolean
  readonly autoStart: boolean
  /** 감시 중인 카메라들. 순서는 사용자가 고른 순서다. */
  readonly cameras: readonly SelectedCamera[]
  /**
   * 조각 경계를 벽시계에 맞출지.
   * 켜면 모든 카메라가 14:30, 14:35 처럼 같은 시각에 잘려서, AI 서버가
   * 같은 구간의 여러 카메라를 그대로 나란히 놓고 볼 수 있다.
   */
  readonly alignToClock: boolean
}

/** 백엔드로 보내는 meta 파트. 이 모양이 곧 API 계약이다. */
export interface SegmentMeta {
  readonly segmentId: string
  readonly storeId: string
  readonly deviceId: string
  readonly camera: {
    readonly id: string
    readonly name: string
    readonly manufacturer: string | null
    readonly model: string | null
    readonly streamProfile: StreamProfileKind
  }
  readonly video: {
    readonly codec: VideoCodec
    readonly width: number
    readonly height: number
    readonly fps: number
    readonly durationMs: number
    readonly sizeBytes: number
    readonly container: 'mp4'
  }
  readonly startedAt: string
  readonly endedAt: string
  /** (deviceId, camera.id)마다 0부터 증가. 생성 순서지 업로드 순서가 아니다. */
  readonly sequence: number
  readonly agentVersion: string
}

export type CameraStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'reconnecting'
  | 'auth-failed'

export type UploadStatus =
  | 'idle'
  | 'uploading'
  | 'retrying'
  | 'offline'
  | 'auth-failed'
  | 'payload-too-large'

/** 카메라 한 대의 상태. 카메라마다 독립적으로 끊기고 복구된다. */
export interface CameraRuntimeStatus {
  readonly cameraId: string
  readonly name: string
  readonly camera: CameraStatus
  readonly uploadedCount: number
  readonly pendingCount: number
  readonly lastUploadAt: string | null
  readonly spoolBytes: number
  readonly lastError: string | null
  /** 상한 초과로 오래된 조각을 버린 적이 있는지. 화면에 경고를 남긴다. */
  readonly spoolEvicted: boolean
}

export interface AgentStatus {
  readonly running: boolean
  /**
   * 업로드는 카메라별이 아니라 전체가 하나다.
   * 매장 업링크를 아끼려고 한 번에 하나씩만 올리기 때문이다.
   */
  readonly upload: UploadStatus
  readonly cameras: readonly CameraRuntimeStatus[]
  readonly bytesUploadedToday: number
  /** 카메라 한 대에 할당된 몫. 총량을 카메라 수로 나눈 값이다. */
  readonly spoolLimitBytesPerCamera: number
  readonly lastError: string | null
}

export const DEFAULT_CONFIG: Omit<AgentConfig, 'deviceId'> = {
  backendBaseUrl: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  deviceToken: '',
  storeId: '',
  // 1분. 디자인 2b 의 '알림 빠르기' 기본값이자 백엔드 stores.segment_seconds 기본값.
  // 조각이 짧을수록 위험 신호가 빨리 온다 — 5분이면 절도 알림이 최대 5분 늦는다.
  // 이미 설치된 PC 는 저장된 값을 그대로 쓰고, 하트비트가 서버 설정으로 맞춘다.
  segmentSeconds: 60,
  streamProfile: 'sub',
  spoolLimitBytes: 5 * 1024 ** 3,
  includeAudio: false,
  autoStart: true,
  cameras: [],
  alignToClock: true,
}

/** 카메라 한 대에 돌아가는 보관 몫. 총량을 카메라 수로 나눈다. */
export const spoolLimitPerCamera = (totalBytes: number, cameraCount: number): number =>
  Math.floor(totalBytes / Math.max(1, cameraCount))

export const AGENT_VERSION = '1.0.0'
