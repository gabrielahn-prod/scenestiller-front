import type { EventListItem } from '@scene-stealer/api'

export interface WeeklySummary {
  readonly risky: number
  readonly falsePositive: number
  /** 같은 시간대에 3건 이상 몰렸을 때만. 근거 없는 '패턴'은 말하지 않는다. */
  readonly repeatedHour: number | null
  /** 그 시간대 경고가 난 요일 (0 = 일요일, 월요일부터 순서대로). 세 요일 이하로 몰렸을 때만 채운다. */
  readonly repeatedDays: readonly number[]
}

const WEEK_MS = 7 * 86_400_000
/** 한국 달력 순서 — 월요일부터. */
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토']

/**
 * 기록 화면 '이번 주 요약'을 받은 목록으로 센다.
 * 숫자는 서버 요약(getWeeklySummary — 신고 수까지 있다)을 먼저 쓰고, 이건 서버 요약이 없을 때의 위험 · 오탐 수와
 * 서버 요약에 없는 '반복 시간대'를 셀 때 쓴다.
 */
export const weeklySummary = (
  events: readonly EventListItem[],
  now: Date = new Date(),
): WeeklySummary => {
  const since = now.getTime() - WEEK_MS
  const week = events.filter((e) => Date.parse(e.startedAt) >= since)
  const falsePositive = week.filter((e) => e.state === 'false_positive').length

  const byHour = week.reduce<Record<number, number>>((acc, event) => {
    const hour = new Date(event.startedAt).getHours()
    return { ...acc, [hour]: (acc[hour] ?? 0) + 1 }
  }, {})
  const top = Object.entries(byHour).sort(([, a], [, b]) => b - a)[0]
  const repeatedHour = top && top[1] >= 3 ? Number(top[0]) : null
  const days =
    repeatedHour === null
      ? []
      : [...new Set(week.filter((e) => new Date(e.startedAt).getHours() === repeatedHour).map((e) => new Date(e.startedAt).getDay()))]

  return {
    risky: week.length - falsePositive,
    falsePositive,
    repeatedHour,
    repeatedDays: days.length <= 3 ? [...days].sort((a, b) => WEEK_ORDER.indexOf(a) - WEEK_ORDER.indexOf(b)) : [],
  }
}

/** "위험 12건 · 오탐 3건" — 요약 카드는 앞에 굵은 '이번 주 요약'을 붙인다. */
export const summaryCounts = (s: WeeklySummary): string => `위험 ${s.risky}건 · 오탐 ${s.falsePositive}건`

export const summaryLine = (s: WeeklySummary): string => `이번 주 요약 · ${summaryCounts(s)}`

/** 0–23시를 말로 — "새벽 1시", "오후 3시". 피그마의 '새벽 1시대에 반복됨' 표현을 따른다. */
const hourLabel = (hour: number): string => {
  if (hour === 0) return '밤 12시'
  if (hour < 6) return `새벽 ${hour}시`
  if (hour < 12) return `오전 ${hour}시`
  if (hour === 12) return '낮 12시'
  if (hour < 18) return `오후 ${hour - 12}시`
  if (hour < 21) return `저녁 ${hour - 12}시`
  return `밤 ${hour - 12}시`
}

/** 피그마 '이번 주 요약' 아래 한 줄 — "주로 화, 목 새벽 1시대에 반복됨". 요일이 넓게 퍼졌으면 시간대만 말한다. */
export const repeatLine = (s: WeeklySummary): string | null => {
  if (s.repeatedHour === null) return null
  const days = s.repeatedDays.map((day) => WEEKDAY[day]).join(', ')
  return `주로 ${days ? `${days} ` : ''}${hourLabel(s.repeatedHour)}대에 반복됨`
}
