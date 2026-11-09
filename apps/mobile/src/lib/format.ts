import type { CameraState, EventState, Risk } from '@scene-stealer/api'

/** 이벤트 이름은 하나뿐이다 — 위험 종류를 나누지 않기로 했다. */
export const EVENT_NAME = '이상 행동'

export const riskLabel: Record<Risk, string> = { high: '높음', medium: '보통', low: '낮음' }
export const stateLabel: Record<EventState, string> = {
  unconfirmed: '미확인',
  confirmed: '확인됨',
  false_positive: '오탐',
}
export const cameraStateLabel: Record<CameraState, string> = {
  // PC 가 감시를 멈췄거나 아직 보고가 없다. PC 화면의 타일도 '중지'로 보인다.
  unknown: '중지',
  connected: '연결됨',
  reconnecting: '재연결 중',
  disconnected: '끊김',
  auth_failed: '인증 실패',
}

const pad = (n: number) => String(n).padStart(2, '0')

export const timeOf = (iso: string): string => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export const clockOf = (iso: string): string => {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export const localDate = (iso: string): string => {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 기록 화면의 날짜 머리글: "오늘 · 9월 11일 (목)" */
export const dateHeading = (iso: string): string => {
  const d = new Date(iso)
  const today = new Date()
  const diffDays = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
      new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) /
      86_400_000,
  )
  const prefix = diffDays === 0 ? '오늘' : diffDays === -1 ? '어제' : null
  const label = `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
  return prefix ? `${prefix} · ${label}` : label
}

/** 상세 화면의 "오늘 14:32:10" — 오늘·어제면 날짜를 반복하지 않는다. */
export const whenLabel = (iso: string): string => {
  const heading = dateHeading(iso)
  const [prefix] = heading.split(' · ')
  return `${prefix === '오늘' || prefix === '어제' ? prefix : heading} ${clockOf(iso)}`
}

export const durationLabel = (seconds: number): string =>
  seconds < 60 ? `${seconds}초` : `${Math.floor(seconds / 60)}분 ${seconds % 60}초`

/** "13분", "2시간" — 끊김·마지막 분석처럼 '얼마나 지났나'를 말할 때. */
export const elapsedLabel = (seconds: number): string => {
  if (seconds < 60) return `${Math.max(0, Math.round(seconds))}초`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`
  return `${Math.floor(seconds / 3600)}시간`
}

/**
 * 계정의 휴대폰 번호를 읽기 좋게 — "+821012345678" → "010-1234-5678".
 * 로그인 서버는 국가번호를 붙인 모양으로 준다. 번호가 아닌 값(번호 없는 계정의 이메일)은 그대로 둔다.
 */
export const phoneLabel = (value: string): string => {
  if (!/^\+?[\d\s-]+$/.test(value)) return value
  const local = value.replace(/^\+82/, '0').replace(/\D/g, '')
  if (local.length === 11) return `${local.slice(0, 3)}-${local.slice(3, 7)}-${local.slice(7)}`
  if (local.length === 10) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`
  return value
}

export const sinceLabel = (iso: string | null, now: Date = new Date()): string => {
  if (!iso) return '없음'
  return `${elapsedLabel((now.getTime() - Date.parse(iso)) / 1000)} 전`
}
