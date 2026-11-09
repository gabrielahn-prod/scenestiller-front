#!/usr/bin/env node
/**
 * 실제 푸시 한 발 보내기.
 *
 * 서버가 아직 없으므로 Expo 푸시 API 를 직접 두드린다. 백엔드가 생기면 같은 본문을
 * 서버에서 보내면 된다 — 앱이 보는 모양(`data.eventId`)은 똑같다.
 *
 *   node tools/send-push.mjs 'ExponentPushToken[...]' [eventId]
 *
 * 토큰은 앱 설정 화면의 '테스트 알림 보내기' 위에 뜨는 값이고,
 * 실기기에서만 발급된다 (시뮬레이터·웹은 발급되지 않는다).
 */
const [token, eventId = 'ev-1'] = process.argv.slice(2)

if (!token?.startsWith('ExponentPushToken[')) {
  console.error('사용법: node tools/send-push.mjs \'ExponentPushToken[...]\' [eventId]')
  process.exit(1)
}

const message = {
  to: token,
  title: '강남 1호점 · 계산대',
  body: '이상 행동이 감지되었습니다 · 위험도 높음',
  sound: 'default',
  priority: 'high',
  channelId: 'risk',
  // 앱은 이 eventId 만 보고 상세 화면으로 이동한다.
  data: { eventId, storeId: 'store-gangnam' },
}

const response = await fetch('https://exp.host/--/api/v2/push/send', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json' },
  body: JSON.stringify(message),
})

const body = await response.json()
const ticket = body?.data

if (!response.ok || ticket?.status === 'error') {
  console.error('보내지 못했습니다:', JSON.stringify(body, null, 2))
  process.exit(1)
}

console.log('보냈습니다. 티켓:', JSON.stringify(ticket))
console.log('알림을 탭하면 앱이 /events/%s 로 열려야 합니다.', eventId)
