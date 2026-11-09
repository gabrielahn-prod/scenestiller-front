import {
  AGENT_VERSION,
  type AgentConfig,
  type AgentStatus,
  type CameraStatus,
} from '../../shared/types'
import type { CameraRuntimeState } from '../../shared/server-types'

/**
 * PC 하트비트 + 카메라 런타임 상태 보고 (요구사항 7.1 · 2.4, 계약 4.1).
 *
 * 서버는 이 신호로 "PC 가 켜져 있는가"와 "카메라가 살아 있는가"를 안다.
 * 모바일의 '창고 끊김 13분', 'PC 꺼짐 2시간'이 전부 여기서 나온다.
 * 조각 업로드와 같은 기기 토큰을 쓴다 — 사용자가 로그아웃해도 감시는 계속된다.
 */

export const HEARTBEAT_INTERVAL_MS = 30_000

export interface HeartbeatPayload {
  readonly agentVersion: string
  readonly spoolBytes: number
  readonly uploadedBytesToday: number
  readonly cameras: readonly {
    readonly agentCameraId: string
    readonly state: CameraRuntimeState
    readonly lastFrameAt: string | null
  }[]
}

/** 카메라별로 마지막으로 스트리밍 중이던 시각. */
export type LastFrameByCamera = Readonly<Record<string, string>>

const STATE: Record<CameraStatus, CameraRuntimeState> = {
  streaming: 'connected',
  reconnecting: 'reconnecting',
  // 연결을 시도하는 중이다. 사장님 화면에 '끊김'으로 겁주지 않는다.
  connecting: 'reconnecting',
  'auth-failed': 'auth_failed',
  // '일시 중지(영업 중)'로 멈춘 카메라다. 계약에 paused 가 없어서 가장 덜
  // 놀라운 값을 쓴다 — disconnected 로 보내면 모바일에 '끊김'이 뜬다.
  idle: 'unknown',
}

export const toServerCameraState = (state: CameraStatus): CameraRuntimeState => STATE[state]

/**
 * 에이전트 상태를 하트비트로 옮긴다.
 *
 * AgentStatus 에는 '마지막 프레임 시각'이 없다. 그렇다고 null 을 보내면 서버가
 * last_frame_at 을 지워서, 2c 의 '재연결 중 · 마지막 화면 14:20' 을 그릴 수 없게
 * 된다. 그래서 스트리밍 중일 때마다 시각을 기억해 두고, 끊겨도 그 값을 보낸다.
 * 하트비트 주기(30초)만큼 부정확하지만 "몇 분째 끊겼는가"에는 충분하다.
 */
export const buildHeartbeat = (
  status: AgentStatus,
  lastFrameByCamera: LastFrameByCamera,
  now: Date,
): { readonly payload: HeartbeatPayload; readonly lastFrameByCamera: LastFrameByCamera } => {
  const nowIso = now.toISOString()

  // 목록에서 빠진 카메라의 기록은 여기서 자연히 버려진다.
  const nextLastFrame = Object.fromEntries(
    status.cameras.flatMap((camera) => {
      const seen = camera.camera === 'streaming' ? nowIso : lastFrameByCamera[camera.cameraId]
      return seen ? [[camera.cameraId, seen] as const] : []
    }),
  )

  return {
    payload: {
      agentVersion: AGENT_VERSION,
      spoolBytes: status.cameras.reduce((sum, camera) => sum + camera.spoolBytes, 0),
      uploadedBytesToday: status.bytesUploadedToday,
      cameras: status.cameras.map((camera) => ({
        agentCameraId: camera.cameraId,
        state: toServerCameraState(camera.camera),
        lastFrameAt: nextLastFrame[camera.cameraId] ?? null,
      })),
    },
    lastFrameByCamera: nextLastFrame,
  }
}

export interface HeartbeatDeps {
  readonly getConfig: () => AgentConfig
  readonly getStatus: () => AgentStatus
  readonly fetch: typeof fetch
  /**
   * 서버가 알려 준 조각 길이. 조각 길이의 단일 출처는 서버다(매장 설정 '알림
   * 빠르기') — PC 는 따라간다 (계약 4.1).
   */
  readonly onSegmentSeconds: (seconds: number) => void
  readonly now?: () => Date
}

export interface Heartbeat {
  start(): void
  stop(): void
  /** 테스트·설정 변경 직후 한 번 바로 보낸다. */
  beatNow(): Promise<void>
}

export const createHeartbeat = (deps: HeartbeatDeps): Heartbeat => {
  const now = deps.now ?? (() => new Date())
  const state = {
    timer: null as NodeJS.Timeout | null,
    lastFrameByCamera: {} as LastFrameByCamera,
    inFlight: false,
  }

  const beatNow = async (): Promise<void> => {
    const config = deps.getConfig()
    // 기기 등록 전이면 보낼 곳도 자격도 없다.
    if (!config.backendBaseUrl || !config.deviceToken) return
    // 서버가 느리면 요청이 겹친다. 겹친 하트비트는 정보가 없다.
    if (state.inFlight) return
    state.inFlight = true

    const built = buildHeartbeat(deps.getStatus(), state.lastFrameByCamera, now())
    state.lastFrameByCamera = built.lastFrameByCamera

    try {
      const response = await deps.fetch(
        `${config.backendBaseUrl.replace(/\/$/, '')}/v1/devices/heartbeat`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${config.deviceToken}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(built.payload),
        },
      )
      if (!response.ok) return
      const body = (await response.json()) as { segmentSeconds?: unknown }
      if (typeof body.segmentSeconds === 'number' && body.segmentSeconds !== config.segmentSeconds) {
        deps.onSegmentSeconds(body.segmentSeconds)
      }
    } catch {
      // 인터넷이 끊겼다. 서버는 하트비트가 안 오는 것으로 'PC 꺼짐'을 안다 —
      // 여기서 할 수 있는 일은 없다. 업로드 스풀은 따로 버티고 있다.
    } finally {
      state.inFlight = false
    }
  }

  return {
    start: () => {
      if (state.timer) return
      void beatNow()
      state.timer = setInterval(() => void beatNow(), HEARTBEAT_INTERVAL_MS)
    },
    stop: () => {
      if (state.timer) clearInterval(state.timer)
      state.timer = null
    },
    beatNow,
  }
}
