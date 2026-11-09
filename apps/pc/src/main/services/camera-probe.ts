import { loadOnvif } from '../lib/onvif-module'
import type {
  DiscoveredCamera,
  ProbedCamera,
  StreamProfile,
  StreamProfileKind,
  VideoCodec,
} from '../../shared/types'

export interface RawProfile {
  readonly token: string
  readonly name: string | null
  readonly encoding: string
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly bitrateKbps: number | null
  readonly rtspUri: string
}

/** ONVIF가 보고하는 인코딩 이름을 우리 코덱 이름으로 정규화한다. */
const toCodec = (encoding: string): VideoCodec | null => {
  const normalized = encoding.trim().toUpperCase()
  if (normalized === 'H264' || normalized === 'AVC') return 'h264'
  if (normalized === 'H265' || normalized === 'HEVC') return 'h265'
  // JPEG/MPEG4 는 mp4 로 무손실 재다중화(-c copy)가 곤란해 다루지 않는다.
  return null
}

/**
 * 해상도가 가장 큰 프로필을 main(녹화용), 나머지를 sub(분석용)으로 분류한다.
 * 큰 것부터 정렬해 반환한다.
 */
export const classifyProfiles = (profiles: readonly RawProfile[]): StreamProfile[] =>
  profiles
    .map((profile) => ({ profile, codec: toCodec(profile.encoding) }))
    .filter((entry): entry is { profile: RawProfile; codec: VideoCodec } => entry.codec !== null)
    .sort((a, b) => b.profile.width * b.profile.height - a.profile.width * a.profile.height)
    .map(({ profile, codec }, index) => ({
      token: profile.token,
      kind: (index === 0 ? 'main' : 'sub') as StreamProfileKind,
      rtspUri: profile.rtspUri,
      codec,
      width: profile.width,
      height: profile.height,
      fps: profile.fps,
      bitrateKbps: profile.bitrateKbps,
    }))

/**
 * 원하는 종류의 프로필을 고른다.
 * sub 은 "가장 작은 것"이다 — 대역폭 절약이 목적이기 때문이다.
 * 프로필이 하나뿐이면 종류와 무관하게 그것을 준다.
 */
export const pickProfile = (
  profiles: readonly StreamProfile[],
  kind: StreamProfileKind,
): StreamProfile | null => {
  if (profiles.length === 0) return null
  if (profiles.length === 1 || kind === 'main') return profiles[0] ?? null
  return profiles[profiles.length - 1] ?? null
}

/**
 * RTSP URL 에 자격증명을 끼워넣는다.
 *
 * ONVIF 가 돌려주는 스트림 URL 에는 보통 자격증명이 없지만, 카메라는 RTSP 단계에서
 * 다시 인증을 요구한다. 비밀번호에 `@` `/` `:` 가 들어가면 URL 이 깨지는 것이
 * 현장에서 흔한 실패라 반드시 인코딩한다.
 */
export const withRtspCredentials = (uri: string, username: string, password: string): string => {
  if (!username) return uri
  const parsed = new URL(uri)
  parsed.username = encodeURIComponent(username)
  parsed.password = encodeURIComponent(password)
  return parsed.toString()
}

export interface ScopeInfo {
  readonly manufacturer: string | null
  readonly model: string | null
  readonly name: string | null
}

/** ONVIF WS-Discovery 의 scope 문자열에서 제조사·모델·이름을 뽑는다. */
export const parseScopes = (scopes: string | readonly string[] | undefined): ScopeInfo => {
  const text = Array.isArray(scopes) ? scopes.join(' ') : String(scopes ?? '')
  const find = (key: string): string | null => {
    const matched = new RegExp(`onvif://www\\.onvif\\.org/${key}/([^\\s]+)`).exec(text)
    return matched?.[1] ? decodeURIComponent(matched[1]) : null
  }
  const name = find('name')
  return { manufacturer: name, model: find('hardware'), name }
}

export class OnvifAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OnvifAuthError'
  }
}

/** 인증 실패는 재시도로 풀리지 않으므로 다른 오류와 구분한다. */
export const isAuthFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error)
  return /401|unauthor|not authorized|authentication|sender not authorized/i.test(message)
}

export interface ProbeArgs {
  readonly camera: DiscoveredCamera
  readonly username: string
  readonly password: string
  readonly timeoutMs?: number
}

interface OnvifCamLike {
  getProfiles(cb: (err: Error | null, profiles?: unknown) => void): void
  getStreamUri(
    options: { protocol: string; profileToken: string },
    cb: (err: Error | null, result?: { uri?: string }) => void,
  ): void
}

const promisify = <T>(run: (cb: (err: Error | null, value?: T) => void) => void): Promise<T> =>
  new Promise((resolve, reject) => {
    run((error, value) => (error ? reject(error) : resolve(value as T)))
  })

/** onvif 라이브러리가 주는 느슨한 프로필 객체를 RawProfile 로 좁힌다. */
export const toRawProfile = (profile: unknown): RawProfile | null => {
  const record = profile as Record<string, any>
  const encoder = record?.videoEncoderConfiguration
  const token = record?.$?.token ?? record?.token
  if (!encoder || typeof token !== 'string') return null
  return {
    token,
    name: typeof record.name === 'string' ? record.name : null,
    encoding: String(encoder.encoding ?? ''),
    width: Number(encoder.resolution?.width ?? 0),
    height: Number(encoder.resolution?.height ?? 0),
    fps: Number(encoder.rateControl?.frameRateLimit ?? 0),
    bitrateKbps: Number(encoder.rateControl?.bitrateLimit ?? 0) || null,
    rtspUri: '',
  }
}

export const probeCamera = async (args: ProbeArgs): Promise<ProbedCamera> => {
  const { Cam } = await loadOnvif()
  const url = new URL(args.camera.xaddr)

  const cam = await new Promise<OnvifCamLike>((resolve, reject) => {
    const instance: any = new (Cam as any)(
      {
        hostname: url.hostname,
        port: Number(url.port || 80),
        path: url.pathname,
        username: args.username,
        password: args.password,
        timeout: args.timeoutMs ?? 10_000,
      },
      (error: Error | null) => (error ? reject(error) : resolve(instance)),
    )
  }).catch((error: unknown) => {
    if (isAuthFailure(error)) {
      throw new OnvifAuthError(
        '카메라 인증에 실패했습니다. 일부 제조사는 관리자 계정과 별개로 ' +
          'ONVIF 전용 계정을 만들어야 합니다 (카메라 웹설정 → 네트워크 → 고급 → ONVIF).',
      )
    }
    throw error
  })

  const rawProfiles = await promisify<unknown>((cb) => cam.getProfiles(cb))
  const candidates = (Array.isArray(rawProfiles) ? rawProfiles : [rawProfiles])
    .map(toRawProfile)
    .filter((profile): profile is RawProfile => profile !== null)

  const withUris = await Promise.all(
    candidates.map(async (profile) => {
      const result = await promisify<{ uri?: string }>((cb) =>
        cam.getStreamUri({ protocol: 'RTSP', profileToken: profile.token }, cb),
      ).catch(() => null)
      const uri = result?.uri
      return uri ? { ...profile, rtspUri: withRtspCredentials(uri, args.username, args.password) } : null
    }),
  )

  return {
    camera: args.camera,
    profiles: classifyProfiles(withUris.filter((p): p is RawProfile => p !== null)),
  }
}
