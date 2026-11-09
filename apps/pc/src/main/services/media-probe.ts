import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import ffprobeStatic from 'ffprobe-static'
import type { VideoCodec } from '../../shared/types'

const execFileAsync = promisify(execFile)

export interface ProbedMedia {
  readonly codec: VideoCodec
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly durationMs: number
  readonly sizeBytes: number
}

const toCodec = (name: string): VideoCodec =>
  /hevc|h265/i.test(name) ? 'h265' : 'h264'

/** ffprobe 의 `avg_frame_rate` 는 "30000/1001" 같은 분수로 온다. */
const parseFrameRate = (value: unknown): number => {
  const [numerator, denominator] = String(value ?? '').split('/').map(Number)
  if (!numerator || !denominator) return 0
  return Math.round(numerator / denominator)
}

export const parseProbeOutput = (json: string): ProbedMedia | null => {
  const parsed = (() => {
    try {
      return JSON.parse(json) as Record<string, any>
    } catch {
      return null
    }
  })()
  const stream = (parsed?.streams as any[] | undefined)?.find((s) => s?.codec_type === 'video')
  if (!stream) return null

  return {
    codec: toCodec(String(stream.codec_name ?? '')),
    width: Number(stream.width ?? 0),
    height: Number(stream.height ?? 0),
    fps: parseFrameRate(stream.avg_frame_rate),
    durationMs: Math.round(Number(parsed?.format?.duration ?? 0) * 1000),
    sizeBytes: Number(parsed?.format?.size ?? 0),
  }
}

export const resolveFfprobePath = (): string =>
  ffprobeStatic.path.replace('app.asar', 'app.asar.unpacked')

/** 파일이나 RTSP 스트림의 코덱·해상도·길이를 읽는다. */
export const probeMedia = async (
  target: string,
  options: { readonly ffprobePath?: string; readonly timeoutMs?: number } = {},
): Promise<ProbedMedia | null> => {
  const args = [
    '-v', 'error',
    '-print_format', 'json',
    '-show_streams',
    '-show_format',
    ...(target.startsWith('rtsp://') ? ['-rtsp_transport', 'tcp'] : []),
    target,
  ]
  const result = await execFileAsync(options.ffprobePath ?? resolveFfprobePath(), args, {
    timeout: options.timeoutMs ?? 15_000,
    maxBuffer: 4 * 1024 * 1024,
  }).catch(() => null)
  return result ? parseProbeOutput(result.stdout) : null
}
