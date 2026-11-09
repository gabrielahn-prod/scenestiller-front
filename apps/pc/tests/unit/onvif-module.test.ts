import { describe, it, expect } from 'vitest'
import { pickFromModule, resolveOnvifModule } from '../../src/main/lib/onvif-module'

const Discovery = { probe: () => undefined }
const Cam = function Cam() {} as unknown as new () => unknown

describe('pickFromModule', () => {
  it('네임스페이스에 있으면 그것을 쓴다', () => {
    expect(pickFromModule({ Discovery }, 'Discovery')).toBe(Discovery)
  })

  it('없으면 default 안에서 찾는다', () => {
    expect(pickFromModule({ default: { Discovery } }, 'Discovery')).toBe(Discovery)
  })

  it('둘 다 없으면 null', () => {
    expect(pickFromModule({}, 'Discovery')).toBeNull()
    expect(pickFromModule(null, 'Discovery')).toBeNull()
  })
})

describe('resolveOnvifModule', () => {
  it('Vite 로더 모양(전부 named export)을 받아들인다', () => {
    expect(resolveOnvifModule({ Discovery, Cam }).Discovery).toBe(Discovery)
  })

  it('Electron 번들 모양(Cam 만 named, 나머지는 default)을 받아들인다', () => {
    // 실제로 Electron 에서 관측된 모양이다. Discovery 가 named export 로 안 잡힌다.
    const namespace = { Cam, default: { Cam, Discovery } }
    expect(resolveOnvifModule(namespace).Discovery).toBe(Discovery)
  })

  it('Discovery 를 못 찾으면 조용히 넘어가지 않고 던진다', () => {
    expect(() => resolveOnvifModule({ Cam })).toThrow(/onvif 모듈을 불러오지 못했습니다/)
  })

  it('Cam 을 못 찾아도 던진다', () => {
    expect(() => resolveOnvifModule({ Discovery })).toThrow(/onvif 모듈을 불러오지 못했습니다/)
  })
})
