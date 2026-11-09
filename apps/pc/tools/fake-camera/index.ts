import { execFile } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { resolveFfmpegPath } from '../../src/main/lib/ffmpeg'
import { startOnvifDevice, type OnvifProfileSpec } from './onvif-responder'
import { startRtspServer, type StreamSpec } from './rtsp-server'
import { defaultWebcamDevice, type CameraSource } from './source'

const execFileAsync = promisify(execFile)

/**
 * 가짜 CCTV 카메라 — 테스트 도구다. 제품 코드가 아니다.
 *
 * 진짜 카메라가 하는 두 가지를 흉내낸다:
 *   1. ONVIF 로 자신을 광고하고 스트림 주소를 알려준다
 *   2. 그 주소에서 RTSP 로 H.264 영상을 내보낸다 (메인/서브 두 갈래)
 *
 * 에이전트는 이것과 진짜 카메라를 구분하지 못한다. 그게 목적이다.
 */

export interface FakeCameraOptions {
  readonly host?: string
  /**
   * 영상 입력. 생략하면 생성된 테스트 영상 파일을 쓴다.
   * 'webcam' 을 주면 노트북 카메라를 CCTV 인 척 내보낸다.
   */
  readonly source?: CameraSource | 'webcam'
  readonly sourceFile?: string
  readonly gopSeconds?: number
  readonly manufacturer?: string
  readonly model?: string
  readonly friendlyName?: string
  /** false 면 ONVIF 검색에 응답하지 않는다. 수동 주소 입력 경로를 시험할 때 쓴다. */
  readonly advertise?: boolean
  readonly rtspPort?: number
  readonly onvifPort?: number
}

export interface FakeCamera {
  readonly rtsp: Readonly<Record<string, string>>
  readonly xaddr: string
  readonly uuid: string
  close(): Promise<void>
}

const STREAMS: readonly Omit<StreamSpec, 'source' | 'gopSeconds'>[] = [
  { path: 'main', width: 1280, height: 720, fps: 15, bitrateKbps: 2000 },
  { path: 'sub', width: 640, height: 480, fps: 15, bitrateKbps: 400 },
]

/** 테스트용 영상을 만든다 (이미 있으면 그대로 쓴다). */
export const ensureTestVideo = async (
  path: string,
  { seconds = 20, fps = 15 }: { seconds?: number; fps?: number } = {},
): Promise<string> => {
  if (existsSync(path)) return path
  mkdirSync(dirname(path), { recursive: true })
  await execFileAsync(resolveFfmpegPath(), [
    '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `testsrc2=size=1280x720:rate=${fps}`,
    '-t', String(seconds),
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p',
    '-g', String(fps), '-y', path,
  ])
  return path
}

const resolveSource = async (options: FakeCameraOptions): Promise<CameraSource> => {
  if (options.source === 'webcam') return { kind: 'webcam', device: defaultWebcamDevice() }
  if (options.source) return options.source
  return { kind: 'file', path: await ensureTestVideo(options.sourceFile ?? '.tmp/fake-camera-source.mp4') }
}

export const startFakeCamera = async (options: FakeCameraOptions = {}): Promise<FakeCamera> => {
  const host = options.host ?? '127.0.0.1'
  const gopSeconds = options.gopSeconds ?? 1
  const source = await resolveSource(options)

  // 웹캠은 장치를 동시에 두 번 열 수 없는 환경이 있어 스트림 하나만 낸다.
  // 파일 입력은 메인/서브 두 갈래를 모두 내보내 진짜 카메라와 같은 모양을 만든다.
  const streams = source.kind === 'webcam' ? STREAMS.filter((s) => s.path === 'sub') : STREAMS

  const rtsp = await startRtspServer({
    ffmpegPath: resolveFfmpegPath(),
    host,
    ...(options.rtspPort === undefined ? {} : { port: options.rtspPort }),
    streams: streams.map((stream) => ({ ...stream, source, gopSeconds })),
  })

  const profiles: OnvifProfileSpec[] = streams.map((stream) => ({
    token: stream.path,
    name: `${stream.path}Stream`,
    rtspUri: rtsp.urls[stream.path]!,
    encoding: 'H264',
    width: stream.width,
    height: stream.height,
    fps: stream.fps,
    bitrateKbps: stream.bitrateKbps,
  }))

  const onvif = await startOnvifDevice({
    host,
    ...(options.onvifPort === undefined ? {} : { port: options.onvifPort }),
    ...(options.advertise === undefined ? {} : { advertise: options.advertise }),
    ...(options.manufacturer === undefined ? {} : { manufacturer: options.manufacturer }),
    ...(options.model === undefined ? {} : { model: options.model }),
    ...(options.friendlyName === undefined ? {} : { friendlyName: options.friendlyName }),
    profiles,
  })

  return {
    rtsp: rtsp.urls,
    xaddr: onvif.xaddr,
    uuid: onvif.uuid,
    close: async () => {
      await onvif.close()
      await rtsp.close()
    },
  }
}
