import { describe, it, expect } from 'vitest'
import { buildPreviewArgs, previewSettings } from '../../src/main/services/preview-stream'

const args = buildPreviewArgs({ rtspUri: 'rtsp://cam/sub', fps: 10, width: 640 }).join(' ')

describe('buildPreviewArgs', () => {
  it('MJPEG 를 표준출력으로 흘려보낸다', () => {
    expect(args).toContain('-f mjpeg')
    expect(args.endsWith(' -')).toBe(true)
  })
  it('RTSP 를 TCP 로 강제한다', () => {
    expect(args).toContain('-rtsp_transport tcp')
  })
  it('지연을 줄이기 위해 버퍼링을 끈다', () => {
    expect(args).toContain('-fflags nobuffer')
    expect(args).toContain('-flags low_delay')
  })
  it('미리보기용으로 프레임레이트와 크기를 낮춘다', () => {
    expect(args).toContain('-r 10')
    expect(args).toContain('-vf scale=640:-2')
  })
  it('오디오는 버린다', () => {
    expect(args).toContain('-an')
  })
})

describe('previewSettings', () => {
  const full = { fps: 10, width: 640 }

  it('크게 볼 때는 기존 설정을 그대로 쓴다 — 2b 카메라 추가 미리보기가 달라지지 않는다', () => {
    expect(previewSettings('full', full)).toEqual(full)
  })

  it('격자 타일은 프레임과 크기를 낮춘다 — 8대를 동시에 띄운다', () => {
    const tile = previewSettings('tile', full)
    expect(tile.fps).toBeLessThan(full.fps)
    expect(tile.width).toBeLessThan(full.width)
  })
})
