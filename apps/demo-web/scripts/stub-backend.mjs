#!/usr/bin/env node
/**
 * 실서버 시연(/wanted-test)을 로컬에서 끝까지 돌려 보는 가짜 백엔드.
 *
 * docs/api-contract.md 모양대로 응답하고 Supabase Auth 의 비밀번호 로그인도 흉내 낸다. 조각을 받으면
 * 몇 초 뒤 'AI 분석'을 끝내고 위험 이벤트를 만들어 실시간 채널(SSE)로 알린다 — PC 경고 → 휴대폰에서
 * '확인했어요' → PC 경고가 닫히는 흐름을 도커·Supabase·AI 워커 없이 볼 수 있다.
 * 응답 모양은 진짜 백엔드(scene-stealer-back backend/app/routers)와 같게 둔다 — 예를 들어 상태 변경은
 * 목록 모양만 돌려준다. 여기서 편하게 주면 화면이 그걸 믿다가 실서버에서 깨진다.
 *
 * 쓰는 법 (저장소 루트):
 *
 *   LIVE_API_URL=http://localhost:8787 LIVE_SUPABASE_URL=http://localhost:8787 LIVE_SUPABASE_ANON_KEY=local \
 *   LIVE_EMAIL=demo@scene.test LIVE_PASSWORD=pw LIVE_DEVICE_TOKEN=ss_dev_demo LIVE_STORE_ID=store-demo \
 *   npm run build -w @scene-stealer/demo-web
 *   node apps/demo-web/scripts/stub-backend.mjs          # :8787
 *   npm run preview -w @scene-stealer/demo-web           # http://localhost:4173/wanted-test/
 *
 * 휴대폰 화면은 같은 주소를 휴대폰 크기 창(개발자 도구의 기기 흉내)으로 열면 /wanted-test/m/ 으로 넘어간다.
 *
 * 환경변수: PORT(8787) · EVENT_ON_SEGMENT(1 — 몇 번째 조각에서 위험을 만들지) ·
 * CLIP_URL(경고 클립 주소 — 비우면 구운 시연 영상의 첫 조각).
 */
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = Number(process.env.PORT ?? 8787)
const EMAIL = 'demo@scene.test'
const PASSWORD = 'pw'
const DEVICE_TOKEN = 'ss_dev_demo'
const STORE_ID = 'store-demo'
const EVENT_ON_SEGMENT = Number(process.env.EVENT_ON_SEGMENT ?? 1)

/** 경고 클립 — 구운 시연 영상의 첫 조각을 미리보기 서버(4173)에서 튼다. */
const clipUrl = () => {
  if (process.env.CLIP_URL) return process.env.CLIP_URL
  const manifestPath = resolve(dirname(fileURLToPath(import.meta.url)), '../dist/wanted-test/demo-video/manifest.json')
  if (!existsSync(manifestPath)) return null
  const file = JSON.parse(readFileSync(manifestPath, 'utf8')).videos?.[0]?.segments?.[0]?.file
  return file ? `http://localhost:4173/wanted-test/demo-video/${file}` : null
}
const CLIP_URL = clipUrl()

const log = (...args) => console.log(new Date().toISOString().slice(11, 19), ...args)

const store = {
  id: STORE_ID, name: '데모 매장', address: '서울시 강남구', opensAt: null, closesAt: null,
  segmentSeconds: 60, clipRetentionDays: 7,
  device: { id: 'dev-1', deviceId: 'pc-demo', label: '데모 PC', agentVersion: null, online: false, lastHeartbeatAt: null, spoolBytes: null, uploadedBytesToday: null },
}
const cameras = new Map()
const videos = []
const events = []
const streams = new Set()
let tokenCount = 0
let segmentCount = 0

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(body === undefined ? '' : JSON.stringify(body))
}
const cors = (req, res) => {
  res.setHeader('access-control-allow-origin', req.headers.origin ?? '*')
  res.setHeader('access-control-allow-headers', 'authorization, content-type, idempotency-key, apikey, accept')
  res.setHeader('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('access-control-max-age', '600')
}
const readBody = (req) => new Promise((done) => {
  const chunks = []
  req.on('data', (chunk) => chunks.push(chunk))
  req.on('end', () => done(Buffer.concat(chunks)))
})
const readJson = async (req) => JSON.parse((await readBody(req)).toString() || '{}')
const publish = (type, data) => {
  const frame = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  streams.forEach((res) => res.write(frame))
}
const unconfirmedCount = () => events.filter((event) => event.state === 'unconfirmed').length
const storeDto = () => ({ ...store, cameraCount: cameras.size, unconfirmedCount: unconfirmedCount() })
const cameraDto = (camera) => ({ ...camera, disconnectedForSec: null })

createServer(async (req, res) => {
  cors(req, res)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname
  const auth = req.headers.authorization ?? ''

  // ------------------------------------------------------------ Supabase Auth (비밀번호 로그인)
  if (path === '/auth/v1/token' && req.method === 'POST') {
    const body = await readJson(req)
    if (url.searchParams.get('grant_type') !== 'password') return send(res, 400, { msg: 'unsupported grant' })
    if (body.email !== EMAIL || body.password !== PASSWORD) {
      return send(res, 400, { code: 'invalid_credentials', msg: 'Invalid login credentials' })
    }
    tokenCount += 1
    log('AUTH 로그인 →', `user-token-${tokenCount}`)
    return send(res, 200, {
      access_token: `user-token-${tokenCount}`, refresh_token: `r-${tokenCount}`, expires_in: 3600, token_type: 'bearer',
      user: { id: 'user-demo', email: EMAIL, phone: '' },
    })
  }

  // ------------------------------------------------------------ 기기 토큰 경로 (ingest)
  if (path === '/v1/segments' && req.method === 'POST') {
    if (auth !== `Bearer ${DEVICE_TOKEN}`) return send(res, 401, { error: '유효하지 않은 토큰입니다' })
    const raw = await readBody(req)
    const form = await new Request('http://x/', { method: 'POST', headers: { 'content-type': req.headers['content-type'] }, body: raw }).formData()
    const meta = JSON.parse(await form.get('meta').text())
    const video = form.get('video')
    if (req.headers['idempotency-key'] !== meta.segmentId) return send(res, 400, { error: 'Idempotency-Key 가 meta.segmentId 와 다릅니다' })
    if (meta.storeId !== STORE_ID) return send(res, 403, { error: 'storeId 가 토큰에 등록된 매장과 다릅니다' })
    segmentCount += 1
    const n = segmentCount
    log(`조각 #${n} ${meta.camera.name} ${meta.startedAt}→${meta.endedAt} ${meta.video.durationMs}ms ${video.size}B ${meta.video.width}x${meta.video.height}@${meta.video.fps}`)
    const row = {
      id: `vid-${n}`, userId: 'user-demo', storeId: meta.storeId, cameraLocation: meta.camera.name, status: 'uploaded', progress: 0,
      recordedStartedAt: meta.startedAt, recordedEndedAt: meta.endedAt, durationSec: meta.video.durationMs / 1000, anomalyCount: 0,
    }
    videos.unshift(row)
    const camera = cameras.get(meta.camera.id)
    if (camera) camera.lastSegmentAt = meta.endedAt
    setTimeout(() => Object.assign(row, { status: 'processing', progress: 35 }), 2500)
    setTimeout(() => Object.assign(row, { progress: 80 }), 5000)
    setTimeout(() => {
      Object.assign(row, { status: 'done', progress: 100 })
      if (n !== EVENT_ON_SEGMENT) return
      row.anomalyCount = 1
      const event = {
        id: `ev-${n}`, storeId: STORE_ID, cameraId: camera?.id ?? 'cam-x', cameraName: meta.camera.name, locationTag: null,
        risk: 'high', state: 'unconfirmed',
        startedAt: new Date(Date.parse(meta.startedAt) + 12_000).toISOString(),
        endedAt: new Date(Date.parse(meta.startedAt) + 19_000).toISOString(),
        durationSec: 7, thumbnailUrl: null, createdAt: new Date().toISOString(),
      }
      events.unshift(event)
      log('AI → 위험 이벤트', event.id, '· SSE', streams.size)
      publish('event.created', event)
    }, 7500)
    return send(res, 201, { segmentId: meta.segmentId, received: true, analysis: 'pending' })
  }
  if (path === '/v1/devices/heartbeat' && req.method === 'POST') {
    if (auth !== `Bearer ${DEVICE_TOKEN}`) return send(res, 401, { error: '유효하지 않은 토큰입니다' })
    const body = await readJson(req)
    store.device = { ...store.device, online: true, lastHeartbeatAt: new Date().toISOString(), agentVersion: body.agentVersion ?? null }
    ;(body.cameras ?? []).forEach((reported) => {
      const camera = cameras.get(reported.agentCameraId)
      if (camera) Object.assign(camera, { state: reported.state, lastFrameAt: reported.lastFrameAt })
    })
    return send(res, 200, { ok: true, serverTime: new Date().toISOString(), segmentSeconds: store.segmentSeconds })
  }

  // ------------------------------------------------------------ 사용자 토큰 경로
  if (!auth.startsWith('Bearer user-token-')) return send(res, 401, { error: '로그인이 필요합니다' })

  if (path === '/stores' && req.method === 'GET') return send(res, 200, { stores: [storeDto()] })
  if (path === `/stores/${STORE_ID}` && req.method === 'PATCH') {
    const body = await readJson(req)
    if (body.segmentSeconds !== undefined) store.segmentSeconds = body.segmentSeconds
    return send(res, 200, storeDto())
  }
  if (path === `/stores/${STORE_ID}/cameras` && req.method === 'POST') {
    const body = await readJson(req)
    const existing = cameras.get(body.agentCameraId)
    const camera = existing ?? {
      id: `cam-${cameras.size + 1}`, storeId: STORE_ID, agentCameraId: body.agentCameraId, name: body.name,
      locationTag: body.locationTag ?? null, sortOrder: body.sortOrder ?? 0, streamProfile: body.streamProfile ?? null,
      state: 'unknown', lastFrameAt: null, lastSegmentAt: null,
    }
    cameras.set(body.agentCameraId, camera)
    log('카메라 등록', body.name, existing ? '(있던 것)' : '(새로)')
    return send(res, existing ? 200 : 201, { id: camera.id })
  }
  if (path === `/stores/${STORE_ID}/cameras` && req.method === 'GET') return send(res, 200, { cameras: [...cameras.values()] })
  const cameraMatch = path.match(/^\/cameras\/([^/]+)$/)
  if (cameraMatch && req.method === 'DELETE') {
    const found = [...cameras.entries()].find(([, camera]) => camera.id === cameraMatch[1])
    if (found) cameras.delete(found[0])
    return send(res, found ? 204 : 404, found ? undefined : { error: '카메라가 없습니다' })
  }
  if (path === `/stores/${STORE_ID}/monitoring`) {
    const list = [...cameras.values()].map(cameraDto)
    return send(res, 200, {
      device: { online: store.device.online, lastHeartbeatAt: store.device.lastHeartbeatAt, agentVersion: store.device.agentVersion, spoolBytes: 0, uploadedBytesToday: 0 },
      segmentSeconds: store.segmentSeconds,
      cameras: list,
      lastAnalyzedAt: videos.find((video) => video.status === 'done')?.recordedEndedAt ?? null,
      monitoringCount: list.filter((camera) => camera.state === 'connected').length,
      totalCount: list.length,
    })
  }
  if (path === `/stores/${STORE_ID}/events/unconfirmed-count`) return send(res, 200, { count: unconfirmedCount() })
  if (path === `/stores/${STORE_ID}/events/timeline`) {
    return send(res, 200, { date: url.searchParams.get('date'), windowStart: new Date().toISOString(), windowEnd: new Date().toISOString(), cameras: [] })
  }
  if (path === `/stores/${STORE_ID}/events/summary`) {
    const falsePositive = events.filter((event) => event.state === 'false_positive').length
    return send(res, 200, { from: null, to: null, total: events.length, falsePositive, reported: 0, byWeekday: [], byHour: [] })
  }
  if (path === `/stores/${STORE_ID}/segments`) return send(res, 200, { items: [], nextCursor: null })
  if (path === `/stores/${STORE_ID}/events`) return send(res, 200, { items: events, nextCursor: null })
  if (path === `/stores/${STORE_ID}/notification-settings`) {
    // 새 매장처럼 수면 구간은 비어 있다 (백엔드 routers/notifications.py 의 기본값).
    return send(res, 200, { minRisk: 'low', quietHours: { businessHoursHighOnly: true, sleepStart: null, sleepEnd: null, sleepHighOnly: true, overrideDndForHigh: true } })
  }
  if (path === `/stores/${STORE_ID}/stream`) {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    res.write(`event: ready\ndata: ${JSON.stringify({ storeId: STORE_ID })}\n\n`)
    streams.add(res)
    const ping = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 15_000)
    req.on('close', () => {
      clearInterval(ping)
      streams.delete(res)
    })
    return
  }
  const eventMatch = path.match(/^\/events\/([^/]+)(\/state|\/clip|\/nearby-cameras|\/memo)?$/)
  if (eventMatch) {
    const event = events.find((candidate) => candidate.id === eventMatch[1])
    if (!event) return send(res, 404, { error: '이벤트가 없습니다' })
    const sub = eventMatch[2]
    if (sub === '/state' && req.method === 'PATCH') {
      const body = await readJson(req)
      event.state = body.state
      log('이벤트 상태 →', event.id, body.state, `(${body.source})`)
      publish('event.updated', event)
      // 진짜 백엔드처럼 목록 모양만 돌려준다 (점수·클립·조각 없음).
      return send(res, 200, { event: { ...event } })
    }
    if (sub === '/clip') {
      return CLIP_URL ? send(res, 200, { url: CLIP_URL, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }) : send(res, 404, { error: '클립이 없습니다' })
    }
    if (sub === '/nearby-cameras') return send(res, 200, { cameras: [] })
    return send(res, 200, {
      event: {
        ...event, anomalyScore: 0.9, anomalyThreshold: 0.5, memo: null, falsePositiveReason: null,
        clipUrl: CLIP_URL, clipExpiresAt: null, segments: [], history: [],
      },
    })
  }
  if (path === '/videos') return send(res, 200, { videos: videos.slice(0, Number(url.searchParams.get('limit') ?? 20)) })
  if (path === '/push/devices' && req.method === 'POST') {
    const body = await readJson(req)
    // 실제 백엔드처럼 ios / android 만 받는다.
    if (!['ios', 'android'].includes(body.platform)) return send(res, 400, { error: 'platform 은 ios / android 중 하나여야 합니다' })
    return send(res, 201, { id: 'pd-1', platform: body.platform })
  }
  log('404', req.method, path)
  return send(res, 404, { error: 'not found' })
}).listen(PORT, () => log(`가짜 백엔드 :${PORT} · 클립 ${CLIP_URL ?? '(없음 — 먼저 굽기)'}`))
