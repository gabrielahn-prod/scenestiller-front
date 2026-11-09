/**
 * 화면 시각 표기. 전부 매장 벽시계(PC 의 현지 시각) 기준이다 — 사장님에게
 * '오늘'은 UTC 하루가 아니다. 새벽 2시 노숙 이벤트가 전날로 넘어가면 안 된다.
 */

const pad = (value: number): string => String(value).padStart(2, '0')
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

/** 2026-09-16 (현지 날짜) */
export const localDateKey = (date: Date = new Date()): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** 현지 하루의 [시작, 끝) 을 UTC ISO 로. 서버 from/to 에 그대로 넣는다. */
export const localDayRange = (dateKey: string): { readonly from: string; readonly to: string } => {
  const [year, month, day] = dateKey.split('-').map(Number)
  const start = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { from: start.toISOString(), to: end.toISOString() }
}

export const shiftDateKey = (dateKey: string, days: number): string => {
  const { from } = localDayRange(dateKey)
  const date = new Date(from)
  date.setDate(date.getDate() + days)
  return localDateKey(date)
}

/** 14:32 */
export const formatClock = (iso: string): string => {
  const date = new Date(iso)
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 14:32:10 */
export const formatClockSeconds = (iso: string): string => {
  const date = new Date(iso)
  return `${formatClock(iso)}:${pad(date.getSeconds())}`
}

/** 2026. 09. 16 (수) — 2e 날짜 넘기기 */
export const formatDateHeader = (dateKey: string): string => {
  const date = new Date(localDayRange(dateKey).from)
  return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())} (${WEEKDAY[date.getDay()]})`
}

/** 09.16 14:32:10 — 2e 미리보기 */
export const formatShortDateTime = (iso: string): string => {
  const date = new Date(iso)
  return `${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${formatClockSeconds(iso)}`
}

/** 2026. 09. 16 14:32:10 — 2f 제목 */
export const formatFullDateTime = (iso: string): string => {
  const date = new Date(iso)
  return `${date.getFullYear()}. ${pad(date.getMonth() + 1)}. ${pad(date.getDate())} ${formatClockSeconds(iso)}`
}

/** 2026-09-16 14:31:52 — 2f 플레이어 라벨 (CCTV 화면 표기 관례) */
export const formatStamp = (iso: string): string => `${localDateKey(new Date(iso))} ${formatClockSeconds(iso)}`

/** 11분 · 2시간 · 3일 — '끊김 11분', 'PC 꺼짐 2시간' */
export const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))}초`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}분`
  if (seconds < 86_400) return `${Math.floor(seconds / 3600)}시간`
  return `${Math.floor(seconds / 86_400)}일`
}

/** 방금 · 3분 전 · 2시간 전 */
export const formatAgo = (iso: string | null, now: number = Date.now()): string | null => {
  if (!iso) return null
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000)
  if (seconds < 60) return '방금'
  return `${formatDuration(seconds)} 전`
}

export const isToday = (iso: string): boolean => localDateKey(new Date(iso)) === localDateKey()
