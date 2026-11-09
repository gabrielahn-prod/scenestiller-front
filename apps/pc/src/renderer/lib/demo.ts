/**
 * 공개 데모 부팅 (`?demo=1`).
 *
 * 심사위원은 주소만 열고 바로 감시 화면을 봐야 한다 — 로그인·매장 선택·카메라 추가를
 * 시킬 수 없다. 그래서 화면 코드에 분기를 넣는 대신, 브라우저용 가짜 API 가 들고 있는
 * 상태(세션·설정·에이전트 상태)와 가짜 서버의 시드를 '이미 다 끝난' 모습으로 심는다.
 * 화면들은 자기가 데모인지 모른다.
 *
 * Electron 안(window.api 가 있는 곳)에서는 절대 켜지지 않는다.
 */
import type { SessionSummary } from '../../shared/ipc'
import type { EventListItem, RiskLevel, SegmentSeconds } from '../../shared/server-types'
import {
  DEFAULT_CONFIG,
  spoolLimitPerCamera,
  type AgentConfig,
  type AgentStatus,
  type SelectedCamera,
} from '../../shared/types'
import { RISK_LABEL } from './labels'
import {
  agentCameraIdOf,
  serverCameraIdOf,
  CAMERA_SEEDS,
  STORE_GANGNAM,
  type DemoStoreSeed,
  type MockServer,
} from './mock-server'

/* ----------------------------------------------------------------- 켜짐 여부 */

const queryOf = (source: string): URLSearchParams => {
  const start = source.indexOf('?')
  return new URLSearchParams(start === -1 ? '' : source.slice(start + 1))
}

const demoRequested = (): boolean => {
  // HashRouter 라 주소가 '/?demo=1' 로도 '/#/live?demo=1' 로도 들어온다. 둘 다 받는다.
  const value = queryOf(window.location.search).get('demo') ?? queryOf(window.location.hash).get('demo')
  return value === '1' || value === 'true'
}

export const isDemo = typeof window !== 'undefined' && !window.api && demoRequested()

/* --------------------------------------------------------------------- 시드 */

/** 심사위원은 5분을 기다려 주지 않는다. 조각이 짧을수록 위험 알림이 빨리 뜬다. */
export const DEMO_SEGMENT_SECONDS: SegmentSeconds = 30

/**
 * 데모에서 카메라 타일이 틀 영상.
 * 배포본은 `/<base>/pc/` 아래 있으므로 한 칸 올라가면 셸과 모바일이 함께 쓰는 clips 가 있다.
 * 개발 중(5174 단독)에는 이 파일이 없어서 타일이 예전처럼 정지 화면으로 남는다 — 그래도 괜찮다.
 */
export const demoClipUrl = (): string => new URL('../clips/sample.mp4', document.baseURI).pathname

const DEMO_DEVICE_ID = 'agent-demo0001'

export const DEMO_SESSION: SessionSummary = {
  signedIn: true,
  userId: 'user-mock-owner',
  phone: '010-1234-5678',
}

export const demoStoreSeed: DemoStoreSeed = {
  segmentSeconds: DEMO_SEGMENT_SECONDS,
  deviceId: DEMO_DEVICE_ID,
  deviceLabel: '강남 1호점 계산대 PC',
}

const DEMO_CAMERAS: readonly SelectedCamera[] = CAMERA_SEEDS.map((seed, index) => ({
  id: agentCameraIdOf(seed.suffix),
  name: seed.name,
  manufacturer: 'HIKVISION',
  model: 'DS-2CD2143G2',
  rtspUri: `rtsp://admin:***@192.168.0.${64 + index}:554/Streaming/Channels/102`,
  streamProfile: 'sub',
  codec: 'h264',
  width: 704,
  height: 480,
  fps: 15,
}))

export const demoConfig = (base: AgentConfig): AgentConfig => ({
  ...base,
  storeId: STORE_GANGNAM,
  deviceId: DEMO_DEVICE_ID,
  deviceToken: 'ss_dev_demo_token',
  segmentSeconds: DEMO_SEGMENT_SECONDS,
  cameras: DEMO_CAMERAS,
})

/** 하루 치 업로드 — 디자인 2c 의 '오늘 전송 1.8 GB'. */
const UPLOADED_BYTES_TODAY = Math.round(1.8 * 1024 ** 3)
const SEGMENTS_UPLOADED_TODAY = 412

/** 감시가 이미 돌고 있는 에이전트 상태. 끊긴 카메라는 끊긴 시각에서 숫자가 멈춰 있다. */
export const demoStatus = (cameraState: MockServer['agentCameraState']): AgentStatus => ({
  running: true,
  upload: 'idle',
  cameras: CAMERA_SEEDS.map((seed) => {
    const cameraId = agentCameraIdOf(seed.suffix)
    const state = cameraState(cameraId)
    const missed = Math.round((seed.lastFrameMinutesAgo * 60) / DEMO_SEGMENT_SECONDS)
    return {
      cameraId,
      name: seed.name,
      camera: state,
      uploadedCount: state === 'streaming' ? SEGMENTS_UPLOADED_TODAY : SEGMENTS_UPLOADED_TODAY - missed,
      pendingCount: 0,
      lastUploadAt: new Date(Date.now() - seed.lastFrameMinutesAgo * 60_000).toISOString(),
      spoolBytes: 0,
      lastError: null,
      spoolEvicted: false,
    }
  }),
  bytesUploadedToday: UPLOADED_BYTES_TODAY,
  spoolLimitBytesPerCamera: spoolLimitPerCamera(DEFAULT_CONFIG.spoolLimitBytes, CAMERA_SEEDS.length),
  lastError: null,
})

/* --------------------------------------------------------------------- 훅 */

export interface ScenarioStep {
  readonly phase: 'streaming' | 'segment' | 'risk'
  readonly label: string
  readonly detail?: string
}

export interface TriggeredRisk {
  readonly eventId: string
  readonly cameraName: string
  /** 이벤트 시작 시각(ISO). 바깥 데모 페이지가 같은 시각으로 휴대폰 알림을 맞춘다. */
  readonly at: string
}

export interface RiskOptions {
  readonly cameraId?: string
  readonly risk?: RiskLevel
}

export interface SceneStealerHook {
  readonly isDemo: boolean
  emitRiskEvent(input?: Partial<Pick<EventListItem, 'risk' | 'cameraId'>>): EventListItem | null
  startScenario(): void
  stopScenario(): void
  triggerRisk(options?: RiskOptions): TriggeredRisk | null
  onScenario(listener: (step: ScenarioStep) => void): () => void
  /**
   * 휴대폰에서 처리한 결과를 이 PC 에도 반영한다.
   * 사장님이 밖에서 확인을 누르면 매장 PC 의 경고도 같이 내려가야 한다 — 그 한 장면이
   * 두 앱이 한 제품이라는 걸 보여 준다. 반영에 성공했는지 돌려준다.
   */
  applyState(eventId: string, state: 'confirmed' | 'false_positive'): Promise<boolean>
}

declare global {
  interface Window {
    /**
     * 개발·데모용 훅. 콘솔에서 window.__sceneStealer.emitRiskEvent() 로 2d 팝업을 띄우고,
     * 바깥 데모 페이지가 startScenario() · triggerRisk() 로 시연을 몬다.
     */
    __sceneStealer?: SceneStealerHook
  }
}

/**
 * 진짜 Electron 에 심어 두는 껍데기 — 바깥 데모 페이지의 코드가 앱 안에서 돌아도 터지지 않게.
 * null 을 돌려준다: 있지도 않은 이벤트 번호로 휴대폰 알림을 보내면 안 된다.
 */
export const inertDemoHook: SceneStealerHook = {
  isDemo: false,
  emitRiskEvent: () => null,
  startScenario: () => undefined,
  stopScenario: () => undefined,
  triggerRisk: () => null,
  onScenario: () => () => undefined,
  applyState: async () => false,
}

export interface DemoHookDeps {
  readonly server: MockServer
  /** 조각 하나를 만들어 올린다. 올린 카메라 수를 돌려준다 (0 이면 감시가 멈춰 있다). */
  readonly uploadSegment: () => number
}

/** 새 조각이 도는 간격. 조각 길이(30초)보다 짧게 둬서 시연 중에 숫자가 계속 움직인다. */
const SCENARIO_INTERVAL_MS = 8_000

export const createDemoHook = ({ server, uploadSegment }: DemoHookDeps): SceneStealerHook => {
  const listeners = new Set<(step: ScenarioStep) => void>()
  const scenario = { timer: null as ReturnType<typeof setInterval> | null }

  const emit = (step: ScenarioStep): void => listeners.forEach((listener) => listener(step))

  /** 바깥 페이지는 서버 카메라 id('cam-01') 와 이 PC 의 카메라 id 중 아무거나 줄 수 있다. */
  const resolveCameraId = (cameraId?: string): string | undefined => {
    if (!cameraId) return undefined
    const seed = CAMERA_SEEDS.find((candidate) => agentCameraIdOf(candidate.suffix) === cameraId)
    return seed ? serverCameraIdOf(seed.suffix) : cameraId
  }

  const emitRiskEvent = (input: Partial<Pick<EventListItem, 'risk' | 'cameraId'>> = {}): EventListItem => {
    const created = server.emitRiskEvent(input)
    emit({
      phase: 'risk',
      label: '위험 신호 감지',
      detail: `${created.cameraName ?? '카메라'} · 위험도 ${RISK_LABEL[created.risk]}`,
    })
    return created
  }

  return {
    isDemo,
    emitRiskEvent,

    startScenario: () => {
      if (scenario.timer !== null) return
      scenario.timer = setInterval(() => {
        const uploaded = uploadSegment()
        if (uploaded === 0) return
        emit({
          phase: 'segment',
          label: '새 조각 업로드',
          detail: `${uploaded}대 · ${DEMO_SEGMENT_SECONDS}초`,
        })
      }, SCENARIO_INTERVAL_MS)
      emit({
        phase: 'streaming',
        label: '실시간 감시 중',
        detail: `${DEMO_SEGMENT_SECONDS}초마다 새 조각을 서버로 보냅니다`,
      })
    },

    stopScenario: () => {
      if (scenario.timer === null) return
      clearInterval(scenario.timer)
      scenario.timer = null
    },

    triggerRisk: (options = {}) => {
      const created = emitRiskEvent({
        cameraId: resolveCameraId(options.cameraId),
        risk: options.risk ?? 'high',
      })
      return {
        eventId: created.id,
        cameraName: created.cameraName ?? '카메라',
        at: created.startedAt,
      }
    },

    onScenario: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },

    applyState: async (eventId, state) => {
      // source 를 'mobile' 로 남긴다 — 처리 이력에 '휴대폰에서 확인' 이라고 찍혀야 한다.
      const result = await server.request({
        method: 'PATCH',
        path: `/events/${eventId}/state`,
        body: { state, source: 'mobile' },
      })
      return result.ok
    },
  }
}
