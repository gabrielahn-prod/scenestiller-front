import { describe, it, expect } from 'vitest'
import { parseProbeOutput } from '../../src/main/services/media-probe'

const sample = JSON.stringify({
  streams: [
    {
      codec_type: 'video',
      codec_name: 'h264',
      width: 704,
      height: 480,
      avg_frame_rate: '15/1',
      nb_frames: '75',
    },
  ],
  format: { duration: '5.033000', size: '19783421' },
})

describe('parseProbeOutput', () => {
  it('코덱과 해상도를 읽는다', () => {
    const probed = parseProbeOutput(sample)
    expect(probed).not.toBeNull()
    expect(probed!.codec).toBe('h264')
    expect(probed!.width).toBe(704)
    expect(probed!.height).toBe(480)
  })

  it('duration 을 밀리초로 바꾼다', () => {
    expect(parseProbeOutput(sample)!.durationMs).toBe(5033)
  })

  it('분수 프레임레이트를 반올림한다', () => {
    const output = sample.replace('"15/1"', '"30000/1001"')
    expect(parseProbeOutput(output)!.fps).toBe(30)
  })

  it('프레임레이트가 0/0 이면 0 으로 둔다 (나눗셈 폭발 방지)', () => {
    const output = sample.replace('"15/1"', '"0/0"')
    expect(parseProbeOutput(output)!.fps).toBe(0)
  })

  it('hevc 를 h265 로 정규화한다', () => {
    expect(parseProbeOutput(sample.replace('"h264"', '"hevc"'))!.codec).toBe('h265')
  })

  it('비디오 스트림이 없으면 null', () => {
    expect(parseProbeOutput(JSON.stringify({ streams: [{ codec_type: 'audio' }], format: {} })))
      .toBeNull()
  })

  it('JSON 이 아니면 null (throw 하지 않는다)', () => {
    expect(parseProbeOutput('not json')).toBeNull()
  })
})
