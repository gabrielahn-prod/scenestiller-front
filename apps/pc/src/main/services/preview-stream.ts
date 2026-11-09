import { randomBytes } from 'node:crypto'
import { spawn, type ChildProcess } from 'node:child_process'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createJpegSplitter } from '../lib/mjpeg'

/**
 * 실시간 미리보기.
 *
 * 스냅샷을 몇 초마다 새로 찍는 방식은 매번 RTSP 세션을 새로 열어야 해서
 * 몇 초에 한 장이 한계다. 감시 화면이 5초에 한 번 바뀌는 것은 CCTV 라 할 수 없다.
 *
 * 대신 ffmpeg 하나를 계속 띄워 MJPEG 를 뽑고, 로컬 HTTP 로
 * multipart/x-mixed-replace 스트림을 낸다. 브라우저의 <img> 가 이 형식을
 * 그대로 재생하므로 렌더러 쪽에 별도 라이브러리가 필요 없다.
 */

const BOUNDARY = 'cctvframe'

export interface PreviewArgsInput {
  readonly rtspUri: string
  readonly fps: number
  readonly width: number
}

export const buildPreviewArgs = (input: PreviewArgsInput): string[] => [
  '-hide_banner',
  '-loglevel', 'error',
  '-nostdin',
  '-rtsp_transport', 'tcp',
  '-timeout', '15000000',
  // 미리보기는 최신 화면이 중요하다. 버퍼를 줄여 지연을 낮춘다.
  '-fflags', 'nobuffer',
  '-flags', 'low_delay',
  '-i', input.rtspUri,
  '-an',
  '-r', String(input.fps),
  '-vf', `scale=${input.width}:-2`,
  '-q:v', '7',
  '-f', 'mjpeg',
  '-',
]

export type PreviewQuality = 'tile' | 'full'

export interface PreviewStartOptions {
  /** 동시에 여러 카메라를 띄우기 위한 구분자. 같은 키는 스트림을 갈아끼운다. */
  readonly key?: string
  readonly quality?: PreviewQuality
}

export interface PreviewService {
  /** 미리보기를 시작하고 <img src> 에 넣을 URL 을 돌려준다. */
  start(rtspUri: string, options?: PreviewStartOptions): Promise<string>
  /** key 를 주면 그 스트림만, 안 주면 전부 끈다. */
  stop(key?: string): Promise<void>
  isRunning(key?: string): boolean
}

export interface PreviewOptions {
  readonly ffmpegPath: string
  readonly fps?: number
  readonly width?: number
}

/** 키 없이 부르던 기존 호출(2b 카메라 추가의 미리보기)이 쓰는 스트림. */
export const DEFAULT_PREVIEW_KEY = 'default'

/**
 * 화질별 ffmpeg 설정.
 *
 * 2c 격자는 최대 8대를 동시에 띄운다. 카메라마다 ffmpeg 가 하나씩 돌고 그
 * 비용의 대부분은 입력 디코딩이라 줄일 수 없지만, 출력(인코딩·전송)은 줄일 수
 * 있다 — 작은 타일에 640px·10fps 는 매장 PC 에 낭비다. 크게 볼 때만 제대로 뽑는다.
 */
export const previewSettings = (
  quality: PreviewQuality,
  full: { readonly fps: number; readonly width: number },
): { readonly fps: number; readonly width: number } =>
  quality === 'tile' ? { fps: 4, width: 400 } : full

interface Stream {
  readonly child: ChildProcess
  readonly rtspUri: string
  readonly quality: PreviewQuality
  readonly clients: Set<ServerResponse>
  latest: Buffer | null
}

export const createPreviewService = (options: PreviewOptions): PreviewService => {
  const full = { fps: options.fps ?? 10, width: options.width ?? 640 }
  const token = randomBytes(12).toString('hex')

  const state = {
    server: null as Server | null,
    port: 0,
    streams: new Map<string, Stream>(),
  }

  const writeFrame = (response: ServerResponse, frame: Buffer): void => {
    response.write(
      `--${BOUNDARY}\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`,
    )
    response.write(frame)
    response.write('\r\n')
  }

  const ensureServer = async (): Promise<number> => {
    if (state.server) return state.port
    const server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      const stream = state.streams.get(url.searchParams.get('k') ?? DEFAULT_PREVIEW_KEY)
      // 로컬 전용이지만 다른 프로세스가 훔쳐보지 못하도록 토큰을 확인한다.
      if (url.pathname !== '/preview' || url.searchParams.get('t') !== token || !stream) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, {
        'content-type': `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
        'cache-control': 'no-store',
        connection: 'close',
      })
      stream.clients.add(res)
      // 첫 화면이 바로 뜨도록 마지막 프레임을 즉시 보낸다.
      if (stream.latest) writeFrame(res, stream.latest)
      req.on('close', () => stream.clients.delete(res))
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    state.server = server
    state.port = (server.address() as AddressInfo).port
    return state.port
  }

  const stopStream = async (key: string): Promise<void> => {
    const stream = state.streams.get(key)
    if (!stream) return
    state.streams.delete(key)
    stream.clients.forEach((response) => response.end())
    stream.clients.clear()
    await new Promise<void>((resolve) => {
      if (stream.child.exitCode !== null) return resolve()
      const force = setTimeout(() => stream.child.kill('SIGKILL'), 2000)
      stream.child.once('exit', () => {
        clearTimeout(force)
        resolve()
      })
      stream.child.kill('SIGTERM')
    })
  }

  const closeServerIfIdle = async (): Promise<void> => {
    if (state.streams.size > 0) return
    const server = state.server
    state.server = null
    if (server) await new Promise<void>((resolve) => server.close(() => resolve()))
  }

  return {
    isRunning: (key) => (key ? state.streams.has(key) : state.streams.size > 0),

    start: async (rtspUri, startOptions = {}) => {
      const key = startOptions.key ?? DEFAULT_PREVIEW_KEY
      const quality = startOptions.quality ?? 'full'
      const port = await ensureServer()
      const url = `http://127.0.0.1:${port}/preview?t=${token}&k=${encodeURIComponent(key)}`

      const existing = state.streams.get(key)
      if (existing && existing.rtspUri === rtspUri && existing.quality === quality) return url
      await stopStream(key)

      const settings = previewSettings(quality, full)
      const child = spawn(options.ffmpegPath, buildPreviewArgs({ rtspUri, ...settings }), {
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      const stream: Stream = { child, rtspUri, quality, clients: new Set(), latest: null }
      state.streams.set(key, stream)

      const push = createJpegSplitter((frame) => {
        stream.latest = frame
        stream.clients.forEach((response) => {
          if (!response.writableEnded) writeFrame(response, frame)
        })
      })
      child.stdout?.on('data', (chunk: Buffer) => push(chunk))
      child.on('exit', () => {
        // 카메라가 끊겨 ffmpeg 가 죽었다. 같은 키로 다시 start 하면 새로 띄운다.
        if (state.streams.get(key) === stream) state.streams.delete(key)
      })
      return url
    },

    stop: async (key) => {
      const keys = key ? [key] : [...state.streams.keys()]
      await Promise.all(keys.map(stopStream))
      await closeServerIfIdle()
    },
  }
}
