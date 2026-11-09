/* 씬스틸러 데모 — 웹 푸시 서비스워커.
 *
 * 이 파일이 있어야 폰이 잠겨 있어도 알림이 온다. 페이지 안의 setTimeout 은
 * 화면이 꺼지는 순간 안드로이드 크롬이 얼려 버리지만, 서비스워커는 푸시가 도착하면
 * 브라우저가 깨워 주기 때문이다.
 */

/**
 * 앱이 어느 경로에 올라가 있는지 자기 위치에서 알아낸다.
 * GitHub Pages 는 /cctv-agent-electron/m/, Vercel 은 /m/ 처럼 호스팅마다 다르다 —
 * 빌드 때 심어 넣으면 호스팅을 바꿀 때마다 여기가 조용히 틀린다.
 */
const BASE = new URL('./', self.location.href).pathname

self.addEventListener('install', (event) => {
  // 새 버전을 깔면 기다리지 않고 바로 넘겨받는다 — 데모 중에 구버전이 남으면 곤란하다.
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  const payload = (() => {
    try {
      return event.data ? event.data.json() : {}
    } catch {
      // 본문이 JSON 이 아니면 통째로 본문 텍스트로 쓴다.
      return { body: event.data ? event.data.text() : '' }
    }
  })()

  const title = payload.title || '위험 감지'
  const options = {
    body: payload.body || '',
    // 아이콘이 없으면 안드로이드가 크롬 로고를 쓴다. 우리 앱처럼 보이게 한다.
    icon: `${BASE}icon.png`,
    badge: `${BASE}badge.png`,
    tag: payload.data && payload.data.eventId ? `event-${payload.data.eventId}` : 'scene-stealer',
    renotify: true,
    requireInteraction: true,
    vibrate: [0, 250, 250, 250],
    data: payload.data || {},
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // 경로가 아니라 쿼리로 넘긴다. 정적 호스팅에는 /events/ev-1 을 받아 줄 서버가 없다.
  const eventId = (event.notification.data && event.notification.data.eventId) || ''
  const target = eventId ? `${BASE}?event=${encodeURIComponent(eventId)}` : BASE

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.includes(BASE))
      if (open) {
        // 이미 열려 있으면 새 탭을 만들지 않고 그 탭에게 어디로 갈지 알려 준다.
        open.postMessage({ type: 'notification-click', eventId })
        return open.focus()
      }
      return self.clients.openWindow(target)
    }),
  )
})
