import { describe, it, expect } from 'vitest'
import { toDiscoveredCameras } from '../../src/main/services/discovery'

const probeMatch = (over: Record<string, unknown> = {}) => ({
  probeMatches: {
    probeMatch: {
      endpointReference: { address: 'urn:uuid:2419d68a-2dd2-21b2-a205-ec1bd0d0b0ff' },
      types: 'dn:NetworkVideoTransmitter tds:Device',
      scopes:
        'onvif://www.onvif.org/name/HIKVISION onvif://www.onvif.org/hardware/DS-2CD2143G2',
      XAddrs: 'http://192.168.0.64/onvif/device_service',
      ...over,
    },
  },
})

describe('toDiscoveredCameras', () => {
  it('endpointReference 의 urn:uuid 를 안정 식별자로 쓴다 (IP 가 바뀌어도 유지)', () => {
    expect(toDiscoveredCameras([probeMatch()])[0]!.id)
      .toBe('urn:uuid:2419d68a-2dd2-21b2-a205-ec1bd0d0b0ff')
  })

  it('XAddr 에서 IP 와 포트를 뽑는다', () => {
    const camera = toDiscoveredCameras([probeMatch()])[0]!
    expect(camera.ip).toBe('192.168.0.64')
    expect(camera.port).toBe(80)
  })

  it('XAddr 에 포트가 명시되면 그것을 쓴다', () => {
    const camera = toDiscoveredCameras([
      probeMatch({ XAddrs: 'http://192.168.0.64:8000/onvif/device_service' }),
    ])[0]!
    expect(camera.port).toBe(8000)
  })

  it('XAddr 이 여러 개면 첫 번째를 쓴다', () => {
    const camera = toDiscoveredCameras([
      probeMatch({ XAddrs: 'http://192.168.0.64/onvif/device http://10.0.0.1/onvif/device' }),
    ])[0]!
    expect(camera.xaddr).toBe('http://192.168.0.64/onvif/device')
  })

  it('scope 에서 제조사와 모델을 뽑는다', () => {
    const camera = toDiscoveredCameras([probeMatch()])[0]!
    expect(camera.manufacturer).toBe('HIKVISION')
    expect(camera.model).toBe('DS-2CD2143G2')
  })

  it('probeMatch 가 배열이어도 처리한다', () => {
    const data = {
      probeMatches: {
        probeMatch: [
          probeMatch().probeMatches.probeMatch,
          {
            ...probeMatch().probeMatches.probeMatch,
            endpointReference: { address: 'urn:uuid:second' },
            XAddrs: 'http://192.168.0.65/onvif/device_service',
          },
        ],
      },
    }
    expect(toDiscoveredCameras([data]).map((c) => c.ip)).toEqual(['192.168.0.64', '192.168.0.65'])
  })

  it('같은 카메라가 여러 인터페이스로 중복 응답해도 하나로 합친다', () => {
    expect(toDiscoveredCameras([probeMatch(), probeMatch()])).toHaveLength(1)
  })

  it('XAddr 이 없는 응답은 버린다', () => {
    expect(toDiscoveredCameras([probeMatch({ XAddrs: undefined })])).toEqual([])
  })

  it('형태가 깨진 응답은 버린다 (throw 하지 않는다)', () => {
    expect(toDiscoveredCameras([null, undefined, {}, { probeMatches: {} }])).toEqual([])
  })
})
