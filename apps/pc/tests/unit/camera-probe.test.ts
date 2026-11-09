import { describe, it, expect } from 'vitest'
import {
  classifyProfiles,
  pickProfile,
  withRtspCredentials,
  parseScopes,
  type RawProfile,
} from '../../src/main/services/camera-probe'

const raw = (over: Partial<RawProfile> = {}): RawProfile => ({
  token: 'p1',
  name: 'mainStream',
  encoding: 'H264',
  width: 1920,
  height: 1080,
  fps: 15,
  bitrateKbps: 2048,
  rtspUri: 'rtsp://cam/Streaming/Channels/101',
  ...over,
})

describe('classifyProfiles', () => {
  it('해상도가 가장 큰 것을 main 으로 분류한다', () => {
    const result = classifyProfiles([
      raw({ token: 'sub', width: 704, height: 480 }),
      raw({ token: 'main', width: 1920, height: 1080 }),
    ])
    expect(result.find((p) => p.token === 'main')?.kind).toBe('main')
  })

  it('나머지는 sub 으로 분류한다', () => {
    const result = classifyProfiles([
      raw({ token: 'a', width: 1920, height: 1080 }),
      raw({ token: 'b', width: 704, height: 480 }),
      raw({ token: 'c', width: 352, height: 240 }),
    ])
    expect(result.map((p) => `${p.token}:${p.kind}`)).toEqual(['a:main', 'b:sub', 'c:sub'])
  })

  it('큰 것부터 정렬해 반환한다', () => {
    const result = classifyProfiles([
      raw({ token: 'small', width: 352, height: 240 }),
      raw({ token: 'big', width: 1920, height: 1080 }),
    ])
    expect(result.map((p) => p.token)).toEqual(['big', 'small'])
  })

  it('프로필이 하나뿐이면 main 이다', () => {
    expect(classifyProfiles([raw()])[0]!.kind).toBe('main')
  })

  it('H265 를 h265 로 정규화한다', () => {
    expect(classifyProfiles([raw({ encoding: 'H265' })])[0]!.codec).toBe('h265')
    expect(classifyProfiles([raw({ encoding: 'HEVC' })])[0]!.codec).toBe('h265')
  })

  it('H264 를 h264 로 정규화한다', () => {
    expect(classifyProfiles([raw({ encoding: 'H264' })])[0]!.codec).toBe('h264')
  })

  it('mp4 로 재다중화할 수 없는 코덱(JPEG/MPEG4)은 버린다', () => {
    const result = classifyProfiles([
      raw({ token: 'jpeg', encoding: 'JPEG' }),
      raw({ token: 'mpeg4', encoding: 'MPEG4' }),
      raw({ token: 'ok', encoding: 'H264' }),
    ])
    expect(result.map((p) => p.token)).toEqual(['ok'])
  })
})

describe('classifyProfiles — 비트레이트', () => {
  it('카메라가 보고한 비트레이트를 그대로 옮긴다 (화면의 사용량 안내에 쓰인다)', () => {
    expect(classifyProfiles([raw({ bitrateKbps: 512 })])[0]!.bitrateKbps).toBe(512)
  })

  it('비트레이트를 모르면 null', () => {
    expect(classifyProfiles([raw({ bitrateKbps: null })])[0]!.bitrateKbps).toBeNull()
  })
})

describe('pickProfile', () => {
  const profiles = classifyProfiles([
    raw({ token: 'big', width: 1920, height: 1080 }),
    raw({ token: 'mid', width: 1280, height: 720 }),
    raw({ token: 'small', width: 352, height: 240 }),
  ])

  it('main 은 가장 큰 것', () => {
    expect(pickProfile(profiles, 'main')?.token).toBe('big')
  })

  it('sub 은 가장 작은 것 (대역폭 절약이 목적이므로)', () => {
    expect(pickProfile(profiles, 'sub')?.token).toBe('small')
  })

  it('프로필이 하나뿐이면 sub 을 요청해도 그것을 준다', () => {
    const only = classifyProfiles([raw({ token: 'only' })])
    expect(pickProfile(only, 'sub')?.token).toBe('only')
  })

  it('비어 있으면 null', () => {
    expect(pickProfile([], 'main')).toBeNull()
  })
})

describe('withRtspCredentials', () => {
  it('RTSP URL 에 아이디와 비밀번호를 끼워넣는다', () => {
    expect(withRtspCredentials('rtsp://192.168.0.64:554/live', 'admin', 'pw123'))
      .toBe('rtsp://admin:pw123@192.168.0.64:554/live')
  })

  it('비밀번호의 @ 를 인코딩한다 (URL 이 깨지는 대표적 함정)', () => {
    expect(withRtspCredentials('rtsp://cam/live', 'admin', 'p@ss'))
      .toBe('rtsp://admin:p%40ss@cam/live')
  })

  it('비밀번호의 / 와 : 도 인코딩한다', () => {
    expect(withRtspCredentials('rtsp://cam/live', 'admin', 'a/b:c'))
      .toBe('rtsp://admin:a%2Fb%3Ac@cam/live')
  })

  it('아이디가 비어 있으면 원본을 그대로 둔다', () => {
    expect(withRtspCredentials('rtsp://cam/live', '', '')).toBe('rtsp://cam/live')
  })

  it('이미 자격증명이 들어있으면 새 것으로 교체한다', () => {
    expect(withRtspCredentials('rtsp://old:old@cam/live', 'admin', 'new'))
      .toBe('rtsp://admin:new@cam/live')
  })

  it('쿼리스트링을 보존한다', () => {
    expect(withRtspCredentials('rtsp://cam/live?channel=1', 'a', 'b'))
      .toBe('rtsp://a:b@cam/live?channel=1')
  })
})

describe('parseScopes', () => {
  it('ONVIF scope 에서 제조사와 모델을 뽑는다', () => {
    const scopes = 'onvif://www.onvif.org/name/HIKVISION onvif://www.onvif.org/hardware/DS-2CD2143G2'
    expect(parseScopes(scopes)).toEqual({
      manufacturer: 'HIKVISION',
      model: 'DS-2CD2143G2',
      name: 'HIKVISION',
    })
  })

  it('URL 인코딩된 값을 디코딩한다', () => {
    expect(parseScopes('onvif://www.onvif.org/name/Front%20Door').name).toBe('Front Door')
  })

  it('scope 가 없으면 전부 null', () => {
    expect(parseScopes('')).toEqual({ manufacturer: null, model: null, name: null })
  })

  it('배열로 와도 처리한다 (라이브러리가 형태를 바꿔 주기도 한다)', () => {
    expect(parseScopes(['onvif://www.onvif.org/hardware/X1']).model).toBe('X1')
  })
})
