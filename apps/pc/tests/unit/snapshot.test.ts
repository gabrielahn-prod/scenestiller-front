import { describe, it, expect } from 'vitest'
import { buildSnapshotArgs } from '../../src/main/services/snapshot'

const args = buildSnapshotArgs({ rtspUri: 'rtsp://cam/live', outPath: '/tmp/shot.jpg' })

describe('buildSnapshotArgs', () => {
  it('딱 한 프레임만 뽑는다', () => {
    expect(args.join(' ')).toContain('-frames:v 1')
  })
  it('RTSP 를 TCP 로 강제한다', () => {
    expect(args.join(' ')).toContain('-rtsp_transport tcp')
  })
  it('응답 없는 카메라에 매달리지 않도록 타임아웃을 건다', () => {
    expect(args.join(' ')).toContain('-timeout ')
  })
  it('덮어쓰기를 허용하고 출력 경로가 마지막이다', () => {
    expect(args).toContain('-y')
    expect(args[args.length - 1]).toBe('/tmp/shot.jpg')
  })
})
