import { platform } from 'node:os'

/**
 * 가짜 카메라가 읽어들일 영상 입력.
 *
 * 어느 쪽을 쓰든 에이전트가 보는 것은 RTSP 하나뿐이다. 웹캠이든 파일이든
 * 진짜 CCTV 든 에이전트 입장에서는 구분되지 않는다 — 그것이 이 도구의 목적이다.
 */
export type CameraSource =
  | { readonly kind: 'file'; readonly path: string }
  | { readonly kind: 'webcam'; readonly device: string }

export interface CaptureSpec {
  readonly width: number
  readonly height: number
  readonly fps: number
}

/**
 * 웹캠 캡처 프레임레이트.
 *
 * 장치가 15fps 를 지원한다고 보고해도 ffmpeg 의 avfoundation 매칭이 이를 거부하고
 * "Selected framerate is not supported" 로 죽는 경우가 있다(활성 포맷만 비교하는 문제).
 * 30 으로 캡처한 뒤 출력 단계에서 원하는 fps 로 낮추는 편이 안전하다.
 */
export const WEBCAM_CAPTURE_FPS = 30

/**
 * 플랫폼별 웹캠 입력 인자.
 * macOS 는 avfoundation(장치 번호), Windows 는 dshow(장치 이름),
 * Linux 는 v4l2(장치 경로)를 쓴다.
 *
 * 해상도를 반드시 함께 지정한다. avfoundation 은 해상도 없이 프레임레이트만
 * 주면 모드를 못 고르고 실패한다.
 */
export const webcamInputArgs = (
  device: string,
  capture: CaptureSpec,
  os = platform(),
): string[] => {
  const size = `${capture.width}x${capture.height}`
  if (os === 'darwin') {
    return ['-f', 'avfoundation', '-framerate', String(WEBCAM_CAPTURE_FPS), '-video_size', size, '-i', device]
  }
  if (os === 'win32') {
    return ['-f', 'dshow', '-framerate', String(WEBCAM_CAPTURE_FPS), '-video_size', size, '-i', `video=${device}`]
  }
  return ['-f', 'v4l2', '-framerate', String(WEBCAM_CAPTURE_FPS), '-video_size', size, '-i', device]
}

/** 파일은 실시간 속도로(-re) 무한 반복해 카메라처럼 끊기지 않게 한다. */
export const fileInputArgs = (path: string): string[] => [
  '-re',
  '-stream_loop', '-1',
  '-i', path,
]

export const inputArgs = (
  source: CameraSource,
  capture: CaptureSpec,
  os = platform(),
): string[] =>
  source.kind === 'webcam'
    ? webcamInputArgs(source.device, capture, os)
    : fileInputArgs(source.path)

/** 플랫폼별 기본 웹캠 장치. macOS 는 첫 번째 카메라가 0 번이다. */
export const defaultWebcamDevice = (os = platform()): string =>
  os === 'darwin' ? '0' : os === 'win32' ? 'Integrated Camera' : '/dev/video0'
