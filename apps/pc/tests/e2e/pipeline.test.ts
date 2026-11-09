import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startFakeCamera, type FakeCamera } from '../../tools/fake-camera'
import { createAgent } from '../../src/main/services/agent'
import { cameraKey } from '../../src/main/lib/camera-key'
import { discoverCameras } from '../../src/main/services/discovery'
import { pickProfile, probeCamera } from '../../src/main/services/camera-probe'
import { createSpoolStore } from '../../src/main/services/spool-store'
import { probeMedia } from '../../src/main/services/media-probe'
import { startTestReceiver, type TestReceiver } from '../helpers/test-receiver'
import { startsWithKeyframe } from '../helpers/ffprobe'
import { waitFor } from '../helpers/fleet-harness'
import type { SelectedCamera } from '../../src/shared/types'

/**
 * 가짜 카메라 → 에이전트 → 백엔드 전체 경로 검증.
 *
 * 이 테스트가 통과하면 실제 CCTV 로 바꿔도 같은 경로가 동작한다.
 * 에이전트는 RTSP 주소 하나만 알 뿐, 상대가 진짜인지 가짜인지 모른다.
 */

const SEGMENT_SECONDS = 2

let camera: FakeCamera
let selected: SelectedCamera

beforeAll(async () => {
  camera = await startFakeCamera({ friendlyName: '테스트매장카메라', gopSeconds: 1 })
  selected = {
    id: camera.uuid,
    name: '계산대',
    manufacturer: 'FakeCam',
    model: 'SIM-1000',
    rtspUri: camera.rtsp.sub!,
    streamProfile: 'sub',
    codec: 'h264',
    width: 640,
    height: 480,
    fps: 15,
  }
}, 60_000)

afterAll(async () => {
  await camera.close()
})

let dir = ''
let receiver: TestReceiver
let agent: ReturnType<typeof createAgent>
let spoolRoot = ''

const spoolOf = (cameraId: string) => join(spoolRoot, cameraKey(cameraId))

const makeAgent = (backendBaseUrl: string) => {
  dir = mkdtempSync(join(tmpdir(), 'cctv-e2e-'))
  spoolRoot = join(dir, 'spool')
  const created = createAgent({ configFile: join(dir, 'config.json'), spoolRoot }, () => {})
  created.config.write({
    backendBaseUrl,
    deviceToken: 'test-token',
    storeId: 'store-e2e',
    segmentSeconds: SEGMENT_SECONDS,
    streamProfile: 'sub',
  })
  return created
}

beforeEach(async () => {
  receiver = await startTestReceiver()
})

afterEach(async () => {
  await agent?.fleet.stop()
  await receiver.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('전체 파이프라인', () => {
  it('카메라 영상을 조각내어 백엔드로 올리고 스풀을 비운다', async () => {
    agent = makeAgent(receiver.url)
    await agent.fleet.start([selected])

    await waitFor(() => receiver.received.length >= 2, { timeoutMs: 40_000, stepMs: 200 })
    await agent.fleet.stop()

    const first = receiver.received[0]!
    expect(first.meta.storeId).toBe('store-e2e')
    expect(first.meta.camera.name).toBe('계산대')
    expect(first.meta.camera.streamProfile).toBe('sub')
    expect(first.meta.video.codec).toBe('h264')
    expect(first.meta.video.width).toBe(640)
    expect(first.meta.video.height).toBe(480)
    expect(first.videoBytes).toBeGreaterThan(1000)
    expect(first.authorization).toBe('Bearer test-token')
    expect(first.idempotencyKey).toBe(first.meta.segmentId)

    // 올린 조각은 스풀에서 사라져 있어야 한다
    expect(await createSpoolStore(spoolOf(selected.id), 1e9).list()).toHaveLength(0)
  }, 60_000)

  it('meta 의 시각과 길이가 실제 조각과 일치한다', async () => {
    agent = makeAgent(receiver.url)
    await agent.fleet.start([selected])
    await waitFor(() => receiver.received.length >= 1, { timeoutMs: 40_000, stepMs: 200 })
    await agent.fleet.stop()

    const { meta } = receiver.received[0]!
    const span = Date.parse(meta.endedAt) - Date.parse(meta.startedAt)
    expect(span).toBe(meta.video.durationMs)
    // 조각 길이는 요청한 값 근처여야 한다 (키프레임 경계라 정확히 맞지는 않는다)
    expect(meta.video.durationMs).toBeGreaterThanOrEqual(SEGMENT_SECONDS * 1000 * 0.5)
    expect(meta.video.durationMs).toBeLessThanOrEqual(SEGMENT_SECONDS * 1000 * 2)
  }, 60_000)

  it('sequence 가 0 부터 순서대로 붙는다', async () => {
    agent = makeAgent(receiver.url)
    await agent.fleet.start([selected])
    await waitFor(() => receiver.received.length >= 3, { timeoutMs: 40_000, stepMs: 200 })
    await agent.fleet.stop()

    const sequences = receiver.received.map((r) => r.meta.sequence)
    expect(sequences.slice(0, 3)).toEqual([0, 1, 2])
  }, 60_000)
})

describe('조각 유효성', () => {
  it('업로드 전 조각이 키프레임으로 시작하고 재생 가능하다', async () => {
    // 업로드를 막아 조각을 스풀에 붙잡아 두고 파일 자체를 검사한다
    receiver.setForcedStatus(503)
    agent = makeAgent(receiver.url)
    await agent.fleet.start([selected])

    const spool = createSpoolStore(spoolOf(selected.id), 1e9)
    await waitFor(async () => (await spool.list()).length >= 1, { timeoutMs: 40_000, stepMs: 200 })
    await agent.fleet.stop()

    const entry = (await spool.list())[0]!
    expect(await startsWithKeyframe(entry.path)).toBe(true)

    const probed = await probeMedia(entry.path)
    expect(probed?.codec).toBe('h264')
    expect(probed?.durationMs).toBeGreaterThan(0)
  }, 60_000)
})

describe('오프라인 복구', () => {
  it('백엔드가 죽은 동안 조각을 보관했다가 살아나면 전부 보낸다', async () => {
    // 닿을 수 없는 주소로 시작 = 인터넷이 끊긴 상태
    agent = makeAgent('http://127.0.0.1:1')
    await agent.fleet.start([selected])

    const spool = createSpoolStore(spoolOf(selected.id), 1e9)
    await waitFor(async () => (await spool.list()).length >= 2, { timeoutMs: 60_000, stepMs: 200 })
    expect(receiver.received).toHaveLength(0)
    const held = (await spool.list()).map((entry) => entry.name)

    // 인터넷 복구
    agent.config.write({ backendBaseUrl: receiver.url })

    await waitFor(() => receiver.received.length >= held.length, { timeoutMs: 60_000, stepMs: 200 })
    await agent.fleet.stop()

    // 보관해 둔 조각이 하나도 빠짐없이, 오래된 순서대로 도착해야 한다.
    // 스풀이 '비었는지'는 단언하지 않는다 — 복구 뒤에도 녹화는 계속되므로
    // 새 조각이 계속 들어와 항상 참일 수 없는 조건이다.
    expect(receiver.received.length).toBeGreaterThanOrEqual(held.length)
    const sequences = receiver.received.map((r) => r.meta.sequence)
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b))
    expect(sequences[0]).toBe(0)
  }, 120_000)
})

describe('사용자 경로: 검색 → 선택 → 수집', () => {
  it('ONVIF 로 카메라를 찾아 프로필을 고르고 그대로 수집한다', async () => {
    const found = await discoverCameras(5000)
    const target = found.find((entry) => entry.xaddr === camera.xaddr)
    expect(
      target,
      'ONVIF 검색으로 가짜 카메라를 찾지 못했습니다. ' +
        '다른 프로세스가 UDP 3702 를 잡고 있으면 멀티캐스트가 이 테스트에 도달하지 않습니다 ' +
        '(lsof -nP -iUDP:3702 로 확인).',
    ).toBeDefined()
    expect(target!.model).toBe('SIM-1000')

    const probed = await probeCamera({ camera: target!, username: 'admin', password: 'pw' })
    const profile = pickProfile(probed.profiles, 'sub')
    expect(profile).not.toBeNull()
    expect(profile!.width).toBe(640)

    agent = makeAgent(receiver.url)
    await agent.fleet.start([
      {
        id: target!.id,
        name: '출입문',
        manufacturer: target!.manufacturer,
        model: target!.model,
        rtspUri: profile!.rtspUri,
        streamProfile: profile!.kind,
        codec: profile!.codec,
        width: profile!.width,
        height: profile!.height,
        fps: profile!.fps,
      },
    ])

    await waitFor(() => receiver.received.length >= 1, { timeoutMs: 40_000, stepMs: 200 })
    await agent.fleet.stop()
    expect(receiver.received[0]!.meta.camera.name).toBe('출입문')
    expect(receiver.received[0]!.meta.camera.model).toBe('SIM-1000')
  }, 90_000)
})
