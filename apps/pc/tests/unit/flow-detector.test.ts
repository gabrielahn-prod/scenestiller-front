import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFlowDetector } from '../../src/main/services/segment-recorder'

let dir = ''
const POLL = 20
const settle = () => new Promise((r) => setTimeout(r, POLL * 5))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cctv-flow-'))
  mkdirSync(join(dir, 'parts'), { recursive: true })
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const partsDir = () => join(dir, 'parts')
const writePart = (name: string, bytes: number) =>
  writeFileSync(join(partsDir(), name), Buffer.alloc(bytes, 1))

describe('createFlowDetector', () => {
  it('조각 파일에 바이트가 생기면 흐름을 알린다', async () => {
    let flowing = 0
    const detector = createFlowDetector({ partsDir: partsDir(), onFlowing: () => { flowing += 1 }, pollMs: POLL })
    detector.start()
    await settle()
    expect(flowing).toBe(0)
    writePart('part_00000.mp4', 4096)
    await settle()
    detector.stop()
    expect(flowing).toBe(1)
  })

  it('크기가 0인 파일은 아직 흐름이 아니다 (ffmpeg 가 파일만 열어둔 상태)', async () => {
    let flowing = 0
    const detector = createFlowDetector({ partsDir: partsDir(), onFlowing: () => { flowing += 1 }, pollMs: POLL })
    writePart('part_00000.mp4', 0)
    detector.start()
    await settle()
    detector.stop()
    expect(flowing).toBe(0)
  })

  it('한 번만 알린다 (상태 전이는 한 번이면 충분)', async () => {
    let flowing = 0
    const detector = createFlowDetector({ partsDir: partsDir(), onFlowing: () => { flowing += 1 }, pollMs: POLL })
    detector.start()
    writePart('part_00000.mp4', 4096)
    await settle()
    writePart('part_00001.mp4', 8192)
    await settle()
    detector.stop()
    expect(flowing).toBe(1)
  })

  it('manifest.txt 는 조각이 아니므로 무시한다', async () => {
    let flowing = 0
    const detector = createFlowDetector({ partsDir: partsDir(), onFlowing: () => { flowing += 1 }, pollMs: POLL })
    detector.start()
    writeFileSync(join(partsDir(), 'manifest.txt'), 'something\n')
    await settle()
    detector.stop()
    expect(flowing).toBe(0)
  })

  it('stop 이후에는 알리지 않는다', async () => {
    let flowing = 0
    const detector = createFlowDetector({ partsDir: partsDir(), onFlowing: () => { flowing += 1 }, pollMs: POLL })
    detector.start()
    detector.stop()
    writePart('part_00000.mp4', 4096)
    await settle()
    expect(flowing).toBe(0)
  })
})
