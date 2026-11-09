import { execFile } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'
import { promisify } from 'node:util'
import { resolveFfmpegPath } from '../lib/ffmpeg'

const execFileAsync = promisify(execFile)

export interface SnapshotArgsInput {
  readonly rtspUri: string
  readonly outPath: string
}

/**
 * RTSP 스트림에서 정지 화면 한 장.
 *
 * 브라우저·Electron 렌더러는 RTSP 를 재생할 수 없다. 그래서 미리보기는 영상
 * 스트리밍이 아니라 스냅샷을 주기적으로 갈아끼우는 방식으로 한다.
 * "이 카메라가 계산대가 맞는가"를 확인하는 용도로는 이걸로 충분하다.
 */
export const buildSnapshotArgs = (input: SnapshotArgsInput): string[] => [
  '-hide_banner',
  '-loglevel', 'error',
  '-nostdin',
  '-rtsp_transport', 'tcp',
  '-timeout', '10000000',
  '-i', input.rtspUri,
  '-frames:v', '1',
  '-f', 'image2',
  '-y',
  input.outPath,
]

export const captureSnapshot = async (
  rtspUri: string,
  outPath: string,
  options: { readonly ffmpegPath?: string; readonly timeoutMs?: number } = {},
): Promise<string> => {
  await mkdir(dirname(outPath), { recursive: true })
  await execFileAsync(options.ffmpegPath ?? resolveFfmpegPath(), buildSnapshotArgs({ rtspUri, outPath }), {
    timeout: options.timeoutMs ?? 15_000,
  })
  return outPath
}
