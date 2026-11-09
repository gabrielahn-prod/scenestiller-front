import type { DiscoveredCamera } from '../../shared/types'
import { loadOnvif } from '../lib/onvif-module'
import { parseScopes } from './camera-probe'

const DEFAULT_TIMEOUT_MS = 5000

const firstXAddr = (raw: unknown): string | null => {
  const text = Array.isArray(raw) ? raw.join(' ') : typeof raw === 'string' ? raw : ''
  return text.trim().split(/\s+/).filter(Boolean)[0] ?? null
}

/**
 * ONVIF 카메라만 남긴다.
 *
 * WS-Discovery 는 ONVIF 전용 프로토콜이 아니다. 같은 멀티캐스트 주소에 윈도우 PC나
 * 프린터도 응답하므로, Types 에 NetworkVideoTransmitter 가 있는 것만 카메라로 본다.
 */
const isVideoTransmitter = (types: unknown): boolean =>
  /NetworkVideoTransmitter/i.test(Array.isArray(types) ? types.join(' ') : String(types ?? ''))

const toCamera = (match: Record<string, any> | null | undefined): DiscoveredCamera | null => {
  const xaddr = firstXAddr(match?.XAddrs)
  if (!xaddr || !isVideoTransmitter(match?.types)) return null
  const url = (() => {
    try {
      return new URL(xaddr)
    } catch {
      return null
    }
  })()
  if (!url) return null

  const scopes = parseScopes(match?.scopes)
  const endpoint = match?.endpointReference?.address
  return {
    // ONVIF EndpointReference 의 urn:uuid 는 기기 고유값이라 DHCP 로 IP 가 바뀌어도 유지된다.
    id: typeof endpoint === 'string' && endpoint.length > 0 ? endpoint : xaddr,
    xaddr,
    ip: url.hostname,
    port: Number(url.port || (url.protocol === 'https:' ? 443 : 80)),
    manufacturer: scopes.manufacturer,
    model: scopes.model,
    name: scopes.name,
  }
}

/**
 * WS-Discovery 응답(linerase 된 객체)들을 카메라 목록으로 바꾼다.
 * PC 에 네트워크 어댑터가 여러 개면 같은 카메라가 중복 응답하므로 id 로 합친다.
 */
export const toDiscoveredCameras = (responses: readonly unknown[]): DiscoveredCamera[] => {
  const matches = responses.flatMap((response) => {
    const match = (response as Record<string, any> | null)?.probeMatches?.probeMatch
    if (!match) return []
    return Array.isArray(match) ? match : [match]
  })

  return [...matches.reduce((byId, match) => {
    const camera = toCamera(match)
    return camera && !byId.has(camera.id) ? new Map(byId).set(camera.id, camera) : byId
  }, new Map<string, DiscoveredCamera>()).values()]
}

/**
 * 같은 네트워크의 ONVIF 카메라를 찾는다.
 *
 * `resolve: false` 로 두는 것이 중요하다. 기본값(true)은 라이브러리가 각 카메라에
 * 접속을 시도하는데, 검색 시점에는 아직 사용자가 비밀번호를 입력하기 전이다.
 */
export const discoverCameras = async (timeoutMs = DEFAULT_TIMEOUT_MS): Promise<DiscoveredCamera[]> => {
  const { Discovery } = await loadOnvif()
  const responses = await new Promise<unknown[]>((resolve, reject) => {
    try {
      Discovery.probe({ timeout: timeoutMs, resolve: false }, (error, found) => {
        // 응답이 하나도 없는 것은 정상이다(카메라가 없는 매장). 오류만 걸러낸다.
        resolve(Array.isArray(found) ? found : [])
      })
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)))
    }
  })
  return toDiscoveredCameras(responses)
}
