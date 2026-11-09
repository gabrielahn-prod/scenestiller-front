import type {
  EventDetail, EventListItem, EventState, EventsPage, ListEventsQuery, Monitoring, NearbyCamera,
  NotificationSettings, SceneStealerApi, Store, TimelineCamera, WeeklySummaryDto,
} from './types'

export interface ApiClientOptions {
  readonly baseUrl: string
  /** Supabase 세션 토큰. 없으면 null — 그때는 401 을 그대로 올린다. */
  readonly getToken: () => Promise<string | null>
  /**
   * 서버가 토큰을 거절했을 때(401) 새 토큰을 받아 올 곳. 주면 그 요청을 새 토큰으로 한 번 더 보낸다.
   * 만료 시각만 보고는 알 수 없는 경우가 있다 — 다른 서버에서 받은 토큰을 들고 있거나,
   * 서버에서 세션이 지워졌을 때다. 그대로 두면 화면이 영영 '불러오는 중'에 머문다.
   */
  readonly renewToken?: () => Promise<string | null>
  readonly fetchImpl?: typeof fetch
}

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

const query = (params: Record<string, string | number | undefined>): string => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '')
  return entries.length === 0 ? '' : `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}`
}

export const createApiClient = (options: ApiClientOptions): SceneStealerApi => {
  const send = (path: string, init: RequestInit, token: string | null): Promise<Response> =>
    (options.fetchImpl ?? fetch)(`${options.baseUrl.replace(/\/+$/, '')}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...init.headers,
      },
    })

  const call = async <T>(path: string, init: RequestInit = {}): Promise<T> => {
    const token = await options.getToken()
    let response = await send(path, init, token)
    if (response.status === 401 && options.renewToken) {
      const renewed = await options.renewToken()
      // 같은 토큰을 다시 받았으면 다시 보내 봐야 또 401 이다.
      if (renewed && renewed !== token) response = await send(path, init, renewed)
    }
    if (response.status === 204) return undefined as T
    const body = await response.json().catch(() => null)
    if (!response.ok) {
      // 계약 §1.3: { error: { code, message } }
      const error = (body as { error?: { code?: string; message?: string } } | null)?.error
      throw new ApiError(response.status, error?.code ?? 'unknown', error?.message ?? `HTTP ${response.status}`)
    }
    return body as T
  }

  return {
    listStores: async () => (await call<{ stores: Store[] }>('/stores')).stores,
    getMonitoring: (storeId) => call<Monitoring>(`/stores/${storeId}/monitoring`),
    listEvents: (storeId, q: ListEventsQuery = {}) =>
      call<EventsPage>(`/stores/${storeId}/events${query({ ...q })}`),
    getEvent: async (eventId) => (await call<{ event: EventDetail }>(`/events/${eventId}`)).event,
    setEventState: async (eventId, state: EventState, opts) =>
      (await call<{ event: EventListItem }>(`/events/${eventId}/state`, {
        method: 'PATCH',
        body: JSON.stringify({ state, source: 'mobile', ...(opts?.reason ? { reason: opts.reason } : {}) }),
      })).event,
    setEventMemo: async (eventId, memo) =>
      (await call<{ event: EventListItem & { memo: string | null } }>(`/events/${eventId}/memo`, {
        method: 'PATCH',
        body: JSON.stringify({ memo }),
      })).event,
    getUnconfirmedCount: async (storeId, scope = 'today') =>
      (await call<{ count: number }>(`/stores/${storeId}/events/unconfirmed-count${query({ scope })}`)).count,
    getWeeklySummary: (storeId) => call<WeeklySummaryDto>(`/stores/${storeId}/events/summary`),
    getTimeline: async (storeId, date) =>
      (await call<{ cameras: TimelineCamera[] }>(`/stores/${storeId}/events/timeline${query({ date })}`)).cameras,
    getNearbyCameras: async (eventId) =>
      (await call<{ cameras: NearbyCamera[] }>(`/events/${eventId}/nearby-cameras`)).cameras,
    getNotificationSettings: (storeId) =>
      call<NotificationSettings>(`/stores/${storeId}/notification-settings`),
    putNotificationSettings: (storeId, settings) =>
      call<NotificationSettings>(`/stores/${storeId}/notification-settings`, {
        method: 'PUT',
        body: JSON.stringify(settings),
      }),
    sendTestNotification: async (storeId) => {
      await call<unknown>(`/stores/${storeId}/notification-settings/test`, { method: 'POST' })
    },
    registerPushDevice: async (platform, token) => {
      await call<unknown>('/push/devices', { method: 'POST', body: JSON.stringify({ platform, token }) })
    },
    unregisterPushDevice: async (token) => {
      await call<unknown>('/push/devices', { method: 'DELETE', body: JSON.stringify({ token }) })
    },
  }
}
