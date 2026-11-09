import { describe, expect, it } from 'vitest'
import { buildHeartbeat, toServerCameraState } from '../../src/main/services/heartbeat'
import type { AgentStatus, CameraRuntimeStatus } from '../../src/shared/types'

const camera = (overrides: Partial<CameraRuntimeStatus>): CameraRuntimeStatus => ({
  cameraId: 'onvif-a',
  name: '계산대',
  camera: 'streaming',
  uploadedCount: 0,
  pendingCount: 0,
  lastUploadAt: null,
  spoolBytes: 0,
  lastError: null,
  spoolEvicted: false,
  ...overrides,
})

const status = (cameras: readonly CameraRuntimeStatus[], overrides: Partial<AgentStatus> = {}): AgentStatus => ({
  running: true,
  upload: 'idle',
  cameras,
  bytesUploadedToday: 0,
  spoolLimitBytesPerCamera: 0,
  lastError: null,
  ...overrides,
})

const T0 = new Date('2026-09-16T05:00:00.000Z')
const T1 = new Date('2026-09-16T05:00:30.000Z')

describe('toServerCameraState', () => {
  it('에이전트 상태를 계약의 runtime_state 로 옮긴다', () => {
    expect(toServerCameraState('streaming')).toBe('connected')
    expect(toServerCameraState('reconnecting')).toBe('reconnecting')
    // 연결을 시도하는 중이다. 사장님 화면에서 '끊김'으로 겁주지 않는다.
    expect(toServerCameraState('connecting')).toBe('reconnecting')
    expect(toServerCameraState('auth-failed')).toBe('auth_failed')
  })

  it('감시를 멈춘 카메라는 끊김이 아니라 unknown 이다', () => {
    // '일시 중지(영업 중)'를 눌렀는데 모바일에 '끊김'이 뜨면 사장님이 놀란다.
    // 계약에 paused 상태가 없어서 가장 덜 놀라운 값을 쓴다.
    expect(toServerCameraState('idle')).toBe('unknown')
  })
})

describe('buildHeartbeat', () => {
  it('스트리밍 중인 카메라는 lastFrameAt 을 지금으로 보낸다', () => {
    const { payload } = buildHeartbeat(status([camera({ camera: 'streaming' })]), {}, T0)
    expect(payload.cameras).toEqual([
      { agentCameraId: 'onvif-a', state: 'connected', lastFrameAt: T0.toISOString() },
    ])
  })

  it('끊긴 카메라는 마지막으로 봤던 시각을 그대로 보낸다', () => {
    // null 을 보내면 서버가 last_frame_at 을 지워서 2c 의
    // '재연결 중 · 마지막 화면 14:20' 을 그릴 수 없게 된다.
    const first = buildHeartbeat(status([camera({ camera: 'streaming' })]), {}, T0)
    const second = buildHeartbeat(
      status([camera({ camera: 'reconnecting' })]),
      first.lastFrameByCamera,
      T1,
    )
    expect(second.payload.cameras?.[0]).toEqual({
      agentCameraId: 'onvif-a',
      state: 'reconnecting',
      lastFrameAt: T0.toISOString(),
    })
  })

  it('한 번도 본 적 없는 카메라는 null 이다', () => {
    const { payload } = buildHeartbeat(status([camera({ camera: 'connecting' })]), {}, T0)
    expect(payload.cameras?.[0]?.lastFrameAt).toBeNull()
  })

  it('이전 기록을 고치지 않고 새 기록을 돌려준다', () => {
    const before = { 'onvif-a': T0.toISOString() }
    const frozen = Object.freeze({ ...before })
    const { lastFrameByCamera } = buildHeartbeat(status([camera({ camera: 'streaming' })]), frozen, T1)
    expect(frozen).toEqual(before)
    expect(lastFrameByCamera['onvif-a']).toBe(T1.toISOString())
  })

  it('목록에서 빠진 카메라의 기록은 버린다', () => {
    const { lastFrameByCamera } = buildHeartbeat(
      status([camera({ cameraId: 'onvif-b', camera: 'streaming' })]),
      { 'onvif-a': T0.toISOString() },
      T1,
    )
    expect(Object.keys(lastFrameByCamera)).toEqual(['onvif-b'])
  })

  it('스풀 용량은 카메라별 합이고 오늘 업로드는 에이전트 전체 값이다', () => {
    const { payload } = buildHeartbeat(
      status(
        [camera({ cameraId: 'a', spoolBytes: 100 }), camera({ cameraId: 'b', spoolBytes: 250 })],
        { bytesUploadedToday: 9_000 },
      ),
      {},
      T0,
    )
    expect(payload.spoolBytes).toBe(350)
    expect(payload.uploadedBytesToday).toBe(9_000)
  })

  it('에이전트 버전을 싣는다', () => {
    const { payload } = buildHeartbeat(status([]), {}, T0)
    expect(payload.agentVersion).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('카메라가 없어도 하트비트는 보낸다 — PC 온라인 여부는 카메라와 별개다', () => {
    const { payload } = buildHeartbeat(status([], { running: false }), {}, T0)
    expect(payload.cameras).toEqual([])
  })
})
