import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * public/sw.js 는 번들러를 거치지 않고 그대로 배포된다 — import 도 타입체크도 없다.
 * 그래서 여기서 가짜 `self` 위에 실제로 실행해 두 가지를 확인한다.
 *   1. 푸시가 오면 어떤 알림을 띄우는가
 *   2. 그 알림을 탭했을 때 어디로 보내는가
 * 알림 탭은 사용자가 화면을 못 보는 상태에서 일어나는 일이라 조용히 틀리면 안 된다.
 */

type Handler = (event: Record<string, unknown>) => void

interface Notified {
  readonly title: string
  readonly options: Record<string, unknown>
}

const BASE = '/cctv-agent-electron/m/'

const loadWorker = (base: string = BASE) => {
  const handlers = new Map<string, Handler>()
  const notified: Notified[] = []
  const opened: string[] = []
  const messaged: { url: string; payload: unknown }[] = []
  const focused: string[] = []
  const waited: unknown[] = []
  const windows: { url: string }[] = []

  const self = {
    // 서비스워커는 자기 주소에서 앱의 기준 경로를 알아낸다. 그 값을 테스트에서도 준다.
    location: { href: `https://example.com${base}sw.js` },
    addEventListener: (type: string, handler: Handler) => handlers.set(type, handler),
    skipWaiting: () => 'skipped',
    registration: {
      showNotification: (title: string, options: Record<string, unknown>) => {
        notified.push({ title, options })
      },
    },
    clients: {
      claim: () => 'claimed',
      matchAll: async () =>
        windows.map((win) => ({
          url: win.url,
          focus: () => focused.push(win.url),
          postMessage: (payload: unknown) => messaged.push({ url: win.url, payload }),
        })),
      openWindow: async (url: string) => {
        opened.push(url)
      },
    },
  }

  const source = readFileSync(resolve(__dirname, '../../public/sw.js'), 'utf8')
  // 새 컨텍스트에는 Node 전역이 없다. 서비스워커가 실제로 쓰는 것만 넣어 준다.
  runInNewContext(source, { self, URL })

  const fire = async (type: string, event: Record<string, unknown> = {}): Promise<void> => {
    const handler = handlers.get(type)
    if (!handler) throw new Error(`${type} 핸들러가 등록되지 않았습니다`)
    handler({ waitUntil: (value: unknown) => waited.push(value), ...event })
    await Promise.all(waited.filter((value) => value instanceof Promise))
  }

  return { handlers, notified, opened, messaged, focused, windows, fire }
}

describe('서비스워커 — 등록', () => {
  it('푸시와 알림 탭을 모두 듣는다', () => {
    const { handlers } = loadWorker()
    expect([...handlers.keys()].sort()).toEqual(['activate', 'install', 'notificationclick', 'push'])
  })
})

describe('서비스워커 — 푸시 수신', () => {
  it('서버가 보낸 제목·본문·이벤트를 그대로 띄운다', async () => {
    const worker = loadWorker()
    await worker.fire('push', {
      data: { json: () => ({ title: '강남 1호점 · 계산대', body: '이상 행동 감지', data: { eventId: 'ev-1' } }) },
    })

    const [shown] = worker.notified
    expect(shown?.title).toBe('강남 1호점 · 계산대')
    expect(shown?.options.body).toBe('이상 행동 감지')
    expect(shown?.options.data).toEqual({ eventId: 'ev-1' })
  })

  it('잠긴 화면에서도 남아 있도록 requireInteraction 을 켠다', async () => {
    const worker = loadWorker()
    await worker.fire('push', { data: { json: () => ({ title: 'a', body: 'b' }) } })
    expect(worker.notified[0]?.options.requireInteraction).toBe(true)
  })

  it('같은 사건이면 알림을 겹쳐 쌓지 않는다', async () => {
    const worker = loadWorker()
    await worker.fire('push', { data: { json: () => ({ title: 'a', body: 'b', data: { eventId: 'ev-9' } }) } })
    expect(worker.notified[0]?.options.tag).toBe('event-ev-9')
  })

  it('본문이 JSON 이 아니어도 알림은 뜬다 — 조용히 삼키지 않는다', async () => {
    const worker = loadWorker()
    await worker.fire('push', {
      data: {
        json: () => {
          throw new Error('not json')
        },
        text: () => '그냥 텍스트',
      },
    })
    expect(worker.notified[0]?.options.body).toBe('그냥 텍스트')
  })

  it('데이터가 아예 없어도 죽지 않는다', async () => {
    const worker = loadWorker()
    await worker.fire('push', {})
    expect(worker.notified).toHaveLength(1)
  })
})

describe('서비스워커 — 알림 탭', () => {
  const close = () => undefined

  it('앱이 닫혀 있으면 그 사건 상세로 연다', async () => {
    const worker = loadWorker()
    await worker.fire('notificationclick', {
      notification: { close, data: { eventId: 'ev-1' } },
    })
    expect(worker.opened).toEqual([`${BASE}?event=ev-1`])
  })

  it('이미 열려 있으면 새 탭을 만들지 않고 그 탭을 쓴다', async () => {
    const worker = loadWorker()
    worker.windows.push({ url: `https://example.com${BASE}records` })
    await worker.fire('notificationclick', {
      notification: { close, data: { eventId: 'ev-2' } },
    })
    expect(worker.opened).toEqual([])
    expect(worker.messaged).toEqual([
      { url: `https://example.com${BASE}records`, payload: { type: 'notification-click', eventId: 'ev-2' } },
    ])
    expect(worker.focused).toHaveLength(1)
  })

  it('사건 id 가 없으면 홈으로 — 없는 상세로 보내지 않는다', async () => {
    const worker = loadWorker()
    await worker.fire('notificationclick', { notification: { close, data: {} } })
    expect(worker.opened).toEqual([BASE])
  })

  it('id 에 특수문자가 있어도 주소가 깨지지 않는다', async () => {
    const worker = loadWorker()
    await worker.fire('notificationclick', {
      notification: { close, data: { eventId: 'ev/1?x=2' } },
    })
    expect(worker.opened).toEqual([`${BASE}?event=ev%2F1%3Fx%3D2`])
  })
})

describe('서비스워커 — 호스팅 경로', () => {
  const close = () => undefined

  /**
   * 경로를 빌드 때 심어 넣지 않고 자기 주소에서 알아내는 이유가 이것이다.
   * GitHub Pages 는 하위 경로, Vercel 은 루트에서 서빙한다.
   */
  it.each([
    ['/cctv-agent-electron/m/', 'GitHub Pages 하위 경로'],
    ['/m/', 'Vercel 루트'],
    ['/', '앱이 도메인 루트에 있을 때'],
  ])('%s 에 올라가도 그 경로로 연다 (%s)', async (base) => {
    const worker = loadWorker(base)
    await worker.fire('notificationclick', {
      notification: { close, data: { eventId: 'ev-1' } },
    })
    expect(worker.opened).toEqual([`${base}?event=ev-1`])
  })
})
