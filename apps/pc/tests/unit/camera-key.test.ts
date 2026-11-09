import { describe, it, expect } from 'vitest'
import { cameraKey } from '../../src/main/lib/camera-key'

describe('cameraKey', () => {
  it('같은 카메라 id 는 항상 같은 키를 준다 (재시작 후에도 같은 폴더)', () => {
    expect(cameraKey('urn:uuid:abc-123')).toBe(cameraKey('urn:uuid:abc-123'))
  })

  it('다른 카메라는 다른 키를 준다', () => {
    expect(cameraKey('urn:uuid:a')).not.toBe(cameraKey('urn:uuid:b'))
  })

  it('파일 시스템에 안전한 문자만 쓴다', () => {
    // urn:uuid 의 콜론, RTSP 주소의 슬래시가 그대로 폴더명이 되면 안 된다
    expect(cameraKey('rtsp://admin:pw@192.168.0.64/live')).toMatch(/^cam_[0-9a-f]{12}$/)
    expect(cameraKey('urn:uuid:2419d68a-2dd2-21b2')).toMatch(/^cam_[0-9a-f]{12}$/)
  })
})
