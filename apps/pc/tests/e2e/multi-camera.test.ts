import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startFakeCamera, type FakeCamera } from '../../tools/fake-camera'
import { cameraKey } from '../../src/main/lib/camera-key'
import { createAgent } from '../../src/main/services/agent'
import { createSpoolStore } from '../../src/main/services/spool-store'
import { startTestReceiver, type TestReceiver } from '../helpers/test-receiver'
import { waitFor } from '../helpers/fleet-harness'
import type { SelectedCamera } from '../../src/shared/types'

/**
 * 카메라 두 대를 동시에 수집해 각각 백엔드로 보내는 전 경로 검증.
 * 가짜 카메라를 두 대 띄워 서로 다른 RTSP 서버를 쓰게 한다.
 */

const SEGMENT_SECONDS = 2

let cameraA: FakeCamera
let cameraB: FakeCamera
let selected: SelectedCamera[]

const toSelected = (cam: FakeCamera, id: string, name: string): SelectedCamera => ({
  id,
  name,
  manufacturer: 'FakeCam',
  model: 'SIM-1000',
  rtspUri: cam.rtsp.sub!,
  streamProfile: 'sub',
  codec: 'h264',
  width: 640,
  height: 480,
  fps: 15,
})

beforeAll(async () => {
  // 검색 응답기는 한 대만 켠다. 두 대가 UDP 3702 를 두고 다투면 검색이 흔들린다.
  cameraA = await startFakeCamera({ friendlyName: '계산대카메라', gopSeconds: 1 })
  cameraB = await startFakeCamera({ friendlyName: '출입문카메라', gopSeconds: 1, advertise: false })
  selected = [
    toSelected(cameraA, 'urn:uuid:e2e-cam-a', '계산대'),
    toSelected(cameraB, 'urn:uuid:e2e-cam-b', '출입문'),
  ]
}, 90_000)

afterAll(async () => {
  await cameraA.close()
  await cameraB.close()
})

let dir = ''
let spoolRoot = ''
let receiver: TestReceiver
let agent: ReturnType<typeof createAgent>

const makeAgent = (backendBaseUrl: string) => {
  dir = mkdtempSync(join(tmpdir(), 'cctv-multi-'))
  spoolRoot = join(dir, 'spool')
  const created = createAgent({ configFile: join(dir, 'config.json'), spoolRoot }, () => {})
  created.config.write({
    backendBaseUrl,
    deviceToken: 'test-token',
    storeId: 'store-multi',
    segmentSeconds: SEGMENT_SECONDS,
    streamProfile: 'sub',
    alignToClock: false,
  })
  return created
}

const receivedFor = (name: string) =>
  receiver.received.filter((r) => r.meta.camera.name === name)

beforeEach(async () => {
  receiver = await startTestReceiver()
})

afterEach(async () => {
  await agent?.fleet.stop()
  await receiver.stop()
  rmSync(dir, { recursive: true, force: true })
})

describe('카메라 두 대 동시 수집', () => {
  it('두 카메라의 조각이 각각 자기 이름을 달고 올라간다', async () => {
    agent = makeAgent(receiver.url)
    await agent.fleet.start(selected)

    await waitFor(
      () => receivedFor('계산대').length >= 1 && receivedFor('출입문').length >= 1,
      { timeoutMs: 60_000, stepMs: 300 },
    )
    await agent.fleet.stop()

    const calc = receivedFor('계산대')[0]!
    const door = receivedFor('출입문')[0]!
    expect(calc.meta.camera.id).toBe('urn:uuid:e2e-cam-a')
    expect(door.meta.camera.id).toBe('urn:uuid:e2e-cam-b')
    expect(calc.meta.segmentId).not.toBe(door.meta.segmentId)
    expect(calc.videoBytes).toBeGreaterThan(1000)
    expect(door.videoBytes).toBeGreaterThan(1000)
  }, 90_000)

  it('sequence 가 카메라마다 따로 0 부터 매겨진다', async () => {
    agent = makeAgent(receiver.url)
    await agent.fleet.start(selected)

    await waitFor(
      () => receivedFor('계산대').length >= 2 && receivedFor('출입문').length >= 2,
      { timeoutMs: 60_000, stepMs: 300 },
    )
    await agent.fleet.stop()

    expect(receivedFor('계산대').map((r) => r.meta.sequence).slice(0, 2)).toEqual([0, 1])
    expect(receivedFor('출입문').map((r) => r.meta.sequence).slice(0, 2)).toEqual([0, 1])
  }, 90_000)

  it('카메라마다 자기 보관 폴더를 쓴다', async () => {
    agent = makeAgent(receiver.url)
    await agent.fleet.start(selected)
    await waitFor(() => receiver.received.length >= 2, { timeoutMs: 60_000, stepMs: 300 })
    await agent.fleet.stop()

    expect(cameraKey('urn:uuid:e2e-cam-a')).not.toBe(cameraKey('urn:uuid:e2e-cam-b'))
    // 다 올라갔으면 두 폴더 모두 비어 있어야 한다
    for (const cam of selected) {
      const left = await createSpoolStore(join(spoolRoot, cameraKey(cam.id)), 1e9).list()
      expect(left.length).toBeLessThanOrEqual(1)
    }
  }, 90_000)

  it('한 카메라가 죽어도 다른 카메라는 계속 올린다', async () => {
    agent = makeAgent(receiver.url)
    await agent.fleet.start(selected)
    await waitFor(() => receivedFor('출입문').length >= 1, { timeoutMs: 60_000, stepMs: 300 })

    // 출입문 카메라를 내린다 — 계산대는 영향을 받으면 안 된다
    await cameraB.close()
    const before = receivedFor('계산대').length
    await waitFor(() => receivedFor('계산대').length > before, { timeoutMs: 60_000, stepMs: 300 })

    // 상태는 멈추기 전에 읽는다
    const status = agent.fleet.status()
    await agent.fleet.stop()

    expect(status.cameras.find((c) => c.name === '계산대')?.camera).toBe('streaming')
    expect(receivedFor('계산대').length).toBeGreaterThan(before)
  }, 120_000)
})
