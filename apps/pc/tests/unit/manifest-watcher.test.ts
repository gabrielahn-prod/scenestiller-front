import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createManifestWatcher } from '../../src/main/services/segment-recorder'

let dir = ''
let manifest = ''
const POLL = 20

const settle = () => new Promise((resolve) => setTimeout(resolve, POLL * 5))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cctv-manifest-'))
  manifest = join(dir, 'manifest.txt')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

const watch = (onSegment: (e: { path: string; name: string }) => void) =>
  createManifestWatcher({ manifestPath: manifest, spoolDir: dir, onSegment, pollMs: POLL })

describe('createManifestWatcher', () => {
  it('새 줄이 추가되면 segment 이벤트를 낸다', async () => {
    const seen: string[] = []
    const watcher = watch((e) => seen.push(e.name))
    watcher.start()
    await settle()
    appendFileSync(manifest, 'seg_20260907_143000.mp4\n')
    await settle()
    watcher.stop()
    expect(seen).toEqual(['seg_20260907_143000.mp4'])
  })

  it('이벤트에 스풀 디렉토리를 붙인 전체 경로를 준다', async () => {
    const seen: string[] = []
    const watcher = watch((e) => seen.push(e.path))
    watcher.start()
    appendFileSync(manifest, 'seg_20260907_143000.mp4\n')
    await settle()
    watcher.stop()
    expect(seen).toEqual([join(dir, 'seg_20260907_143000.mp4')])
  })

  it('시작 전에 이미 있던 줄은 다시 내보내지 않는다', async () => {
    writeFileSync(manifest, 'seg_20260907_140000.mp4\nseg_20260907_140500.mp4\n')
    const seen: string[] = []
    const watcher = watch((e) => seen.push(e.name))
    watcher.start()
    await settle()
    appendFileSync(manifest, 'seg_20260907_141000.mp4\n')
    await settle()
    watcher.stop()
    expect(seen).toEqual(['seg_20260907_141000.mp4'])
  })

  it('한 번에 여러 줄이 추가되어도 각각 낸다', async () => {
    const seen: string[] = []
    const watcher = watch((e) => seen.push(e.name))
    watcher.start()
    await settle()
    appendFileSync(manifest, 'seg_20260907_143000.mp4\nseg_20260907_143500.mp4\n')
    await settle()
    watcher.stop()
    expect(seen).toEqual(['seg_20260907_143000.mp4', 'seg_20260907_143500.mp4'])
  })

  it('개행이 아직 안 온 부분 줄은 완성될 때까지 보류한다', async () => {
    const seen: string[] = []
    const watcher = watch((e) => seen.push(e.name))
    watcher.start()
    await settle()
    appendFileSync(manifest, 'seg_20260907_1430')
    await settle()
    expect(seen).toEqual([])
    appendFileSync(manifest, '00.mp4\n')
    await settle()
    watcher.stop()
    expect(seen).toEqual(['seg_20260907_143000.mp4'])
  })

  it('manifest가 새로 만들어지면(재시작) 오프셋을 되돌린다', async () => {
    writeFileSync(manifest, 'seg_20260907_140000.mp4\nseg_20260907_140500.mp4\n')
    const seen: string[] = []
    const watcher = watch((e) => seen.push(e.name))
    watcher.start()
    await settle()
    writeFileSync(manifest, 'seg_20260907_150000.mp4\n')
    await settle()
    watcher.stop()
    expect(seen).toEqual(['seg_20260907_150000.mp4'])
  })

  it('stop 이후에는 이벤트가 오지 않는다', async () => {
    const seen: string[] = []
    const watcher = watch((e) => seen.push(e.name))
    watcher.start()
    await settle()
    watcher.stop()
    appendFileSync(manifest, 'seg_20260907_143000.mp4\n')
    await settle()
    expect(seen).toEqual([])
  })
})
