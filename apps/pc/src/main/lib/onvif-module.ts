/**
 * onvif 는 CommonJS 라이브러리다. 로더에 따라 네임스페이스 모양이 달라진다.
 *
 * Electron 번들(ESM → CJS)에서 `await import('onvif')` 는 `{ Cam, default }` 만 준다.
 * `Discovery` 가 named export 로 안 잡히는 이유는 Node 의 CJS named-export 탐지기가
 * `Object.create(new EventEmitter())` 로 만들어 나중에 붙이는 값을 정적으로 못 읽기 때문이다.
 * 반면 Vite/vitest 는 자체 interop 으로 전체 exports 를 준다.
 *
 * 그래서 두 모양을 모두 받아들이고, 못 찾으면 조용히 넘어가지 않고 던진다.
 * 예전에 이 실패를 catch 로 삼켜서 "카메라 0대"로 보이게 만든 적이 있다.
 */

export interface OnvifDiscovery {
  probe(
    options: { timeout?: number; resolve?: boolean },
    callback: (error: Error | null, found: unknown[]) => void,
  ): void
}

export type OnvifCamConstructor = new (
  options: Record<string, unknown>,
  callback: (error: Error | null) => void,
) => unknown

export interface OnvifModule {
  readonly Discovery: OnvifDiscovery
  readonly Cam: OnvifCamConstructor
}

/** 네임스페이스와 default 양쪽에서 키를 찾는다. */
export const pickFromModule = <T>(namespace: unknown, key: string): T | null => {
  const record = (namespace ?? {}) as Record<string, unknown>
  const fallback = (record.default ?? {}) as Record<string, unknown>
  return (record[key] ?? fallback[key] ?? null) as T | null
}

export const resolveOnvifModule = (namespace: unknown): OnvifModule => {
  const Discovery = pickFromModule<OnvifDiscovery>(namespace, 'Discovery')
  const Cam = pickFromModule<OnvifCamConstructor>(namespace, 'Cam')
  if (!Discovery || typeof Discovery.probe !== 'function' || typeof Cam !== 'function') {
    throw new Error(
      'onvif 모듈을 불러오지 못했습니다 (Discovery/Cam 을 찾을 수 없음). ' +
        '패키지 설치 상태와 번들 설정을 확인하세요.',
    )
  }
  return { Discovery, Cam }
}

export const loadOnvif = async (): Promise<OnvifModule> =>
  resolveOnvifModule(await import('onvif'))
