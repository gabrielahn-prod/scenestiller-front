/**
 * 백엔드 계약(docs/api-contract.md)의 타입 있는 클라이언트.
 *
 * 실제 호출은 메인 프로세스가 대신 한다 (api.serverRequest) — 렌더러 CSP 가 교차
 * 출처를 막고, 토큰을 렌더러에 두지 않기 위해서다. 브라우저 개발 모드에서는
 * mock-api 가 같은 자리에서 계약을 흉내 낸다. 화면 코드는 어느 쪽인지 모른다.
 */
import type { ServerRequest } from '../../shared/ipc'
import type {
  CameraDto,
  DeviceRegistration,
  EventDetail,
  EventListItem,
  EventPage,
  EventQuery,
  EventState,
  EventSummary,
  LocationTag,
  MonitoringDto,
  NearbyCamera,
  NotificationSettings,
  SegmentDto,
  SegmentSeconds,
  StoreDto,
  TimelineDto,
} from '../../shared/server-types'
import { api } from './api'

/** 화면에 그대로 띄울 수 있는 메시지를 담는다. status 0 = 서버에 닿지 못함. */
export class ServerError extends Error {
  override readonly name = 'ServerError'
  constructor(
    readonly status: number,
    message: string,
    readonly data?: unknown,
  ) {
    super(message)
  }
}

const call = async <T>(request: ServerRequest): Promise<T> => {
  const result = await api.serverRequest(request)
  if (!result.ok) throw new ServerError(result.status, result.error, result.data)
  return result.data as T
}

const query = (params: Readonly<Record<string, string | number | undefined>>): string => {
  const defined = Object.fromEntries(
    Object.entries(params).flatMap(([key, value]) =>
      value === undefined || value === '' ? [] : [[key, String(value)]],
    ),
  )
  const text = new URLSearchParams(defined).toString()
  return text ? `?${text}` : ''
}

const id = (value: string): string => encodeURIComponent(value)

/* ------------------------------------------------------------ 매장 · 기기 */

export const listStores = async (): Promise<readonly StoreDto[]> =>
  (await call<{ stores: StoreDto[] }>({ method: 'GET', path: '/stores' })).stores

export const createStore = async (input: {
  readonly name: string
  readonly address?: string
}): Promise<StoreDto> =>
  (await call<{ store: StoreDto }>({ method: 'POST', path: '/stores', body: input })).store

export const updateStore = async (
  storeId: string,
  patch: Partial<{
    name: string
    address: string
    opensAt: string
    closesAt: string
    segmentSeconds: SegmentSeconds
    clipRetentionDays: number
  }>,
): Promise<StoreDto> =>
  (await call<{ store: StoreDto }>({ method: 'PATCH', path: `/stores/${id(storeId)}`, body: patch })).store

/** 이미 다른 PC 가 연결된 매장이면 409 → ExistingDeviceError (계약 3.3). */
export class ExistingDeviceError extends ServerError {}

export const registerDevice = async (
  storeId: string,
  input: {
    readonly deviceId: string
    readonly label?: string
    readonly agentVersion?: string
    readonly replaceExisting?: boolean
  },
): Promise<DeviceRegistration> => {
  try {
    return await call<DeviceRegistration>({
      method: 'POST',
      path: `/stores/${id(storeId)}/devices`,
      body: input,
    })
  } catch (error) {
    if (error instanceof ServerError && error.status === 409) {
      throw new ExistingDeviceError(409, error.message, error.data)
    }
    throw error
  }
}

/* ------------------------------------------------------------------ 카메라 */

export const listCameras = async (storeId: string): Promise<readonly CameraDto[]> =>
  (await call<{ cameras: CameraDto[] }>({ method: 'GET', path: `/stores/${id(storeId)}/cameras` }))
    .cameras

export const createCamera = async (
  storeId: string,
  input: {
    readonly agentCameraId: string
    readonly name: string
    readonly locationTag: LocationTag | null
    readonly sortOrder?: number
    readonly streamProfile: 'main' | 'sub'
  },
): Promise<CameraDto> =>
  (
    await call<{ camera: CameraDto }>({
      method: 'POST',
      path: `/stores/${id(storeId)}/cameras`,
      body: input,
    })
  ).camera

export const updateCamera = async (
  cameraId: string,
  patch: Partial<{ name: string; locationTag: LocationTag; sortOrder: number }>,
): Promise<CameraDto> =>
  (await call<{ camera: CameraDto }>({ method: 'PATCH', path: `/cameras/${id(cameraId)}`, body: patch }))
    .camera

export const deleteCamera = (cameraId: string): Promise<null> =>
  call<null>({ method: 'DELETE', path: `/cameras/${id(cameraId)}` })

export const getMonitoring = (storeId: string): Promise<MonitoringDto> =>
  call<MonitoringDto>({ method: 'GET', path: `/stores/${id(storeId)}/monitoring` })

/* ---------------------------------------------------------------- 이벤트 */

export const listEvents = (storeId: string, params: EventQuery = {}): Promise<EventPage> =>
  call<EventPage>({
    method: 'GET',
    path: `/stores/${id(storeId)}/events${query({ ...params })}`,
  })

export const getEvent = async (eventId: string): Promise<EventDetail> =>
  (await call<{ event: EventDetail }>({ method: 'GET', path: `/events/${id(eventId)}` })).event

export const changeEventState = async (
  eventId: string,
  state: EventState,
  reason?: string,
): Promise<EventListItem> =>
  (
    await call<{ event: EventListItem }>({
      method: 'PATCH',
      path: `/events/${id(eventId)}/state`,
      body: { state, reason, source: 'pc' },
    })
  ).event

export const deleteEvent = (eventId: string): Promise<null> =>
  call<null>({ method: 'DELETE', path: `/events/${id(eventId)}` })

export const updateMemo = async (eventId: string, memo: string): Promise<EventListItem> =>
  (
    await call<{ event: EventListItem }>({
      method: 'PATCH',
      path: `/events/${id(eventId)}/memo`,
      body: { memo },
    })
  ).event

/** 내비 배지·모바일 탭 배지 (계약 5.6). */
export const getUnconfirmedCount = async (storeId: string, scope: 'today' | 'all' = 'all'): Promise<number> =>
  (
    await call<{ count: number }>({
      method: 'GET',
      path: `/stores/${id(storeId)}/events/unconfirmed-count${query({ scope })}`,
    })
  ).count

export const getTimeline = (storeId: string, date: string): Promise<TimelineDto> =>
  call<TimelineDto>({ method: 'GET', path: `/stores/${id(storeId)}/events/timeline${query({ date })}` })

export const getSummary = (storeId: string, from?: string, to?: string): Promise<EventSummary> =>
  call<EventSummary>({
    method: 'GET',
    path: `/stores/${id(storeId)}/events/summary${query({ from, to })}`,
  })

export const getNearbyCameras = async (eventId: string): Promise<readonly NearbyCamera[]> =>
  (await call<{ cameras: NearbyCamera[] }>({ method: 'GET', path: `/events/${id(eventId)}/nearby-cameras` }))
    .cameras

export const listSegments = async (
  storeId: string,
  params: { readonly cameraId?: string; readonly from?: string; readonly to?: string },
): Promise<readonly SegmentDto[]> =>
  (
    await call<{ segments: SegmentDto[] }>({
      method: 'GET',
      path: `/stores/${id(storeId)}/segments${query(params)}`,
    })
  ).segments

export const getClip = (eventId: string): Promise<{ readonly url: string; readonly expiresAt: string }> =>
  call({ method: 'GET', path: `/events/${id(eventId)}/clip` })

/* ------------------------------------------------------------------ 알림 */

export const getNotificationSettings = (storeId: string): Promise<NotificationSettings> =>
  call<NotificationSettings>({ method: 'GET', path: `/stores/${id(storeId)}/notification-settings` })

export const putNotificationSettings = (
  storeId: string,
  settings: NotificationSettings,
): Promise<NotificationSettings> =>
  call<NotificationSettings>({
    method: 'PUT',
    path: `/stores/${id(storeId)}/notification-settings`,
    body: settings,
  })

export const sendTestNotification = (storeId: string): Promise<{ sent: boolean; deviceCount: number }> =>
  call({ method: 'POST', path: `/stores/${id(storeId)}/notification-settings/test` })
