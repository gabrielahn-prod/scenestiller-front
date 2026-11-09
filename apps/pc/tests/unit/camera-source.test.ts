import { describe, it, expect } from 'vitest'
import {
  defaultWebcamDevice,
  fileInputArgs,
  inputArgs,
  webcamInputArgs,
  WEBCAM_CAPTURE_FPS,
} from '../../tools/fake-camera/source'

const capture = { width: 640, height: 480, fps: 15 }

describe('webcamInputArgs', () => {
  it('macOS 는 avfoundation 과 장치 번호를 쓴다', () => {
    expect(webcamInputArgs('0', capture, 'darwin').join(' '))
      .toBe(`-f avfoundation -framerate ${WEBCAM_CAPTURE_FPS} -video_size 640x480 -i 0`)
  })

  it('Windows 는 dshow 와 video=이름 형식을 쓴다', () => {
    expect(webcamInputArgs('Integrated Camera', capture, 'win32').join(' '))
      .toContain('-f dshow')
    expect(webcamInputArgs('Integrated Camera', capture, 'win32')).toContain('video=Integrated Camera')
  })

  it('Linux 는 v4l2 와 장치 경로를 쓴다', () => {
    expect(webcamInputArgs('/dev/video0', capture, 'linux').join(' ')).toContain('-f v4l2')
  })

  it('해상도를 반드시 함께 준다 (없으면 avfoundation 이 모드를 못 고른다)', () => {
    expect(webcamInputArgs('0', capture, 'darwin').join(' ')).toContain('-video_size 640x480')
  })

  it('캡처는 30fps 로 고정한다 (장치가 보고한 15fps 를 ffmpeg 가 거부하는 문제)', () => {
    expect(webcamInputArgs('0', { ...capture, fps: 15 }, 'darwin').join(' '))
      .toContain('-framerate 30')
  })
})

describe('fileInputArgs', () => {
  it('실시간 속도로 무한 반복한다 (카메라처럼 끊기지 않게)', () => {
    expect(fileInputArgs('/tmp/a.mp4').join(' ')).toBe('-re -stream_loop -1 -i /tmp/a.mp4')
  })
})

describe('inputArgs', () => {
  it('웹캠 소스는 웹캠 인자를 낸다', () => {
    expect(inputArgs({ kind: 'webcam', device: '0' }, capture, 'darwin')).toContain('avfoundation')
  })

  it('파일 소스는 반복 재생 인자를 낸다', () => {
    expect(inputArgs({ kind: 'file', path: '/tmp/a.mp4' }, capture, 'darwin')).toContain('-stream_loop')
  })
})

describe('defaultWebcamDevice', () => {
  it('플랫폼마다 기본 장치가 다르다', () => {
    expect(defaultWebcamDevice('darwin')).toBe('0')
    expect(defaultWebcamDevice('win32')).toBe('Integrated Camera')
    expect(defaultWebcamDevice('linux')).toBe('/dev/video0')
  })
})
