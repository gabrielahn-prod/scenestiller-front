/**
 * 백엔드(scene-stealer-back) API 의 응답 모양.
 *
 * 단일 출처는 docs/api-contract.md 다. 그 문서가 바뀌면 이 파일도 같이 바꾼다 —
 * 두 레포는 서로 import 할 수 없어서 사본을 들고 있다 (계약 10절).
 * 필드명은 계약 그대로 camelCase, 시각은 전부 ISO 8601 UTC 밀리초 Z 문자열이다.
 */

/**
 * 위험 종류(절도·배회 …)는 나누지 않는다 — AI 는 '평소와 다른 움직임' 구간과 점수만 주고,
 * 위험도는 그 점수로 정한다 (계약 7절).
 */
export type RiskLevel = 'high' | 'medium' | 'low'
export type EventState = 'unconfirmed' | 'confirmed' | 'false_positive'
export type LocationTag = 'checkout' | 'entrance' | 'shelf' | 'dining' | 'storage' | 'other'
export type CameraRuntimeState =
  | 'unknown'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'auth_failed'
export type SegmentSeconds = 30 | 60 | 300

/* ------------------------------------------------------------ 매장 · 기기 */

export interface DeviceDto {
  readonly id: string
  readonly deviceId: string
  readonly label: string | null
  readonly agentVersion: string | null
  readonly online: boolean
  readonly lastHeartbeatAt: string | null
  readonly spoolBytes: number | null
  readonly uploadedBytesToday: number | null
}

export interface StoreDto {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly opensAt: string | null
  readonly closesAt: string | null
  readonly segmentSeconds: SegmentSeconds
  readonly clipRetentionDays: number
  readonly cameraCount: number
  readonly device: DeviceDto | null
  readonly unconfirmedCount: number
}

export interface DeviceRegistration extends DeviceDto {
  /** 평문 토큰. 이 응답에서 한 번만 온다 — 서버는 해시만 들고 있다 (계약 3.3). */
  readonly deviceToken: string
  readonly replacedDeviceId: string | null
}

/* ------------------------------------------------------------------ 카메라 */

export interface CameraDto {
  readonly id: string
  readonly storeId: string
  readonly agentCameraId: string
  readonly name: string
  readonly locationTag: LocationTag | null
  readonly sortOrder: number
  readonly streamProfile: 'main' | 'sub' | null
  readonly state: CameraRuntimeState
  readonly lastFrameAt: string | null
  readonly lastSegmentAt: string | null
}

export interface MonitoringCamera extends CameraDto {
  /** 끊긴 지 몇 초. 모바일의 '창고 끊김 13분'이 이걸 쓴다. */
  readonly disconnectedForSec: number | null
}

export interface MonitoringDto {
  readonly device: {
    readonly online: boolean
    readonly lastHeartbeatAt: string | null
    readonly agentVersion: string | null
    readonly spoolBytes: number | null
    readonly uploadedBytesToday: number | null
  } | null
  readonly segmentSeconds: SegmentSeconds
  readonly cameras: readonly MonitoringCamera[]
  readonly lastAnalyzedAt: string | null
  readonly monitoringCount: number
  readonly totalCount: number
}

/* ---------------------------------------------------------------- 이벤트 */

export interface EventListItem {
  readonly id: string
  readonly storeId: string
  readonly cameraId: string
  readonly cameraName: string | null
  readonly locationTag: LocationTag | null
  readonly risk: RiskLevel
  readonly state: EventState
  readonly startedAt: string
  readonly endedAt: string
  readonly durationSec: number | null
  readonly thumbnailUrl: string | null
  readonly createdAt: string
}

export interface EventHistoryItem {
  readonly toState: EventState
  readonly fromState: EventState | null
  readonly changedBy: string | null
  readonly source: 'pc' | 'mobile' | 'system'
  readonly reason: string | null
  readonly createdAt: string
}

export interface EventSegment {
  readonly videoId: string
  readonly startedAt: string
  readonly endedAt: string
  readonly playbackUrl: string | null
}

export interface EventDetail extends EventListItem {
  readonly anomalyScore: number | null
  readonly anomalyThreshold: number | null
  readonly memo: string | null
  readonly falsePositiveReason: string | null
  readonly clipUrl: string | null
  readonly clipExpiresAt: string | null
  readonly segments: readonly EventSegment[]
  readonly history: readonly EventHistoryItem[]
}

export interface EventPage {
  readonly items: readonly EventListItem[]
  readonly nextCursor: string | null
}

export interface EventQuery {
  readonly date?: string
  readonly from?: string
  readonly to?: string
  readonly cameraId?: string
  readonly risk?: RiskLevel
  readonly state?: EventState
  readonly limit?: number
  readonly cursor?: string
}

export interface TimelineGap {
  readonly from: string
  readonly to: string
  readonly reason: string
}

export interface TimelineCamera {
  readonly cameraId: string
  readonly name: string
  readonly locationTag: LocationTag | null
  readonly events: readonly {
    readonly id: string
    readonly startedAt: string
    readonly endedAt: string
    readonly risk: RiskLevel
    readonly state: EventState
  }[]
  /** 영상 없음 구간 — 타임라인이 점선으로 그린다 (계약 5.5). */
  readonly gaps: readonly TimelineGap[]
}

export interface TimelineDto {
  readonly date: string
  readonly windowStart: string
  readonly windowEnd: string
  readonly cameras: readonly TimelineCamera[]
}

export interface EventSummary {
  readonly from: string
  readonly to: string
  readonly total: number
  readonly falsePositive: number
  readonly reported: number
  readonly byWeekday: readonly number[]
  readonly byHour: readonly number[]
}

export interface NearbyCamera {
  readonly cameraId: string
  readonly name: string | null
  readonly locationTag: LocationTag | null
  readonly playbackUrl: string | null
  readonly segmentStartedAt: string
  /** 조각 시작 기준 이벤트 시각까지. 플레이어가 이 지점부터 재생한다. */
  readonly offsetSec: number
}

export interface SegmentDto {
  readonly videoId: string
  readonly cameraId: string | null
  /** (PC, 카메라)별 조각 번호. 2f 의 '조각 #1284' — 사장님이 지원팀에 조각을 가리킬 때 쓴다. */
  readonly sequence: number | null
  readonly startedAt: string
  readonly endedAt: string
  readonly durationSec: number | null
  readonly status: string
  readonly playbackUrl: string | null
}

/* ------------------------------------------------------------------ 알림 */

export interface QuietHours {
  readonly businessHoursHighOnly: boolean
  /** HH:MM, 매장 벽시계 */
  readonly sleepStart: string | null
  readonly sleepEnd: string | null
  /** 수면 시간엔 높음만 소리 */
  readonly sleepHighOnly: boolean
  readonly overrideDndForHigh: boolean
}

export interface NotificationSettings {
  /** 이 위험도 이상만 알린다 (2g '알림 받을 위험도'). */
  readonly minRisk: RiskLevel
  readonly quietHours: QuietHours
}

/* ------------------------------------------------------------------- SSE */

export type ServerStreamMessage =
  | { readonly type: 'ready'; readonly data: { readonly storeId: string } }
  | { readonly type: 'ping'; readonly data: Record<string, never> }
  | { readonly type: 'event.created'; readonly data: EventListItem }
  | { readonly type: 'event.updated'; readonly data: EventListItem }
  | { readonly type: 'event.deleted'; readonly data: { readonly id: string } }
  | {
      readonly type: 'camera.state'
      readonly data: {
        readonly cameraId: string
        readonly state: CameraRuntimeState
        readonly lastFrameAt: string | null
      }
    }
