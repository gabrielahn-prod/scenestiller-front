import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConfigStore } from '../../src/main/services/config-store'

let dir = ''
let file = ''

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cctv-cfg-'))
  file = join(dir, 'config.json')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('ConfigStore', () => {
  it('처음 읽으면 기본값이 나온다', () => {
    const config = createConfigStore(file).read()
    expect(config.segmentSeconds).toBe(60)
    expect(config.streamProfile).toBe('sub')
    expect(config.spoolLimitBytes).toBe(5 * 1024 ** 3)
    expect(config.cameras).toEqual([])
    expect(config.alignToClock).toBe(true)
  })

  it('예전 1대 설정(selectedCamera)을 여러 대 형식으로 옮긴다', () => {
    const legacy = {
      storeId: 'store-1',
      selectedCamera: { id: 'urn:uuid:old', name: '계산대', rtspUri: 'rtsp://cam/sub' },
    }
    writeFileSync(file, JSON.stringify(legacy))
    const config = createConfigStore(file).read()
    expect(config.cameras).toHaveLength(1)
    expect(config.cameras[0]!.name).toBe('계산대')
    expect('selectedCamera' in config).toBe(false)
  })

  it('예전 설정에 카메라가 없으면 빈 목록이 된다', () => {
    writeFileSync(file, JSON.stringify({ storeId: 'store-1', selectedCamera: null }))
    expect(createConfigStore(file).read().cameras).toEqual([])
  })

  it('카메라 목록을 통째로 갈아끼운다', () => {
    const store = createConfigStore(file)
    const cams = [
      { id: 'a', name: '계산대' },
      { id: 'b', name: '출입문' },
    ] as never
    store.write({ cameras: cams })
    expect(createConfigStore(file).read().cameras.map((c) => c.name)).toEqual(['계산대', '출입문'])
  })

  it('deviceId를 자동 생성한다', () => {
    expect(createConfigStore(file).read().deviceId).toMatch(/^agent-[a-z0-9]{8,}$/)
  })

  it('기본값이 바뀌어도 이미 설치된 PC 의 조각 길이는 그대로다', () => {
    // 기본값을 5분 → 1분으로 바꿨다. 업데이트만으로 매장 PC 의 조각 길이가
    // 바뀌면 업로드량이 달라진다 — 바꾸는 건 서버 설정(하트비트)의 몫이다.
    writeFileSync(file, JSON.stringify({ storeId: 'store-1', segmentSeconds: 300, deviceId: 'agent-old' }))
    expect(createConfigStore(file).read().segmentSeconds).toBe(300)
  })

  it('Supabase 설정이 없는 옛 설정 파일도 읽힌다', () => {
    writeFileSync(file, JSON.stringify({ storeId: 'store-1', backendBaseUrl: 'https://api', deviceId: 'agent-old' }))
    const config = createConfigStore(file).read()
    expect(config.supabaseUrl).toBe('')
    expect(config.backendBaseUrl).toBe('https://api')
  })

  it('빌드 기본값은 비어 있는 값만 채운다 — 사용자가 고급 설정에서 바꾼 값은 덮어쓰지 않는다', () => {
    writeFileSync(file, JSON.stringify({ backendBaseUrl: 'https://custom', deviceId: 'agent-old' }))
    const config = createConfigStore(file, {
      backendBaseUrl: 'https://baked',
      supabaseUrl: 'https://baked.supabase.co',
    }).read()
    expect(config.backendBaseUrl).toBe('https://custom')
    expect(config.supabaseUrl).toBe('https://baked.supabase.co')
  })

  it('deviceId는 재시작해도 유지된다', () => {
    const first = createConfigStore(file).read().deviceId
    expect(createConfigStore(file).read().deviceId).toBe(first)
  })

  it('부분 수정이 병합되고 영속된다', () => {
    createConfigStore(file).write({ storeId: 'store-gangnam-01' })
    const reloaded = createConfigStore(file).read()
    expect(reloaded.storeId).toBe('store-gangnam-01')
    expect(reloaded.segmentSeconds).toBe(60)
  })

  it('write는 갱신된 전체 설정을 반환한다', () => {
    const updated = createConfigStore(file).write({ segmentSeconds: 30 })
    expect(updated.segmentSeconds).toBe(30)
    expect(updated.deviceId).toMatch(/^agent-/)
  })

  it('sequence는 카메라마다 독립적으로 0부터 증가한다', () => {
    const store = createConfigStore(file)
    expect(store.nextSequence('cam-a')).toBe(0)
    expect(store.nextSequence('cam-a')).toBe(1)
    expect(store.nextSequence('cam-b')).toBe(0)
    expect(store.nextSequence('cam-a')).toBe(2)
  })

  it('sequence는 재시작 후에도 이어진다', () => {
    createConfigStore(file).nextSequence('cam-a')
    createConfigStore(file).nextSequence('cam-a')
    expect(createConfigStore(file).nextSequence('cam-a')).toBe(2)
  })

  it('깨진 JSON이면 기본값으로 복구한다 (전원 차단 대비)', () => {
    writeFileSync(file, '{ "storeId": "half-writ')
    const config = createConfigStore(file).read()
    expect(config.segmentSeconds).toBe(60)
    expect(config.deviceId).toMatch(/^agent-/)
  })

  it('알 수 없는 필드는 무시하고 기본값을 채운다', () => {
    writeFileSync(file, JSON.stringify({ storeId: 'x', bogusField: 1 }))
    const config = createConfigStore(file).read()
    expect(config.storeId).toBe('x')
    expect(config.streamProfile).toBe('sub')
    expect('bogusField' in config).toBe(false)
  })

  it('저장 파일은 사람이 읽을 수 있는 JSON이다', () => {
    createConfigStore(file).write({ storeId: 'store-1' })
    expect(JSON.parse(readFileSync(file, 'utf8')).storeId).toBe('store-1')
  })
})
