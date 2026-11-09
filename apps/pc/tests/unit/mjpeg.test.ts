import { describe, it, expect } from 'vitest'
import { createJpegSplitter } from '../../src/main/lib/mjpeg'

const SOI = Buffer.from([0xff, 0xd8])
const EOI = Buffer.from([0xff, 0xd9])
const jpeg = (payload: string) => Buffer.concat([SOI, Buffer.from(payload), EOI])

describe('createJpegSplitter', () => {
  it('완성된 JPEG 하나를 뽑는다', () => {
    const frames: Buffer[] = []
    const push = createJpegSplitter((f) => frames.push(f))
    push(jpeg('AAA'))
    expect(frames).toHaveLength(1)
    expect(frames[0]!.subarray(0, 2)).toEqual(SOI)
    expect(frames[0]!.subarray(-2)).toEqual(EOI)
  })

  it('한 덩어리에 여러 프레임이 와도 각각 뽑는다', () => {
    const frames: Buffer[] = []
    const push = createJpegSplitter((f) => frames.push(f))
    push(Buffer.concat([jpeg('AAA'), jpeg('BBBB'), jpeg('C')]))
    expect(frames).toHaveLength(3)
    expect(frames.map((f) => f.length)).toEqual([7, 8, 5])
  })

  it('프레임이 여러 덩어리에 쪼개져 와도 이어붙인다', () => {
    const frames: Buffer[] = []
    const push = createJpegSplitter((f) => frames.push(f))
    const whole = jpeg('HELLO')
    push(whole.subarray(0, 3))
    expect(frames).toHaveLength(0)
    push(whole.subarray(3))
    expect(frames).toHaveLength(1)
  })

  it('EOI 가 덩어리 경계에 걸쳐도 놓치지 않는다', () => {
    const frames: Buffer[] = []
    const push = createJpegSplitter((f) => frames.push(f))
    const whole = jpeg('X')
    push(whole.subarray(0, whole.length - 1))
    expect(frames).toHaveLength(0)
    push(whole.subarray(whole.length - 1))
    expect(frames).toHaveLength(1)
  })

  it('SOI 앞의 쓰레기 바이트는 버린다', () => {
    const frames: Buffer[] = []
    const push = createJpegSplitter((f) => frames.push(f))
    push(Buffer.concat([Buffer.from('garbage'), jpeg('OK')]))
    expect(frames).toHaveLength(1)
    expect(frames[0]!.subarray(0, 2)).toEqual(SOI)
  })

  it('버퍼가 무한히 자라지 않는다 (EOI 가 안 오는 깨진 스트림 방어)', () => {
    const frames: Buffer[] = []
    const push = createJpegSplitter((f) => frames.push(f), { maxBufferBytes: 1024 })
    push(Buffer.concat([SOI, Buffer.alloc(4096, 0x41)]))
    push(jpeg('RECOVERED'))
    expect(frames).toHaveLength(1)
  })
})
