import type {
  EventDetail, EventListItem, EventState, Monitoring, NearbyCamera,
  NotificationSettings, Risk, SceneStealerApi, Store, TimelineCamera,
} from './types'

/**
 * 가짜 서버.
 *
 * 백엔드·Supabase 프로젝트가 아직 없어서 화면을 이걸로 만든다 (PC 앱도 같은 방식).
 * 데이터는 뼈대 2i–2m 의 예시를 그대로 옮기되 **위험 종류는 넣지 않는다** —
 * 이벤트 이름은 '이상 행동' 하나이고, 구분은 위험도로만 한다.
 */

const at = (dayOffset: number, hhmm: string, seconds = 0): string => {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  d.setHours(h ?? 0, m ?? 0, seconds, 0)
  return d.toISOString()
}

/**
 * '지금으로부터 N분 전'.
 * 고정 시각(14:33)으로 심어 두면 오전에 열었을 때 '마지막 분석'이 미래가 되고
 * 경과 시간이 0초로 찍힌다 — 없는 상태를 보여 주느니 항상 지금 기준으로 만든다.
 */
const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString()

const CAMERAS = [
  { id: 'cam-checkout', name: '계산대', locationTag: 'checkout' },
  { id: 'cam-door', name: '출입문', locationTag: 'entrance' },
  { id: 'cam-shelf', name: '진열대 A', locationTag: 'shelf' },
  { id: 'cam-dining', name: '취식대', locationTag: 'dining' },
  { id: 'cam-stock', name: '창고', locationTag: 'stock' },
] as const

const makeEvent = (
  id: string, cameraId: string, risk: Risk, state: EventState,
  startedAt: string, durationSec: number,
): EventListItem => {
  const camera = CAMERAS.find((c) => c.id === cameraId)!
  const shift = (seconds: number) => new Date(Date.parse(startedAt) + seconds * 1000).toISOString()
  return {
    id, cameraId, cameraName: camera.name, locationTag: camera.locationTag,
    risk, state,
    startedAt,
    endedAt: shift(durationSec),
    durationSec,
    thumbnailUrl: null,
    createdAt: shift(durationSec + 5),
  }
}

const SEED: EventListItem[] = [
  makeEvent('ev-1', 'cam-checkout', 'high', 'unconfirmed', minutesAgo(25), 31),
  makeEvent('ev-2', 'cam-door', 'medium', 'unconfirmed', minutesAgo(112), 44),
  makeEvent('ev-3', 'cam-dining', 'low', 'confirmed', minutesAgo(205), 22),
  makeEvent('ev-4', 'cam-shelf', 'low', 'false_positive', minutesAgo(320), 18),
  makeEvent('ev-5', 'cam-door', 'medium', 'confirmed', at(-1, '02:10'), 63),
]

const ORDER: Record<EventState, number> = { unconfirmed: 0, confirmed: 1, false_positive: 1 }

const sortForList = (items: readonly EventListItem[]): EventListItem[] =>
  [...items].sort(
    (a, b) =>
      ORDER[a.state] - ORDER[b.state] ||
      Date.parse(b.startedAt) - Date.parse(a.startedAt),
  )

const localDate = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export interface MockOptions {
  /** 응답 지연(ms). 로딩 상태를 눈으로 확인하려고 둔다. */
  readonly latencyMs?: number
  /**
   * 이벤트 클립으로 보여 줄 영상. 데모 배포는 같이 구운 파일을 가리켜
   * 바깥 인터넷에 기대지 않는다 — 심사장 네트워크가 막혀도 재생돼야 한다.
   */
  readonly clipUrl?: string
}

export const createMockApi = (options: MockOptions = {}): SceneStealerApi => {
  const latency = options.latencyMs ?? 120
  const clipUrl =
    options.clipUrl ??
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4'
  const wait = () => new Promise<void>((r) => setTimeout(r, latency))

  const state = {
    events: SEED.map((e) => ({ ...e, memo: null as string | null })),
    settings: {
      minRisk: 'medium',
      quietHours: {
        businessHoursHighOnly: true,
        sleepStart: '01:00', sleepEnd: '07:00',
        sleepHighOnly: true, overrideDndForHigh: true,
      },
    } as NotificationSettings,
    pushTokens: [] as string[],
    testSends: 0,
  }

  const detailOf = (item: EventListItem & { memo: string | null }): EventDetail => ({
    ...item,
    anomalyScore: item.risk === 'high' ? 0.93 : item.risk === 'medium' ? 0.74 : 0.63,
    anomalyThreshold: 0.61,
    memo: item.memo,
    // 실제 서버는 서명 URL 을 준다. 가짜에서는 공개 샘플 영상으로 재생만 확인한다.
    clipUrl,
    clipExpiresAt: at(0, '23:59'),
    segments: [{ videoId: `vid-${item.id}`, startedAt: item.startedAt, playbackUrl: '' }],
    history:
      item.state === 'unconfirmed'
        ? []
        : [{ toState: item.state, changedBy: 'user-1', changedByName: '사장님', source: 'pc', createdAt: item.createdAt }],
  })

  const find = (eventId: string) => {
    const item = state.events.find((e) => e.id === eventId)
    if (!item) throw new Error(`이벤트를 찾을 수 없습니다: ${eventId}`)
    return item
  }

  const stores: Store[] = [
    {
      id: 'store-gangnam', name: '강남 1호점', address: '서울 강남구 테헤란로 1',
      opensAt: '09:00', closesAt: '21:00', segmentSeconds: 300, cameraCount: 5,
      device: { id: 'dev-1', deviceId: 'pc-gangnam', label: '강남 1호점 PC', online: true, lastHeartbeatAt: minutesAgo(0.5) },
      unconfirmedCount: 2,
    },
    {
      id: 'store-yeoksam', name: '역삼점', address: '서울 강남구 역삼로 2',
      opensAt: '10:00', closesAt: '22:00', segmentSeconds: 300, cameraCount: 3,
      device: { id: 'dev-2', deviceId: 'pc-yeoksam', label: '역삼점 PC', online: false, lastHeartbeatAt: minutesAgo(120) },
      unconfirmedCount: 0,
    },
  ]

  return {
    listStores: async () => {
      await wait()
      return stores.map((s) =>
        s.id === 'store-gangnam'
          ? { ...s, unconfirmedCount: state.events.filter((e) => e.state === 'unconfirmed').length }
          : s,
      )
    },

    getMonitoring: async (storeId) => {
      await wait()
      if (storeId !== 'store-gangnam') {
        return {
          device: { id: 'dev-2', deviceId: 'pc-yeoksam', label: '역삼점 PC', online: false, lastHeartbeatAt: minutesAgo(120) },
          segmentSeconds: 300, cameras: [], lastAnalyzedAt: null, monitoringCount: 0, totalCount: 3,
        } satisfies Monitoring
      }
      return {
        device: { id: 'dev-1', deviceId: 'pc-gangnam', label: '강남 1호점 PC', online: true, lastHeartbeatAt: minutesAgo(0.5), agentVersion: '1.0.0' },
        segmentSeconds: 300,
        cameras: CAMERAS.map((c) =>
          c.id === 'cam-stock'
            ? { ...c, state: 'disconnected' as const, lastFrameAt: minutesAgo(13), lastSegmentAt: minutesAgo(13), disconnectedForSec: 13 * 60 }
            : { ...c, state: 'connected' as const, lastFrameAt: minutesAgo(0.2), lastSegmentAt: minutesAgo(2), disconnectedForSec: null },
        ),
        lastAnalyzedAt: minutesAgo(2),
        monitoringCount: 4, totalCount: 5,
      } satisfies Monitoring
    },

    listEvents: async (storeId, q = {}) => {
      await wait()
      // 심어 둔 사건은 강남 1호점 것뿐이다. 다른 매장에 남의 기록을 보여 주지 않는다.
      if (storeId !== 'store-gangnam') return { items: [], nextCursor: null }
      const filtered = state.events.filter(
        (e) =>
          (!q.date || localDate(e.startedAt) === q.date) &&
          (!q.cameraId || e.cameraId === q.cameraId) &&
          (!q.risk || e.risk === q.risk) &&
          (!q.state || e.state === q.state),
      )
      // 진짜 서버처럼 매번 새 객체를 준다. 안쪽 객체를 그대로 주면 상태를 바꿀 때 화면이 들고 있던 객체까지
      // 바뀌어, 객체가 같으면 다시 그리지 않는 React Compiler 가 옛 글자('미확인')를 그대로 둔다.
      return { items: sortForList(filtered).map((item) => ({ ...item })), nextCursor: null }
    },

    getEvent: async (eventId) => {
      await wait()
      return detailOf(find(eventId))
    },

    // 진짜 서버처럼 목록 모양만 돌려준다 — 상세 필드까지 주면 화면이 그걸 믿고 쓰다가 실서버에서 깨진다.
    setEventState: async (eventId, next, opts) => {
      await wait()
      const item = find(eventId)
      item.state = next
      void opts
      const { memo: _memo, ...listItem } = item
      return { ...listItem }
    },

    setEventMemo: async (eventId, memo) => {
      await wait()
      const item = find(eventId)
      item.memo = memo
      return { ...item }
    },

    getUnconfirmedCount: async (storeId) => {
      await wait()
      if (storeId !== 'store-gangnam') return 0
      return state.events.filter((e) => e.state === 'unconfirmed').length
    },

    getWeeklySummary: async (storeId) => {
      await wait()
      if (storeId !== 'store-gangnam') return { total: 0, falsePositive: 0, reported: 0 }
      const since = Date.now() - 7 * 86_400_000
      const week = state.events.filter((e) => Date.parse(e.startedAt) >= since)
      return {
        total: week.length,
        falsePositive: week.filter((e) => e.state === 'false_positive').length,
        reported: week.filter((e) => (e.memo ?? '').trim() !== '').length,
      }
    },

    getTimeline: async (storeId, date) => {
      await wait()
      if (storeId !== 'store-gangnam') return []
      return CAMERAS.map<TimelineCamera>((c) => ({
        cameraId: c.id,
        name: c.name,
        events: state.events
          .filter((e) => e.cameraId === c.id && localDate(e.startedAt) === date)
          .map(({ id, startedAt, endedAt, risk, state: s }) => ({ id, startedAt, endedAt, risk, state: s })),
        gaps:
          c.id === 'cam-stock'
            ? [{ from: minutesAgo(13), to: minutesAgo(0), reason: 'camera_disconnected' as const }]
            : [],
      }))
    },

    getNearbyCameras: async (eventId) => {
      await wait()
      const item = find(eventId)
      return CAMERAS.filter((c) => c.id !== item.cameraId && c.id !== 'cam-stock').map<NearbyCamera>((c) => ({
        cameraId: c.id, name: c.name,
        // 가짜 서버에는 다른 카메라 영상이 따로 없다 — 같은 예제 영상을 튼다.
        playbackUrl: clipUrl,
        offsetSec: 12.4,
      }))
    },

    getNotificationSettings: async () => {
      await wait()
      return state.settings
    },

    putNotificationSettings: async (_storeId, settings) => {
      await wait()
      state.settings = settings
      return state.settings
    },

    sendTestNotification: async () => {
      await wait()
      state.testSends += 1
    },

    registerPushDevice: async (_platform, token) => {
      await wait()
      if (!state.pushTokens.includes(token)) state.pushTokens.push(token)
    },

    unregisterPushDevice: async (token) => {
      await wait()
      state.pushTokens = state.pushTokens.filter((t) => t !== token)
    },
  }
}
