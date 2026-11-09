/**
 * docs/api-contract.md 를 그대로 옮긴 타입.
 * 계약서가 바뀌면 여기부터 고치고, 타입 에러가 나는 화면을 따라가면 된다.
 *
 * 위험 '종류'는 없다 — AI 는 구간과 점수만 주고, 사용자에게 보이는 이름은 '이상 행동' 하나다.
 */

export type Risk = 'high' | 'medium' | 'low'
export type EventState = 'unconfirmed' | 'confirmed' | 'false_positive'
/** 'unknown' = 아직 보고가 없거나 PC 가 감시를 멈춘 카메라 (에이전트가 일시 중지를 이렇게 보낸다). */
export type CameraState = 'unknown' | 'connected' | 'reconnecting' | 'disconnected' | 'auth_failed'
export type ChangeSource = 'pc' | 'mobile' | 'system'

export interface Device {
  readonly id: string
  readonly deviceId: string
  readonly label: string
  readonly online: boolean
  readonly lastHeartbeatAt: string | null
}

export interface Store {
  readonly id: string
  readonly name: string
  readonly address: string | null
  readonly opensAt: string | null
  readonly closesAt: string | null
  readonly segmentSeconds: number
  readonly cameraCount: number
  readonly device: Device | null
  readonly unconfirmedCount: number
}

export interface MonitoringCamera {
  readonly id: string
  readonly name: string
  readonly locationTag: string | null
  readonly state: CameraState
  readonly lastFrameAt: string | null
  readonly lastSegmentAt: string | null
  readonly disconnectedForSec: number | null
}

export interface Monitoring {
  readonly device: (Device & { readonly agentVersion?: string }) | null
  readonly segmentSeconds: number
  readonly cameras: readonly MonitoringCamera[]
  readonly lastAnalyzedAt: string | null
  readonly monitoringCount: number
  readonly totalCount: number
}

export interface EventListItem {
  readonly id: string
  readonly cameraId: string
  readonly cameraName: string
  readonly locationTag: string | null
  readonly risk: Risk
  readonly state: EventState
  readonly startedAt: string
  readonly endedAt: string
  readonly durationSec: number
  readonly thumbnailUrl: string | null
  readonly createdAt: string
}

export interface EventSegment {
  readonly videoId: string
  readonly startedAt: string
  readonly playbackUrl: string
}

export interface EventHistoryEntry {
  readonly toState: EventState
  readonly changedBy: string | null
  readonly changedByName: string | null
  readonly source: ChangeSource
  readonly createdAt: string
}

export interface EventDetail extends EventListItem {
  readonly anomalyScore: number
  readonly anomalyThreshold: number
  readonly memo: string | null
  readonly clipUrl: string | null
  readonly clipExpiresAt: string | null
  readonly segments: readonly EventSegment[]
  readonly history: readonly EventHistoryEntry[]
}

export interface NearbyCamera {
  readonly cameraId: string
  readonly name: string
  readonly playbackUrl: string
  readonly offsetSec: number
}

export interface TimelineGap {
  readonly from: string
  readonly to: string
  readonly reason: 'camera_disconnected' | 'pc_offline'
}

export interface TimelineCamera {
  readonly cameraId: string
  readonly name: string
  readonly events: readonly Pick<EventListItem, 'id' | 'startedAt' | 'endedAt' | 'risk' | 'state'>[]
  readonly gaps: readonly TimelineGap[]
}

export interface QuietHours {
  readonly businessHoursHighOnly: boolean
  /** 수면(방해금지) 구간. 새 매장은 둘 다 null — 정하지 않았다 (백엔드 routers/notifications.py). */
  readonly sleepStart: string | null
  readonly sleepEnd: string | null
  readonly sleepHighOnly: boolean
  readonly overrideDndForHigh: boolean
}

export interface NotificationSettings {
  readonly minRisk: Risk
  readonly quietHours: QuietHours
}

/**
 * 주간 요약 (계약 5.8) — 기록 화면의 '이번 주 요약'. 기간을 안 주면 서버가 최근 7일로 센다.
 * total 은 오탐까지 센 수, reported 는 112 접수번호 같은 메모가 남은 수(신고 흔적)다.
 */
export interface WeeklySummaryDto {
  readonly total: number
  readonly falsePositive: number
  readonly reported: number
}

export interface EventsPage {
  readonly items: readonly EventListItem[]
  readonly nextCursor: string | null
}

export interface ListEventsQuery {
  readonly date?: string
  readonly cameraId?: string
  readonly risk?: Risk
  readonly state?: EventState
  readonly limit?: number
  readonly cursor?: string
}

/** 화면이 쓰는 유일한 창구. 진짜 서버든 가짜든 이 모양만 지키면 된다. */
export interface SceneStealerApi {
  listStores(): Promise<readonly Store[]>
  getMonitoring(storeId: string): Promise<Monitoring>
  listEvents(storeId: string, query?: ListEventsQuery): Promise<EventsPage>
  getEvent(eventId: string): Promise<EventDetail>
  /**
   * 서버는 목록 모양(EventListItem)만 돌려준다 — 점수·클립·조각 같은 상세 필드는 없다
   * (백엔드 routers/events.py change_event_state). 상세 화면은 받은 state 만 합쳐야 한다.
   */
  setEventState(
    eventId: string,
    state: EventState,
    options?: { readonly reason?: string },
  ): Promise<EventListItem>
  /** 이것도 목록 모양 + memo 다. */
  setEventMemo(eventId: string, memo: string): Promise<EventListItem & { readonly memo: string | null }>
  getUnconfirmedCount(storeId: string, scope?: 'today' | 'all'): Promise<number>
  getTimeline(storeId: string, date: string): Promise<readonly TimelineCamera[]>
  getWeeklySummary(storeId: string): Promise<WeeklySummaryDto>
  getNearbyCameras(eventId: string): Promise<readonly NearbyCamera[]>
  getNotificationSettings(storeId: string): Promise<NotificationSettings>
  putNotificationSettings(storeId: string, settings: NotificationSettings): Promise<NotificationSettings>
  sendTestNotification(storeId: string): Promise<void>
  registerPushDevice(platform: string, token: string): Promise<void>
  unregisterPushDevice(token: string): Promise<void>
}
