import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { classifyStatus, uploadSegment } from '../../src/main/services/uploader'
import { startTestReceiver, type TestReceiver } from '../helpers/test-receiver'
import { makeMeta } from '../helpers/fixtures'

let dir = ''
let filePath = ''
let receiver: TestReceiver

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'cctv-upload-'))
  filePath = join(dir, 'seg_20260907_143000.mp4')
  writeFileSync(filePath, Buffer.alloc(2048, 7))
  receiver = await startTestReceiver()
})
afterEach(async () => {
  await receiver.stop()
  rmSync(dir, { recursive: true, force: true })
})

const upload = (meta = makeMeta()) =>
  uploadSegment({ baseUrl: receiver.url, token: 'tok-abc', meta, filePath })

describe('classifyStatus', () => {
  it('2xx는 ok', () => {
    expect(classifyStatus(200).kind).toBe('ok')
    expect(classifyStatus(201).kind).toBe('ok')
  })
  it('409는 duplicate (성공 취급)', () => {
    expect(classifyStatus(409).kind).toBe('duplicate')
  })
  it('401/403은 fatal(auth) — 재시도해도 소용없다', () => {
    expect(classifyStatus(401)).toMatchObject({ kind: 'fatal', cause: 'auth' })
    expect(classifyStatus(403)).toMatchObject({ kind: 'fatal', cause: 'auth' })
  })
  it('413은 fatal(too-large)', () => {
    expect(classifyStatus(413)).toMatchObject({ kind: 'fatal', cause: 'too-large' })
  })
  it('5xx는 retry', () => {
    expect(classifyStatus(500).kind).toBe('retry')
    expect(classifyStatus(503).kind).toBe('retry')
  })
  it('408/429는 일시적이므로 retry', () => {
    expect(classifyStatus(408).kind).toBe('retry')
    expect(classifyStatus(429).kind).toBe('retry')
  })
  it('그 밖의 4xx는 fatal(rejected)', () => {
    expect(classifyStatus(400)).toMatchObject({ kind: 'fatal', cause: 'rejected' })
  })
})

describe('uploadSegment', () => {
  it('규격대로 POST {baseUrl}/v1/segments 로 보낸다', async () => {
    await upload()
    expect(receiver.received[0]!.path).toBe('/v1/segments')
  })

  it('baseUrl 끝의 슬래시가 있어도 경로가 깨지지 않는다', async () => {
    await uploadSegment({
      baseUrl: `${receiver.url}/`,
      token: 't',
      meta: makeMeta(),
      filePath,
    })
    expect(receiver.received[0]!.path).toBe('/v1/segments')
  })

  it('meta 파트를 JSON 으로 보낸다', async () => {
    await upload()
    expect(receiver.received[0]!.meta.camera.name).toBe('계산대')
    expect(receiver.received[0]!.meta.sequence).toBe(1284)
  })

  it('video 파트에 실제 파일 내용을 보낸다', async () => {
    await upload()
    expect(receiver.received[0]!.videoBytes).toBe(2048)
    expect(receiver.received[0]!.videoType).toBe('video/mp4')
  })

  it('Idempotency-Key 헤더에 segmentId 를 넣는다', async () => {
    await upload()
    expect(receiver.received[0]!.idempotencyKey).toBe('01K5ZQ8G3M7X2N4P6R8T0V2W4Y')
  })

  it('Authorization: Bearer 토큰을 보낸다', async () => {
    await upload()
    expect(receiver.received[0]!.authorization).toBe('Bearer tok-abc')
  })

  it('정상 수신이면 ok', async () => {
    expect((await upload()).kind).toBe('ok')
  })

  it('같은 segmentId 를 다시 보내면 duplicate 이고, 수신 서버는 한 번만 반영한다', async () => {
    expect((await upload()).kind).toBe('ok')
    expect((await upload()).kind).toBe('duplicate')
    expect(receiver.received).toHaveLength(1)
  })

  it('서버가 500이면 retry', async () => {
    receiver.setForcedStatus(500)
    expect((await upload()).kind).toBe('retry')
  })

  it('서버가 401이면 fatal', async () => {
    receiver.setForcedStatus(401)
    expect((await upload())).toMatchObject({ kind: 'fatal', cause: 'auth' })
  })

  it('서버에 닿지 못하면 retry (오프라인)', async () => {
    const result = await uploadSegment({
      baseUrl: 'http://127.0.0.1:1',
      token: 't',
      meta: makeMeta(),
      filePath,
    })
    expect(result.kind).toBe('retry')
    // 연결이 거절돼도 fetch 는 본문(파일) 첫 조각을 이미 읽으러 가 있다. 그 읽기가 끝나기 전에 afterEach 가
    // 임시 폴더를 지우면 윈도에서 NotReadableError 가 처리 안 된 거부로 남는다 — 읽기가 끝나기를 기다린다.
    await new Promise((resolve) => setTimeout(resolve, 100))
  })

  it('파일이 사라졌으면 fatal(missing-file) — 재시도해도 소용없다', async () => {
    const result = await uploadSegment({
      baseUrl: receiver.url,
      token: 't',
      meta: makeMeta(),
      filePath: join(dir, 'gone.mp4'),
    })
    expect(result).toMatchObject({ kind: 'fatal', cause: 'missing-file' })
  })
})
