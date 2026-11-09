import { join } from 'node:path'

/**
 * ffmpeg 가 쓰는 중인 조각이 담기는 하위 디렉토리.
 *
 * 완성된 조각과 물리적으로 분리하는 것이 핵심이다. 한 디렉토리에 섞어두면
 * "지금 쓰이고 있는 파일"과 "다 쓴 파일"을 구분할 방법이 없어 미완성 조각을
 * 업로드하게 된다. 완성 신호(manifest)를 받은 뒤 스풀 루트로 옮긴다.
 *
 * 이름 앞의 점은 의도적이다. 쓰는 중인 mp4 는 색인(moov atom)이 아직 없어서
 * 재생하면 앞부분이 정지 화면으로 보인다. 사용자가 보관 폴더를 열었다가
 * 그 파일을 재생하고 고장난 줄 아는 일을 막는다.
 */
export const PARTS_DIR = '.writing'

/** ffmpeg 가 조각을 닫을 때마다 파일명 한 줄을 추가하는 목록 파일. */
export const MANIFEST_NAME = 'manifest.txt'

/**
 * 쓰는 중인 조각의 파일명 패턴. 실행 단위로 0 부터 증가한다.
 * 시각(strftime)을 쓰지 않는 이유: 해상도가 초 단위라 짧은 조각에서 이름이
 * 충돌해 파일을 덮어쓴다. 정확한 시각은 완성 시점의 mtime 으로 따로 새긴다.
 */
export const PART_FILE_PATTERN = 'part_%05d.mp4'

/** RTSP 소켓 I/O 타임아웃(마이크로초). ffmpeg 6.0 기준 옵션명은 `-timeout`. */
const SOCKET_TIMEOUT_US = 15_000_000

export interface SegmentArgsInput {
  readonly rtspUri: string
  readonly spoolDir: string
  readonly segmentSeconds: number
  readonly includeAudio: boolean
  /**
   * 조각 경계를 벽시계에 맞출지.
   * 켜면 카메라마다 시작 시각이 달라도 14:30, 14:35 처럼 같은 시각에 잘린다.
   * 여러 카메라를 같은 구간끼리 나란히 놓고 볼 수 있게 하는 유일한 방법이다.
   */
  readonly alignToClock: boolean
}

export const partsDirOf = (spoolDir: string): string => join(spoolDir, PARTS_DIR)
export const manifestPathOf = (spoolDir: string): string => join(partsDirOf(spoolDir), MANIFEST_NAME)

/**
 * RTSP 스트림을 재인코딩 없이 조각내는 ffmpeg 인자.
 *
 * 핵심 두 가지:
 * - `-c:v copy` : 재인코딩하지 않으므로 CPU 를 거의 쓰지 않고 화질 손실이 없다.
 * - `-f segment`: 키프레임(IDR) 경계에서만 자른다. H.264/H.265 는 임의 지점에서
 *   자르면 재생 불가능한 조각이 나오는데, 이 머서가 그 제약을 알아서 지킨다.
 */
export const buildSegmentArgs = (input: SegmentArgsInput): string[] => [
  '-hide_banner',
  '-loglevel', 'warning',
  '-nostdin',
  '-rtsp_transport', 'tcp',
  '-timeout', String(SOCKET_TIMEOUT_US),
  '-i', input.rtspUri,
  ...(input.includeAudio ? ['-c:a', 'copy'] : ['-an']),
  '-c:v', 'copy',
  '-f', 'segment',
  '-segment_time', String(input.segmentSeconds),
  ...(input.alignToClock ? ['-segment_atclocktime', '1'] : []),
  '-segment_format', 'mp4',
  '-reset_timestamps', '1',
  '-segment_list', manifestPathOf(input.spoolDir),
  '-segment_list_type', 'flat',
  // +live 가 없으면 manifest 가 버퍼링되어 조각 완성 신호가 늦게 온다.
  '-segment_list_flags', '+live',
  join(partsDirOf(input.spoolDir), PART_FILE_PATTERN),
]
