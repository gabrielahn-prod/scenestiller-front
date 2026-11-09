/**
 * 브라우저 개발 모드(`npm run ui`)에서 백엔드 계약(docs/api-contract.md)을 흉내 낸다.
 * 제품 동작에는 관여하지 않는다 — Electron 안에서는 메인 프로세스가 진짜 서버를 부른다.
 *
 * 데이터는 design/씬스틸러 PC 앱.dc.html 화면에 그려진 값 그대로다 (강남 1호점,
 * 계산대 14:32 위험도 높음 …). 시각은 오늘 날짜에 붙여서 '오늘 위험 신호'에 뜨게 한다.
 *
 * 새 위험 이벤트(2d 팝업)를 보려면 브라우저 콘솔에서:
 *   window.__sceneStealer.emitRiskEvent()
 */
import type { ServerRequest, ServerResult, StreamConnectionState } from '../../shared/ipc'
import type {
  CameraDto,
  CameraRuntimeState,
  EventDetail,
  EventHistoryItem,
  EventListItem,
  EventState,
  LocationTag,
  MonitoringCamera,
  NotificationSettings,
  RiskLevel,
  SegmentSeconds,
  ServerStreamMessage,
  StoreDto,
} from '../../shared/server-types'

/* ------------------------------------------------------------ 가짜 화면 */

/** CCTV 프레임 자리. CSP 가 data: 이미지를 허용한다. */
export const frame = (label: string, tone: 'normal' | 'dark' = 'normal'): string => {
  const [a, b] = tone === 'dark' ? ['#1A1C20', '#2A3038'] : ['#2A3038', '#555D6D']
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>
<rect width="640" height="360" fill="url(#g)"/>
<rect x="40" y="200" width="560" height="4" fill="#ffffff" opacity=".06"/>
<rect x="120" y="120" width="140" height="160" rx="6" fill="#ffffff" opacity=".05"/>
<rect x="380" y="90" width="160" height="190" rx="6" fill="#ffffff" opacity=".04"/>
<text x="320" y="190" text-anchor="middle" font-family="Pretendard, sans-serif" font-size="20" fill="#ffffff" opacity=".35">${label}</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/* ------------------------------------------------------------------ 시각 */

/** 시드 이벤트 중 가장 오래된 것이 몇 분 전인지 (recent(762) 에 여유를 둔 값). */
const SEED_SPAN_MINUTES = 780

/**
 * n 분 전. 오늘이 SEED_SPAN_MINUTES 만큼 지나지 않았으면 간격을 같은 비율로 줄여서
 * 전부 오늘 안에, 순서는 그대로 들어오게 한다 — 새벽에 띄워도 '오늘'이 비지 않게.
 *
 * 디자인 화면의 시각(14:32 …)을 그대로 박으면 오전에는 전부 미래 이벤트라, 2f
 * 조각 타임라인에 조각이 하나도 안 생긴다.
 */
const recent = (minutes: number): string => {
  const now = Date.now()
  const elapsedToday = now - new Date(now).setHours(0, 0, 0, 0)
  const scale = Math.min(1, elapsedToday / (SEED_SPAN_MINUTES * 60_000))
  return new Date(now - minutes * 60_000 * scale).toISOString()
}
const addSeconds = (iso: string, seconds: number): string =>
  new Date(Date.parse(iso) + seconds * 1000).toISOString()
const minutesAgo = (minutes: number): string => new Date(Date.now() - minutes * 60_000).toISOString()

/* ------------------------------------------------------------------ 시드 */

export const STORE_GANGNAM = 'store-gangnam-1'
const STORE_YEOKSAM = 'store-yeoksam'
const USER_ID = 'user-mock-owner'

interface CameraRow extends CameraDto {
  readonly deletedAt: string | null
  readonly stateUpdatedAt: string | null
}

export interface CameraSeed {
  readonly suffix: string
  readonly name: string
  readonly locationTag: LocationTag
  readonly state: CameraRuntimeState
  readonly lastFrameMinutesAgo: number
}

/** 이 PC 가 부르는 카메라 id. 서버 카메라와 이어 붙는 유일한 키다 — 2c 타일이 이걸로 조인한다. */
export const agentCameraIdOf = (suffix: string): string => `urn:uuid:mock-${suffix}`
export const serverCameraIdOf = (suffix: string): string => `cam-${suffix}`

/**
 * 시드 카메라. 데모 부팅(lib/demo.ts)이 '이 PC 에 등록된 카메라' 목록을 만들 때도 같은 표를
 * 읽는다 — 두 곳에 따로 적으면 id 가 조용히 어긋나 타일이 서버 이름·끊김 시간을 못 찾는다.
 */
export const CAMERA_SEEDS: readonly CameraSeed[] = [
  { suffix: '01', name: '계산대', locationTag: 'checkout', state: 'connected', lastFrameMinutesAgo: 0 },
  { suffix: '02', name: '출입문', locationTag: 'entrance', state: 'connected', lastFrameMinutesAgo: 1 },
  { suffix: '03', name: '진열대 A', locationTag: 'shelf', state: 'connected', lastFrameMinutesAgo: 1 },
  { suffix: '04', name: '취식대', locationTag: 'dining', state: 'connected', lastFrameMinutesAgo: 1 },
  // 디자인 2c — "◌ 재연결 중 · 마지막 화면 14:20 · 창고 끊김 11분"
  { suffix: '05', name: '창고', locationTag: 'storage', state: 'reconnecting', lastFrameMinutesAgo: 11 },
]

const cameraRow = (seed: CameraSeed, sortOrder: number): CameraRow => ({
  id: serverCameraIdOf(seed.suffix),
  storeId: STORE_GANGNAM,
  agentCameraId: agentCameraIdOf(seed.suffix),
  name: seed.name,
  locationTag: seed.locationTag,
  sortOrder,
  streamProfile: 'sub',
  state: seed.state,
  lastFrameAt: minutesAgo(seed.lastFrameMinutesAgo),
  lastSegmentAt: minutesAgo(seed.lastFrameMinutesAgo),
  deletedAt: null,
  stateUpdatedAt:
    seed.state === 'connected' ? minutesAgo(180) : minutesAgo(seed.lastFrameMinutesAgo),
})

interface EventRow extends EventDetail {
  readonly memo: string | null
}

/** 위험도가 나오게 하는 점수 (백엔드 규칙: 점수 ÷ 임계값 1.5배 이상 높음, 1.2배 이상 보통). */
const MOCK_THRESHOLD = 0.6
const MOCK_SCORE: Record<RiskLevel, number> = { high: 0.96, medium: 0.78, low: 0.66 }

const event = (input: {
  id: string
  cameraId: string
  risk: RiskLevel
  state: EventState
  startedAt: string
  durationSec: number
}): EventRow => ({
  id: input.id,
  storeId: STORE_GANGNAM,
  cameraId: input.cameraId,
  cameraName: null,
  locationTag: null,
  risk: input.risk,
  state: input.state,
  startedAt: input.startedAt,
  endedAt: addSeconds(input.startedAt, input.durationSec),
  durationSec: input.durationSec,
  thumbnailUrl: frame(''),
  createdAt: addSeconds(input.startedAt, input.durationSec + 40),
  anomalyScore: MOCK_SCORE[input.risk],
  anomalyThreshold: MOCK_THRESHOLD,
  memo: null,
  falsePositiveReason: null,
  clipUrl: null,
  clipExpiresAt: addSeconds(input.startedAt, 30 * 86_400),
  segments: [],
  history: [],
})

/** 데모 부팅에서 강남 1호점에 덧씌우는 값 — 이미 이 PC 가 연결됐고, 조각도 짧다. */
export interface DemoStoreSeed {
  readonly segmentSeconds: SegmentSeconds
  readonly deviceId: string
  readonly deviceLabel: string
}

const initialDb = (demo?: DemoStoreSeed) => ({
  stores: [
    {
      id: STORE_GANGNAM,
      name: '강남 1호점',
      address: '서울 강남구 테헤란로 123 1층',
      opensAt: '09:00',
      closesAt: '21:00',
      segmentSeconds: demo?.segmentSeconds ?? (60 as SegmentSeconds),
      clipRetentionDays: 30,
      cameraCount: 5,
      device: demo
        ? {
            id: `device-${STORE_GANGNAM}`,
            deviceId: demo.deviceId,
            label: demo.deviceLabel,
            agentVersion: '1.0.0',
            online: true,
            lastHeartbeatAt: new Date().toISOString(),
            spoolBytes: 0,
            uploadedBytesToday: Math.round(1.8 * 1024 ** 3),
          }
        : null,
      unconfirmedCount: 0,
    },
    {
      id: STORE_YEOKSAM,
      name: '역삼점',
      address: '서울 강남구 역삼로 45',
      opensAt: '00:00',
      closesAt: '23:59',
      segmentSeconds: 60 as SegmentSeconds,
      clipRetentionDays: 30,
      cameraCount: 3,
      // 디자인 2a — "다른 PC가 연결돼 있음 — 선택하면 교체"
      device: {
        id: 'device-yeoksam',
        deviceId: 'agent-other-pc',
        label: '역삼점 카운터 PC',
        agentVersion: '1.0.0',
        online: true,
        lastHeartbeatAt: minutesAgo(1),
        spoolBytes: 0,
        uploadedBytesToday: 0,
      },
      unconfirmedCount: 0,
    },
  ] as readonly StoreDto[],
  cameras: CAMERA_SEEDS.map((seed, index) => cameraRow(seed, index + 1)) as readonly CameraRow[],
  events: [
    event({
      id: 'evt-1432',
      cameraId: 'cam-01',
      risk: 'high',
      state: 'unconfirmed',
      startedAt: recent(20),
      durationSec: 31,
    }),
    event({
      id: 'evt-1305',
      cameraId: 'cam-02',
      risk: 'medium',
      state: 'unconfirmed',
      startedAt: recent(107),
      durationSec: 720,
    }),
    event({
      id: 'evt-1140',
      cameraId: 'cam-04',
      risk: 'medium',
      state: 'confirmed',
      startedAt: recent(192),
      durationSec: 95,
    }),
    event({
      id: 'evt-0912',
      cameraId: 'cam-03',
      risk: 'high',
      state: 'false_positive',
      startedAt: recent(340),
      durationSec: 18,
    }),
    event({
      id: 'evt-0210',
      cameraId: 'cam-02',
      risk: 'medium',
      state: 'confirmed',
      startedAt: recent(762),
      durationSec: 2400,
    }),
  ] as readonly EventRow[],
  notifications: {
    minRisk: 'low',
    quietHours: {
      businessHoursHighOnly: true,
      sleepStart: '01:00',
      sleepEnd: '07:00',
      sleepHighOnly: true,
      overrideDndForHigh: true,
    },
  } as NotificationSettings,
})

/* ---------------------------------------------------------------- 서버 */

export interface MockServer {
  request(request: ServerRequest): Promise<ServerResult>
  startStream(storeId: string): void
  stopStream(): void
  onStream(listener: (message: ServerStreamMessage) => void): () => void
  onStreamState(listener: (state: StreamConnectionState) => void): () => void
  /** 개발용 — 새 위험 이벤트를 만들어 SSE 로 흘린다 (2d 팝업 확인). */
  emitRiskEvent(input?: Partial<Pick<EventListItem, 'risk' | 'cameraId'>>): EventListItem
  /**
   * 방금 새 조각이 올라왔다고 알린다 (데모 시나리오).
   * 시드 시각을 그대로 두면 데모를 오래 켜 둘수록 타일이 '연결됨 · 12분 전'으로 밀린다.
   */
  recordSegment(): void
  /**
   * 가짜 에이전트가 카메라별로 보고할 상태. 가짜 서버의 카메라 상태와 맞춰서
   * 2c 의 '재연결 중 · 끊김' 타일이 개발 모드에서도 보이게 한다.
   */
  agentCameraState(agentCameraId: string): 'streaming' | 'reconnecting' | 'auth-failed'
}

const ok = (data: unknown, status = 200): ServerResult => ({ ok: true, status, data })
const fail = (status: number, error: string, extra: Record<string, unknown> = {}): ServerResult => ({
  ok: false,
  status,
  error,
  data: { error, ...extra },
})

// 실제 서버처럼 살짝 늦게 답한다 — 로딩 상태가 화면에 한 번은 보이게.
const LATENCY_MS = 160

export interface MockServerOptions {
  /** 주면 데모 부팅으로 시드한다. 평소 미리보기에서는 주지 않는다. */
  readonly demo?: DemoStoreSeed
}

export const createMockServer = ({ demo }: MockServerOptions = {}): MockServer => {
  const state = {
    db: initialDb(demo),
    streamStore: null as string | null,
    streamListeners: new Set<(message: ServerStreamMessage) => void>(),
    stateListeners: new Set<(state: StreamConnectionState) => void>(),
    counter: 0,
  }

  const emitState = (next: StreamConnectionState): void =>
    state.stateListeners.forEach((listener) => listener(next))
  const emit = (message: ServerStreamMessage): void => {
    if (state.streamStore === null) return
    state.streamListeners.forEach((listener) => listener(message))
  }

  const activeCameras = (storeId: string): readonly CameraRow[] =>
    state.db.cameras
      .filter((c) => c.storeId === storeId && c.deletedAt === null)
      .toSorted((a, b) => a.sortOrder - b.sortOrder)

  const toCameraDto = ({ deletedAt: _d, stateUpdatedAt: _s, ...dto }: CameraRow): CameraDto => dto

  const toListItem = (row: EventRow): EventListItem => {
    const cam = state.db.cameras.find((c) => c.id === row.cameraId)
    return {
      id: row.id,
      storeId: row.storeId,
      cameraId: row.cameraId,
      cameraName: cam?.name ?? null,
      locationTag: cam?.locationTag ?? null,
      risk: row.risk,
      state: row.state,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      durationSec: row.durationSec,
      thumbnailUrl: row.thumbnailUrl,
      createdAt: row.createdAt,
    }
  }

  const storeView = (store: StoreDto): StoreDto => ({
    ...store,
    cameraCount: activeCameras(store.id).length || store.cameraCount,
    unconfirmedCount: state.db.events.filter((e) => e.storeId === store.id && e.state === 'unconfirmed').length,
  })

  const updateEvent = (eventId: string, patch: Partial<EventRow>): EventRow | null => {
    const current = state.db.events.find((e) => e.id === eventId)
    if (!current) return null
    const next = { ...current, ...patch }
    state.db = { ...state.db, events: state.db.events.map((e) => (e.id === eventId ? next : e)) }
    return next
  }

  const routes: readonly {
    method: ServerRequest['method']
    pattern: RegExp
    // 요청 body 는 화면이 보내는 계약 모양이다. 개발용 흉내라 필드 검증은 하지 않는다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    handle: (match: RegExpMatchArray, body: any, params: URLSearchParams) => ServerResult
  }[] = [
    {
      method: 'GET',
      pattern: /^\/stores$/,
      handle: () => ok({ stores: state.db.stores.map(storeView) }),
    },
    {
      method: 'POST',
      pattern: /^\/stores$/,
      handle: (_m, body) => {
        state.counter += 1
        const store: StoreDto = {
          id: `store-new-${state.counter}`,
          name: body?.name ?? '새 매장',
          address: body?.address ?? null,
          opensAt: null,
          closesAt: null,
          segmentSeconds: 60,
          clipRetentionDays: 30,
          cameraCount: 0,
          device: null,
          unconfirmedCount: 0,
        }
        state.db = { ...state.db, stores: [...state.db.stores, store] }
        return ok({ store }, 201)
      },
    },
    {
      method: 'PATCH',
      pattern: /^\/stores\/([^/]+)$/,
      handle: ([, storeId], body) => {
        const current = state.db.stores.find((s) => s.id === storeId)
        if (!current) return fail(404, '매장을 찾을 수 없습니다')
        const next = { ...current, ...body }
        state.db = { ...state.db, stores: state.db.stores.map((s) => (s.id === storeId ? next : s)) }
        return ok({ store: storeView(next) })
      },
    },
    {
      method: 'POST',
      pattern: /^\/stores\/([^/]+)\/devices$/,
      handle: ([, storeId], body) => {
        const store = state.db.stores.find((s) => s.id === storeId)
        if (!store) return fail(404, '매장을 찾을 수 없습니다')
        const other = store.device && store.device.deviceId !== body?.deviceId ? store.device : null
        if (other && !body?.replaceExisting) {
          return fail(409, '이 매장에는 이미 연결된 PC 가 있습니다', { existingDevice: other })
        }
        const device = {
          id: `device-${storeId}`,
          deviceId: body?.deviceId ?? 'agent-mock',
          label: body?.label ?? null,
          agentVersion: body?.agentVersion ?? '1.0.0',
          online: true,
          lastHeartbeatAt: new Date().toISOString(),
          spoolBytes: 0,
          uploadedBytesToday: 0,
        }
        state.db = {
          ...state.db,
          stores: state.db.stores.map((s) => (s.id === storeId ? { ...s, device } : s)),
        }
        return ok({ ...device, deviceToken: 'ss_dev_mock_token', replacedDeviceId: other?.id ?? null }, 201)
      },
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/cameras$/,
      handle: ([, storeId]) => ok({ cameras: activeCameras(storeId ?? '').map(toCameraDto) }),
    },
    {
      method: 'POST',
      pattern: /^\/stores\/([^/]+)\/cameras$/,
      handle: ([, storeId], body) => {
        const existing = state.db.cameras.find(
          (c) => c.storeId === storeId && c.agentCameraId === body?.agentCameraId,
        )
        if (existing) {
          const next: CameraRow = { ...existing, ...body, deletedAt: null }
          state.db = { ...state.db, cameras: state.db.cameras.map((c) => (c.id === existing.id ? next : c)) }
          return ok({ camera: toCameraDto(next) })
        }
        if (activeCameras(storeId ?? '').length >= 8) {
          return fail(400, '카메라는 매장당 8대까지 등록할 수 있습니다')
        }
        state.counter += 1
        const row: CameraRow = {
          id: `cam-new-${state.counter}`,
          storeId: storeId ?? '',
          agentCameraId: body?.agentCameraId,
          name: body?.name,
          locationTag: body?.locationTag ?? null,
          sortOrder: body?.sortOrder ?? activeCameras(storeId ?? '').length + 1,
          streamProfile: body?.streamProfile ?? 'sub',
          state: 'connected',
          lastFrameAt: new Date().toISOString(),
          lastSegmentAt: null,
          deletedAt: null,
          stateUpdatedAt: new Date().toISOString(),
        }
        state.db = { ...state.db, cameras: [...state.db.cameras, row] }
        return ok({ camera: toCameraDto(row) }, 201)
      },
    },
    {
      method: 'PATCH',
      pattern: /^\/cameras\/([^/]+)$/,
      handle: ([, cameraId], body) => {
        const current = state.db.cameras.find((c) => c.id === cameraId)
        if (!current) return fail(404, '카메라를 찾을 수 없습니다')
        const next = { ...current, ...body }
        state.db = { ...state.db, cameras: state.db.cameras.map((c) => (c.id === cameraId ? next : c)) }
        return ok({ camera: toCameraDto(next) })
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/cameras\/([^/]+)$/,
      handle: ([, cameraId]) => {
        state.db = {
          ...state.db,
          cameras: state.db.cameras.map((c) =>
            c.id === cameraId ? { ...c, deletedAt: new Date().toISOString() } : c,
          ),
        }
        return ok(null, 204)
      },
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/monitoring$/,
      handle: ([, storeId]) => {
        const store = state.db.stores.find((s) => s.id === storeId)
        const cameras: MonitoringCamera[] = activeCameras(storeId ?? '').map((row) => ({
          ...toCameraDto(row),
          disconnectedForSec:
            row.state === 'connected' || !row.stateUpdatedAt
              ? null
              : Math.round((Date.now() - Date.parse(row.stateUpdatedAt)) / 1000),
        }))
        return ok({
          device: {
            online: true,
            lastHeartbeatAt: new Date().toISOString(),
            agentVersion: '1.0.0',
            spoolBytes: 0,
            // 디자인 2c — "오늘 전송 1.8 GB"
            uploadedBytesToday: Math.round(1.8 * 1024 ** 3),
          },
          segmentSeconds: store?.segmentSeconds ?? 60,
          cameras,
          lastAnalyzedAt: minutesAgo(1),
          monitoringCount: cameras.filter((c) => c.state === 'connected').length,
          totalCount: cameras.length,
        })
      },
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/events\/timeline$/,
      handle: ([, storeId], _body, params) => {
        const date = params.get('date') ?? new Date().toISOString().slice(0, 10)
        const [y, m, d] = date.split('-').map(Number)
        const dayStart = new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1)
        const dayEnd = new Date(dayStart.getTime() + 86_400_000)
        const windowEnd = new Date(Math.min(dayEnd.getTime(), Date.now()))
        return ok({
          date,
          windowStart: dayStart.toISOString(),
          windowEnd: windowEnd.toISOString(),
          cameras: activeCameras(storeId ?? '').map((cam) => ({
            cameraId: cam.id,
            name: cam.name,
            locationTag: cam.locationTag,
            events: state.db.events
              .filter((e) => e.cameraId === cam.id && Date.parse(e.startedAt) >= dayStart.getTime() && Date.parse(e.startedAt) < dayEnd.getTime())
              .map((e) => ({ id: e.id, startedAt: e.startedAt, endedAt: e.endedAt, risk: e.risk, state: e.state })),
            // 창고 카메라는 11분 전부터 끊겼다. 새벽에도 한 번 끊겼던 것으로 둔다.
            gaps:
              cam.locationTag === 'storage'
                ? [
                    { from: recent(300), to: recent(210), reason: 'no_segment' },
                    { from: minutesAgo(11), to: windowEnd.toISOString(), reason: 'no_segment' },
                  ]
                : [],
          })),
        })
      },
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/events\/summary$/,
      // 디자인 2e — "이번 주 · 위험 12건 · 오탐 3건 · 신고 1건". 서버의 total 은 오탐까지 센 수다 (12 + 3).
      handle: () =>
        ok({
          from: new Date(Date.now() - 7 * 86_400_000).toISOString(),
          to: new Date().toISOString(),
          total: 15,
          falsePositive: 3,
          reported: 1,
          byWeekday: [1, 2, 1, 3, 2, 2, 1],
          byHour: Array.from({ length: 24 }, (_, hour) => (hour === 14 || hour === 2 ? 2 : hour % 5 === 0 ? 1 : 0)),
        }),
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/events\/unconfirmed-count$/,
      handle: ([, storeId]) =>
        ok({ count: state.db.events.filter((e) => e.storeId === storeId && e.state === 'unconfirmed').length }),
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/events$/,
      handle: ([, storeId], _body, params) => {
        const date = params.get('date')
        const filtered = state.db.events
          .filter((e) => e.storeId === storeId)
          // 날짜는 매장 벽시계 기준이다 — UTC 로 자르면 새벽 이벤트가 전날로 넘어간다.
          .filter((e) => !date || new Date(e.startedAt).toDateString() === new Date(`${date}T12:00:00`).toDateString())
          .filter((e) => !params.get('state') || e.state === params.get('state'))
          .filter((e) => !params.get('risk') || e.risk === params.get('risk'))
          .filter((e) => !params.get('cameraId') || e.cameraId === params.get('cameraId'))
        // 계약 5.1 — 미확인 먼저, 나머지는 상태와 무관하게 최신순. 디자인 2e 에서도
        // 11:40 확인됨 → 09:12 오탐 → 02:10 확인됨 으로 시각순으로 섞인다.
        const sorted = filtered.toSorted(
          (a, b) =>
            Number(b.state === 'unconfirmed') - Number(a.state === 'unconfirmed') ||
            Date.parse(b.startedAt) - Date.parse(a.startedAt),
        )
        return ok({ items: sorted.map(toListItem), nextCursor: null })
      },
    },
    {
      method: 'GET',
      pattern: /^\/events\/([^/]+)\/nearby-cameras$/,
      handle: ([, eventId]) => {
        const target = state.db.events.find((e) => e.id === eventId)
        if (!target) return fail(404, '이벤트를 찾을 수 없습니다')
        return ok({
          cameras: activeCameras(target.storeId)
            .filter((c) => c.id !== target.cameraId)
            .map((c) => ({
              cameraId: c.id,
              name: c.name,
              locationTag: c.locationTag,
              // 미리보기 모드에는 실제 영상이 없다. 화면은 '영상 없음'으로 그린다.
              playbackUrl: null,
              segmentStartedAt: addSeconds(target.startedAt, -18),
              offsetSec: 18,
            })),
        })
      },
    },
    {
      method: 'GET',
      pattern: /^\/events\/([^/]+)\/clip$/,
      handle: () => fail(404, '클립이 없습니다 (미리보기 모드)'),
    },
    {
      method: 'GET',
      pattern: /^\/events\/([^/]+)$/,
      handle: ([, eventId]) => {
        const row = state.db.events.find((e) => e.id === eventId)
        if (!row) return fail(404, '이벤트를 찾을 수 없습니다')
        return ok({ event: { ...row, ...toListItem(row) } })
      },
    },
    {
      method: 'PATCH',
      pattern: /^\/events\/([^/]+)\/state$/,
      handle: ([, eventId], body) => {
        const current = state.db.events.find((e) => e.id === eventId)
        if (!current) return fail(404, '이벤트를 찾을 수 없습니다')
        const entry: EventHistoryItem = {
          fromState: current.state,
          toState: body?.state,
          changedBy: USER_ID,
          source: body?.source ?? 'pc',
          reason: body?.reason ?? null,
          createdAt: new Date().toISOString(),
        }
        const next = updateEvent(eventId ?? '', {
          state: body?.state,
          falsePositiveReason: body?.state === 'false_positive' ? (body?.reason ?? null) : null,
          history: [...current.history, entry],
        })
        const item = toListItem(next as EventRow)
        emit({ type: 'event.updated', data: item })
        return ok({ event: item })
      },
    },
    {
      method: 'DELETE',
      pattern: /^\/events\/([^/]+)$/,
      handle: ([, eventId]) => {
        const current = state.db.events.find((e) => e.id === eventId)
        if (!current) return fail(404, '이벤트를 찾을 수 없습니다')
        state.db = { ...state.db, events: state.db.events.filter((e) => e.id !== eventId) }
        emit({ type: 'event.deleted', data: { id: eventId ?? '' } })
        return ok(null, 204)
      },
    },
    {
      method: 'PATCH',
      pattern: /^\/events\/([^/]+)\/memo$/,
      handle: ([, eventId], body) => {
        const next = updateEvent(eventId ?? '', { memo: body?.memo ?? '' })
        if (!next) return fail(404, '이벤트를 찾을 수 없습니다')
        const item = toListItem(next)
        emit({ type: 'event.updated', data: item })
        return ok({ event: { ...item, memo: next.memo } })
      },
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/segments$/,
      handle: ([, storeId], _body, params) => {
        // 1분 조각을 벽시계에 맞춰 만든다. 창고는 11분 전부터 끊겨 조각이 없다.
        const cameraId = params.get('cameraId')
        const from = Date.parse(params.get('from') ?? '')
        const to = Date.parse(params.get('to') ?? '')
        const cam = activeCameras(storeId ?? '').find((c) => c.id === cameraId)
        if (!cam || Number.isNaN(from) || Number.isNaN(to)) return ok({ segments: [] })
        const store = state.db.stores.find((s) => s.id === storeId)
        const length = (store?.segmentSeconds ?? 60) * 1000
        const brokenSince = cam.state === 'connected' ? Infinity : Date.parse(cam.stateUpdatedAt ?? '')
        const first = Math.ceil(from / length) * length
        const count = Math.max(0, Math.floor((to - first) / length))
        const segments = Array.from({ length: count }, (_, index) => first + index * length)
          .filter((start) => start + length <= Date.now() && start < brokenSince)
          .map((start) => ({
            videoId: `vid-${cam.id}-${start}`,
            cameraId: cam.id,
            sequence: Math.floor(start / length) % 100_000,
            startedAt: new Date(start).toISOString(),
            endedAt: new Date(start + length).toISOString(),
            durationSec: length / 1000,
            status: 'done',
            playbackUrl: null,
          }))
          .reverse()
        return ok({ segments })
      },
    },
    {
      method: 'GET',
      pattern: /^\/stores\/([^/]+)\/notification-settings$/,
      handle: () => ok(state.db.notifications),
    },
    {
      method: 'PUT',
      pattern: /^\/stores\/([^/]+)\/notification-settings$/,
      handle: (_m, body) => {
        if (!['low', 'medium', 'high'].includes(body?.minRisk)) {
          return fail(400, 'minRisk 는 low / medium / high 중 하나여야 합니다')
        }
        state.db = { ...state.db, notifications: body }
        return ok(state.db.notifications)
      },
    },
    {
      method: 'POST',
      pattern: /^\/stores\/([^/]+)\/notification-settings\/test$/,
      handle: () => ok({ sent: true, deviceCount: 1 }),
    },
  ]

  const emitRiskEvent: MockServer['emitRiskEvent'] = (input = {}) => {
    state.counter += 1
    const startedAt = new Date(Date.now() - 45_000).toISOString()
    const row = event({
      id: `evt-live-${state.counter}`,
      cameraId: input.cameraId ?? 'cam-01',
      risk: input.risk ?? 'high',
      state: 'unconfirmed',
      startedAt,
      durationSec: 31,
    })
    state.db = { ...state.db, events: [row, ...state.db.events] }
    const item = toListItem(row)
    emit({ type: 'event.created', data: item })
    return item
  }

  return {
    request: async ({ method, path, body }) => {
      await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
      const url = new URL(path, 'http://mock')
      for (const route of routes) {
        if (route.method !== method) continue
        const match = url.pathname.match(route.pattern)
        if (match) return route.handle(match, body, url.searchParams)
      }
      return fail(404, `미리보기 서버에 없는 경로입니다: ${method} ${url.pathname}`)
    },

    startStream: (storeId) => {
      state.streamStore = storeId
      emitState('connecting')
      setTimeout(() => {
        if (state.streamStore !== storeId) return
        emitState('open')
        emit({ type: 'ready', data: { storeId } })
      }, 300)
    },

    stopStream: () => {
      state.streamStore = null
      emitState('idle')
    },

    onStream: (listener) => {
      state.streamListeners.add(listener)
      return () => state.streamListeners.delete(listener)
    },

    onStreamState: (listener) => {
      state.stateListeners.add(listener)
      return () => state.stateListeners.delete(listener)
    },

    emitRiskEvent,

    recordSegment: () => {
      const at = new Date().toISOString()
      const isLive = (row: CameraRow): boolean => row.deletedAt === null && row.state === 'connected'
      state.db = {
        ...state.db,
        cameras: state.db.cameras.map((row) =>
          isLive(row) ? { ...row, lastFrameAt: at, lastSegmentAt: at } : row,
        ),
      }
      state.db.cameras
        .filter(isLive)
        .forEach((row) =>
          emit({ type: 'camera.state', data: { cameraId: row.id, state: row.state, lastFrameAt: at } }),
        )
    },

    agentCameraState: (agentCameraId) => {
      const camera = state.db.cameras.find((c) => c.agentCameraId === agentCameraId)
      if (camera?.state === 'auth_failed') return 'auth-failed'
      return camera && camera.state !== 'connected' ? 'reconnecting' : 'streaming'
    },
  }
}
