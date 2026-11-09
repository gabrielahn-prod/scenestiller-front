/**
 * 화면에 나가는 한글 이름. 카피는 design/씬스틸러 PC 앱.dc.html 그대로다.
 * 디자인에 샘플이 없는 조합은 같은 화면의 다른 자리에서 가져왔다.
 */
import type { StatusTone, TagTone } from '../components/ui'
import type { CameraRuntimeState, EventState, LocationTag, RiskLevel } from '../../shared/server-types'

/**
 * 위험 이벤트의 이름. 디자인의 '절도 의심' 자리(2c 피드, 2d 제목, 2e 표, 2f 제목)에 들어간다.
 * 위험 종류는 나누지 않기로 해서(AI 는 평소와 다른 움직임만 잡는다) 이름은 하나다.
 */
export const EVENT_TITLE = '이상 행동'

export const RISK_LABEL: Record<RiskLevel, string> = { high: '높음', medium: '보통', low: '낮음' }
export const RISK_TONE: Record<RiskLevel, TagTone> = { high: 'high', medium: 'medium', low: 'low' }

export const STATE_LABEL: Record<EventState, string> = {
  unconfirmed: '미확인',
  confirmed: '확인됨',
  false_positive: '오탐',
}
export const STATE_TONE: Record<EventState, TagTone> = {
  unconfirmed: 'unconfirmed',
  confirmed: 'confirmed',
  false_positive: 'false-positive',
}

/** 2b ③ 위치 태그 — 카메라가 어디를 비추는지 화면에 보이는 구분. */
export const LOCATION_LABEL: Record<LocationTag, string> = {
  checkout: '계산대',
  entrance: '출입문',
  shelf: '진열대',
  dining: '취식대',
  storage: '창고',
  other: '기타',
}
export const LOCATION_ORDER: readonly LocationTag[] = [
  'checkout',
  'entrance',
  'shelf',
  'dining',
  'storage',
  'other',
]

export const CAMERA_STATE_LABEL: Record<CameraRuntimeState, string> = {
  connected: '연결됨',
  reconnecting: '재연결 중',
  disconnected: '끊김',
  auth_failed: '인증 실패',
  unknown: '중지',
}
export const CAMERA_STATE_TONE: Record<CameraRuntimeState, StatusTone> = {
  connected: 'connected',
  reconnecting: 'reconnecting',
  disconnected: 'disconnected',
  auth_failed: 'disconnected',
  unknown: 'idle',
}

/** 2b ③ '알림 빠르기' — UI 에서는 '조각 길이'라고 부르지 않는다. */
export const SPEED_OPTIONS: readonly { value: 30 | 60 | 300; label: string }[] = [
  { value: 30, label: '30초' },
  { value: 60, label: '1분' },
  { value: 300, label: '5분' },
]
