import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { makeCamera, makeHarness, waitFor, type Harness } from '../helpers/fleet-harness'

const CALC = makeCamera('urn:uuid:cam-a', '계산대')
const DOOR = makeCamera('urn:uuid:cam-b', '출입문')
const STOCK = makeCamera('urn:uuid:cam-c', '창고')

let harness: Harness

beforeEach(() => {
  harness = makeHarness()
})
afterEach(async () => {
  await harness.fleet.stop()
  harness.cleanup()
})

describe('Fleet — 여러 대 동시 수집', () => {
  it('카메라마다 녹화기를 하나씩 띄운다', async () => {
    await harness.fleet.start([CALC, DOOR, STOCK])
    expect(harness.recorderStarts(CALC.id)).toBe(1)
    expect(harness.recorderStarts(DOOR.id)).toBe(1)
    expect(harness.recorderStarts(STOCK.id)).toBe(1)
  })

  it('카메라마다 자기 보관 폴더를 쓴다 (섞이면 조각이 뒤바뀐다)', async () => {
    await harness.fleet.start([CALC, DOOR])
    expect(harness.spoolDirOf(CALC.id)).not.toBe(harness.spoolDirOf(DOOR.id))
    expect(existsSync(harness.spoolDirOf(CALC.id))).toBe(true)
    expect(existsSync(harness.spoolDirOf(DOOR.id))).toBe(true)
  })

  it('상태에 카메라가 전부 이름과 함께 들어온다', async () => {
    await harness.fleet.start([CALC, DOOR, STOCK])
    expect(harness.fleet.status().cameras.map((c) => c.name)).toEqual(['계산대', '출입문', '창고'])
  })

  it('보관 상한을 카메라 수로 나눈다', async () => {
    await harness.fleet.stop()
    harness.cleanup()
    harness = makeHarness({ spoolLimitBytes: 1200 })
    await harness.fleet.start([CALC, DOOR, STOCK])
    expect(harness.fleet.status().spoolLimitBytesPerCamera).toBe(400)
  })
})

describe('Fleet — 업로드', () => {
  it('각 카메라 조각이 자기 camera.id 를 달고 올라간다', async () => {
    await harness.fleet.start([CALC, DOOR])
    harness.emitSegment(CALC.id, 'seg_20260908_143000_000.mp4')
    harness.emitSegment(DOOR.id, 'seg_20260908_143000_000.mp4')
    await waitFor(() => harness.uploads.length >= 2)
    expect(new Set(harness.uploads.map((m) => m.camera.name))).toEqual(new Set(['계산대', '출입문']))
  })

  it('sequence 는 카메라마다 따로 0 부터 매겨진다', async () => {
    await harness.fleet.start([CALC, DOOR])
    harness.emitSegment(CALC.id, 'seg_20260908_143000_000.mp4')
    harness.emitSegment(CALC.id, 'seg_20260908_143500_000.mp4')
    harness.emitSegment(DOOR.id, 'seg_20260908_143000_000.mp4')
    await waitFor(() => harness.uploads.length >= 3)
    const seqOf = (name: string) =>
      harness.uploads.filter((m) => m.camera.name === name).map((m) => m.sequence)
    expect(seqOf('계산대')).toEqual([0, 1])
    expect(seqOf('출입문')).toEqual([0])
  })

  it('한 카메라가 많이 밀려도 다른 카메라가 굶지 않는다 (라운드로빈)', async () => {
    await harness.fleet.start([CALC, DOOR])
    // 계산대에 5개, 출입문에 1개를 쌓는다. 순서대로면 출입문은 6번째에나 올라간다.
    for (const time of ['143000', '143500', '144000', '144500', '145000']) {
      harness.emitSegment(CALC.id, `seg_20260908_${time}_000.mp4`)
    }
    harness.emitSegment(DOOR.id, 'seg_20260908_143000_000.mp4')

    await waitFor(() => harness.uploads.length >= 4)
    const firstFour = harness.uploads.slice(0, 4).map((m) => m.camera.name)
    expect(firstFour).toContain('출입문')
  })

  it('업로드에 성공하면 그 카메라 폴더에서만 지운다', async () => {
    await harness.fleet.start([CALC, DOOR])
    harness.emitSegment(CALC.id, 'seg_20260908_143000_000.mp4')
    await waitFor(() => !existsSync(join(harness.spoolDirOf(CALC.id), 'seg_20260908_143000_000.mp4')))
    const calc = harness.fleet.status().cameras.find((c) => c.name === '계산대')
    expect(calc?.uploadedCount).toBe(1)
  })

  it('재시도할 때 segmentId 와 sequence 를 그대로 재사용한다 (멱등성)', async () => {
    harness.setUploadResults([
      { kind: 'retry', reason: 'ECONNREFUSED' },
      { kind: 'retry', reason: 'ECONNREFUSED' },
    ])
    await harness.fleet.start([CALC])
    harness.emitSegment(CALC.id, 'seg_20260908_143000_000.mp4')
    await waitFor(() => harness.uploads.length >= 3)
    expect(new Set(harness.uploads.slice(0, 3).map((m) => m.segmentId)).size).toBe(1)
    expect(new Set(harness.uploads.slice(0, 3).map((m) => m.sequence)).size).toBe(1)
  })

  it('401 이면 업로드 전체를 멈춘다 (카메라 하나가 아니라 토큰 문제이므로)', async () => {
    harness.setUploadResults([{ kind: 'fatal', reason: '인증 실패', cause: 'auth' }])
    await harness.fleet.start([CALC, DOOR])
    harness.emitSegment(CALC.id, 'seg_20260908_143000_000.mp4')
    await waitFor(() => harness.fleet.status().upload === 'auth-failed')
    const attempts = harness.uploads.length
    await new Promise((resolve) => setTimeout(resolve, 60))
    expect(harness.uploads.length).toBe(attempts)
  })
})

describe('Fleet — 카메라별 독립 복구', () => {
  it('한 카메라가 죽어도 다른 카메라는 계속 돈다', async () => {
    await harness.fleet.start([CALC, DOOR])
    harness.emitFlowing(DOOR.id)
    harness.emitExit(CALC.id, 'Connection timed out')

    const statusOf = (name: string) =>
      harness.fleet.status().cameras.find((c) => c.name === name)
    expect(statusOf('계산대')?.camera).toBe('reconnecting')
    expect(statusOf('출입문')?.camera).toBe('streaming')
  })

  it('죽은 카메라만 재시작한다', async () => {
    await harness.fleet.start([CALC, DOOR])
    harness.emitExit(CALC.id, 'Connection timed out')
    await waitFor(() => harness.recorderStarts(CALC.id) === 2)
    expect(harness.recorderStarts(DOOR.id)).toBe(1)
  })

  it('한 카메라의 인증 실패가 다른 카메라를 멈추지 않는다', async () => {
    await harness.fleet.start([CALC, DOOR])
    harness.emitExit(CALC.id, 'method DESCRIBE failed: 401 Unauthorized')
    harness.emitFlowing(DOOR.id)
    const statusOf = (name: string) =>
      harness.fleet.status().cameras.find((c) => c.name === name)
    expect(statusOf('계산대')?.camera).toBe('auth-failed')
    expect(statusOf('출입문')?.camera).toBe('streaming')
  })

  it('영상이 들어오면 조각 완성 전에도 streaming 이 된다', async () => {
    await harness.fleet.start([CALC])
    expect(harness.fleet.status().cameras[0]!.camera).toBe('connecting')
    harness.emitFlowing(CALC.id)
    await waitFor(() => harness.fleet.status().cameras[0]!.camera === 'streaming')
  })
})

describe('Fleet — 생명주기', () => {
  it('stop 하면 모든 카메라가 멈추되 목록에는 남는다', async () => {
    await harness.fleet.start([CALC, DOOR])
    await harness.fleet.stop()
    const status = harness.fleet.status()
    expect(status.running).toBe(false)
    // 중지했다고 화면에서 카드가 사라지면 사용자는 설정이 날아간 줄 안다
    expect(status.cameras.map((c) => c.name)).toEqual(['계산대', '출입문'])
    expect(status.cameras.every((c) => c.camera === 'idle')).toBe(true)
  })

  it('start 를 다시 부르면 카메라 목록이 갈아끼워진다', async () => {
    await harness.fleet.start([CALC, DOOR])
    await harness.fleet.start([STOCK])
    expect(harness.fleet.status().cameras.map((c) => c.name)).toEqual(['창고'])
  })
})
