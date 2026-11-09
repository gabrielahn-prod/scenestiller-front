import { spawn, type ChildProcess } from 'node:child_process'
import { createSocket, type Socket as UdpSocket } from 'node:dgram'
import { readFileSync, rmSync } from 'node:fs'
import { createServer, type Server, type Socket } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { inputArgs, type CameraSource } from './source'

/**
 * 최소 RTSP 서버 — 진짜 IP 카메라를 대신한다.
 *
 * 왜 직접 만드는가: ffmpeg 의 rtsp 머서는 listen 모드를 지원하지 않아 스스로
 * RTSP 서버가 될 수 없다. MediaMTX 같은 외부 바이너리를 받아오는 대신,
 * 무거운 일(H.264 → RTP 패킷화, RFC 6184)은 ffmpeg 에 맡기고 여기서는
 * RTSP 제어 프로토콜과 TCP interleaved 중계만 한다.
 *
 * 지원 범위는 의도적으로 좁다. 에이전트는 항상 `-rtsp_transport tcp` 로 붙으므로
 * TCP interleaved 만 구현하면 충분하다.
 */

export interface StreamSpec {
  /** RTSP 경로. 예: 'main' → rtsp://host:port/main */
  readonly path: string
  readonly source: CameraSource
  readonly width: number
  readonly height: number
  readonly fps: number
  readonly gopSeconds: number
  readonly bitrateKbps: number
}

interface LiveStream {
  readonly spec: StreamSpec
  readonly udp: UdpSocket
  readonly ffmpeg: ChildProcess
  sdp: string
  readonly subscribers: Set<Socket>
}

export interface RtspServer {
  readonly port: number
  readonly urls: Readonly<Record<string, string>>
  close(): Promise<void>
}

const RTSP_EOL = '\r\n'
const INTERLEAVE_MAGIC = 0x24

const freeUdpPort = async (): Promise<number> =>
  new Promise((resolve) => {
    const probe = createSocket('udp4')
    probe.bind(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })

/**
 * ffmpeg 가 만든 SDP 를 RTSP DESCRIBE 응답용으로 고친다.
 * - 미디어 포트는 0 으로 (전송 방식은 SETUP 에서 협상한다)
 * - 트랙마다 a=control 을 붙여야 클라이언트가 SETUP 대상을 알 수 있다
 */
export const toRtspSdp = (raw: string, controlBase: string): string => {
  const lines = raw.split(/\r?\n/).filter((line) => line.length > 0)
  const withSessionControl = lines.flatMap((line) =>
    line.startsWith('t=') ? [line, `a=control:${controlBase}`] : [line],
  )
  return `${withSessionControl
    .flatMap((line) =>
      line.startsWith('m=')
        ? [line.replace(/^m=(\w+) \d+/, 'm=$1 0'), `a=control:${controlBase}/streamid=0`]
        : [line],
    )
    .join(RTSP_EOL)}${RTSP_EOL}`
}

const startStream = async (spec: StreamSpec, ffmpegPath: string): Promise<LiveStream> => {
  const rtpPort = await freeUdpPort()
  const sdpPath = join(tmpdir(), `fake-cam-${randomBytes(4).toString('hex')}.sdp`)

  // ffmpeg 가 보내기 전에 수신 소켓을 먼저 열어 둔다.
  const udp = createSocket('udp4')
  await new Promise<void>((resolve) => udp.bind(rtpPort, '127.0.0.1', resolve))

  const args = [
    '-hide_banner', '-loglevel', 'error', '-nostdin',
    ...inputArgs(spec.source, { width: spec.width, height: spec.height, fps: spec.fps }),
    '-an',
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-s', `${spec.width}x${spec.height}`,
    '-r', String(spec.fps),
    // GOP 길이가 곧 조각을 자를 수 있는 최소 단위가 된다.
    '-g', String(spec.fps * spec.gopSeconds),
    '-keyint_min', String(spec.fps * spec.gopSeconds),
    '-sc_threshold', '0',
    '-b:v', `${spec.bitrateKbps}k`,
    '-f', 'rtp',
    '-sdp_file', sdpPath,
    `rtp://127.0.0.1:${rtpPort}`,
  ]
  const ffmpeg = spawn(ffmpegPath, args, { stdio: ['ignore', 'ignore', 'pipe'] })
  const diagnostics = { stderr: '' }
  ffmpeg.stderr?.on('data', (chunk: Buffer) => {
    diagnostics.stderr = `${diagnostics.stderr}${chunk.toString()}`.slice(-4000)
  })

  // SDP 파일은 ffmpeg 가 헤더를 쓰는 시점에 생성된다. 잠깐 기다렸다 읽는다.
  const sdp = await (async () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      try {
        const text = readFileSync(sdpPath, 'utf8')
        if (text.includes('m=video')) return text
      } catch {
        // 아직 안 만들어졌다
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const hint =
      spec.source.kind === 'webcam'
        ? '\n\n웹캠이 열리지 않았습니다. macOS 라면 시스템 설정 → 개인정보 보호 및 보안 → ' +
          '카메라 에서 이 명령을 실행한 터미널 앱을 허용했는지 확인하세요. ' +
          '권한이 없으면 ffmpeg 가 프레임을 한 장도 받지 못한 채 멈춥니다.'
        : ''
    throw new Error(
      `ffmpeg 가 SDP 를 만들지 못했습니다 (${spec.path})\n` +
        `${diagnostics.stderr.trim() || '(stderr 없음)'}${hint}`,
    )
  })()
  rmSync(sdpPath, { force: true })

  const stream: LiveStream = { spec, udp, ffmpeg, sdp, subscribers: new Set() }

  udp.on('message', (packet) => {
    // RTSP interleaved 프레이밍: '$' + 채널 + 길이(2바이트 빅엔디언) + RTP 패킷
    const header = Buffer.alloc(4)
    header[0] = INTERLEAVE_MAGIC
    header[1] = 0
    header.writeUInt16BE(packet.length, 2)
    const framed = Buffer.concat([header, packet])
    stream.subscribers.forEach((socket) => {
      if (!socket.destroyed) socket.write(framed)
    })
  })

  return stream
}

interface RtspRequest {
  readonly method: string
  readonly url: string
  readonly headers: Readonly<Record<string, string>>
}

export const parseRtspRequest = (raw: string): RtspRequest | null => {
  const [requestLine, ...headerLines] = raw.split(RTSP_EOL)
  const matched = /^([A-Z_]+) (\S+) RTSP\/1\.0$/.exec(requestLine ?? '')
  if (!matched) return null
  return {
    method: matched[1]!,
    url: matched[2]!,
    headers: headerLines.reduce<Record<string, string>>((acc, line) => {
      const index = line.indexOf(':')
      return index === -1
        ? acc
        : { ...acc, [line.slice(0, index).trim().toLowerCase()]: line.slice(index + 1).trim() }
    }, {}),
  }
}

/** 요청 URL 에서 스트림 경로(main/sub)를 뽑는다. */
export const streamPathFromUrl = (url: string, known: readonly string[]): string | null =>
  known.find((path) => new RegExp(`/${path}(/|$|\\?)`).test(url)) ?? null

export interface FakeRtspOptions {
  readonly ffmpegPath: string
  readonly streams: readonly StreamSpec[]
  readonly port?: number
  readonly host?: string
}

export const startRtspServer = async (options: FakeRtspOptions): Promise<RtspServer> => {
  const host = options.host ?? '127.0.0.1'
  const entries = await Promise.all(
    options.streams.map(async (spec) => [spec.path, await startStream(spec, options.ffmpegPath)] as const),
  )
  const streams = new Map(entries)
  const paths = [...streams.keys()]

  const respond = (socket: Socket, cseq: string, status = '200 OK', headers: string[] = [], body = ''): void => {
    const head = [
      `RTSP/1.0 ${status}`,
      `CSeq: ${cseq}`,
      'Server: FakeCamera/1.0',
      ...headers,
      ...(body ? [`Content-Length: ${Buffer.byteLength(body)}`] : []),
      '',
      body,
    ].join(RTSP_EOL)
    socket.write(head)
  }

  const openSockets = new Set<Socket>()

  const server: Server = createServer((socket) => {
    openSockets.add(socket)
    const session = randomBytes(4).toString('hex')
    const connection = { buffer: '', stream: null as LiveStream | null }

    socket.on('data', (chunk) => {
      connection.buffer += chunk.toString('binary')
      while (connection.buffer.includes(`${RTSP_EOL}${RTSP_EOL}`)) {
        const end = connection.buffer.indexOf(`${RTSP_EOL}${RTSP_EOL}`)
        const raw = connection.buffer.slice(0, end)
        connection.buffer = connection.buffer.slice(end + 4)

        const request = parseRtspRequest(raw)
        if (!request) continue
        const cseq = request.headers.cseq ?? '0'
        const path = streamPathFromUrl(request.url, paths) ?? paths[0]
        const stream = path ? streams.get(path) ?? null : null

        if (request.method === 'OPTIONS') {
          respond(socket, cseq, '200 OK', ['Public: OPTIONS, DESCRIBE, SETUP, PLAY, TEARDOWN'])
          continue
        }
        if (request.method === 'DESCRIBE') {
          if (!stream) {
            respond(socket, cseq, '404 Not Found')
            continue
          }
          const base = request.url.split('?')[0] ?? request.url
          respond(
            socket,
            cseq,
            '200 OK',
            ['Content-Type: application/sdp', `Content-Base: ${base}/`],
            toRtspSdp(stream.sdp, base),
          )
          continue
        }
        if (request.method === 'SETUP') {
          connection.stream = stream
          respond(socket, cseq, '200 OK', [
            'Transport: RTP/AVP/TCP;unicast;interleaved=0-1',
            `Session: ${session};timeout=60`,
          ])
          continue
        }
        if (request.method === 'PLAY') {
          const target = connection.stream ?? stream
          if (target) target.subscribers.add(socket)
          respond(socket, cseq, '200 OK', [`Session: ${session}`, 'Range: npt=0.000-'])
          continue
        }
        if (request.method === 'TEARDOWN') {
          connection.stream?.subscribers.delete(socket)
          respond(socket, cseq, '200 OK', [`Session: ${session}`])
          socket.end()
          continue
        }
        if (request.method === 'GET_PARAMETER') {
          respond(socket, cseq, '200 OK', [`Session: ${session}`])
          continue
        }
        respond(socket, cseq, '501 Not Implemented')
      }
    })

    const detach = (): void => {
      streams.forEach((stream) => stream.subscribers.delete(socket))
      openSockets.delete(socket)
    }
    socket.on('close', detach)
    socket.on('error', detach)
  })

  await new Promise<void>((resolve) => server.listen(options.port ?? 0, host, resolve))
  const port = (server.address() as { port: number }).port

  // 테스트는 카메라를 중간에 내렸다가 정리 단계에서 또 내리기도 한다.
  // 두 번째 호출에서 예외가 나면 정리가 중단돼 프로세스가 남는다.
  const closed = { done: false }

  return {
    port,
    urls: Object.fromEntries(paths.map((path) => [path, `rtsp://${host}:${port}/${path}`])),
    close: async () => {
      if (closed.done) return
      closed.done = true
      streams.forEach((stream) => {
        stream.subscribers.forEach((socket) => socket.destroy())
        try {
          stream.ffmpeg.kill('SIGKILL')
        } catch {
          // 이미 죽었다
        }
        try {
          stream.udp.close()
        } catch {
          // 이미 닫혔다
        }
      })
      openSockets.forEach((socket) => socket.destroy())
      openSockets.clear()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    },
  }
}
