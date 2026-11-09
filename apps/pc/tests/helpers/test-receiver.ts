import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { SegmentMeta } from '../../src/shared/types'

export interface ReceivedSegment {
  readonly meta: SegmentMeta
  readonly videoBytes: number
  readonly videoType: string
  readonly idempotencyKey: string | null
  readonly authorization: string | null
  readonly path: string
}

export interface TestReceiver {
  readonly url: string
  readonly received: ReceivedSegment[]
  /** null 이면 정상 동작, 숫자를 넣으면 그 상태코드로만 응답한다. */
  setForcedStatus(status: number | null): void
  stop(): Promise<void>
}

/**
 * 백엔드가 아직 없으므로, API 규격대로 받는지 검사만 하는 테스트용 수신 서버.
 * 실제 백엔드처럼 segmentId 로 멱등 처리한다.
 */
export const startTestReceiver = async (): Promise<TestReceiver> => {
  const received: ReceivedSegment[] = []
  const seen = new Set<string>()
  const state = { forced: null as number | null }

  const server: Server = createServer((req, res) => {
    void (async () => {
      if (state.forced !== null) {
        res.writeHead(state.forced).end()
        return
      }
      if (req.method !== 'POST' || !req.url?.endsWith('/v1/segments')) {
        res.writeHead(404).end()
        return
      }

      const chunks: Buffer[] = []
      for await (const chunk of req) chunks.push(chunk as Buffer)
      const form = await new Response(Buffer.concat(chunks), {
        headers: { 'content-type': req.headers['content-type'] ?? '' },
      }).formData()

      const metaPart = form.get('meta')
      const metaText = typeof metaPart === 'string' ? metaPart : await metaPart!.text()
      const meta = JSON.parse(metaText) as SegmentMeta
      const video = form.get('video') as File

      if (seen.has(meta.segmentId)) {
        res.writeHead(409, { 'content-type': 'application/json' })
          .end(JSON.stringify({ segmentId: meta.segmentId, received: true }))
        return
      }
      seen.add(meta.segmentId)
      received.push({
        meta,
        videoBytes: video.size,
        videoType: video.type,
        idempotencyKey: req.headers['idempotency-key'] as string | undefined ?? null,
        authorization: req.headers.authorization ?? null,
        path: req.url,
      })
      res.writeHead(201, { 'content-type': 'application/json' })
        .end(JSON.stringify({ segmentId: meta.segmentId, received: true }))
    })().catch(() => res.writeHead(500).end())
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${port}`,
    received,
    setForcedStatus: (status) => {
      state.forced = status
    },
    stop: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections()
        server.close(() => resolve())
      }),
  }
}
