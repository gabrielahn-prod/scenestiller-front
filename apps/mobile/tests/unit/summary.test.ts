import { describe, expect, it } from 'vitest'
import type { EventListItem } from '@scene-stealer/api'
import { repeatLine, summaryLine, weeklySummary } from '../../src/lib/summary'

const NOW = new Date(2026, 8, 11, 12, 0, 0)
const daysAgo = (days: number, hour: number): string =>
  new Date(NOW.getTime() - days * 86_400_000 - (12 - hour) * 3_600_000).toISOString()

const event = (id: string, startedAt: string, state: EventListItem['state'] = 'unconfirmed'): EventListItem => ({
  id, cameraId: 'cam_1', cameraName: '계산대', locationTag: null,
  risk: 'high', state, startedAt, endedAt: startedAt, durationSec: 31,
  thumbnailUrl: null, createdAt: startedAt,
})

describe('주간 요약', () => {
  it('오탐은 위험 건수에서 뺀다', () => {
    const s = weeklySummary(
      [event('a', daysAgo(1, 9)), event('b', daysAgo(2, 9), 'false_positive'), event('c', daysAgo(3, 9), 'confirmed')],
      NOW,
    )
    expect(s).toMatchObject({ risky: 2, falsePositive: 1 })
    expect(summaryLine(s)).toBe('이번 주 요약 · 위험 2건 · 오탐 1건')
  })

  it('7일보다 오래된 건 세지 않는다', () => {
    const s = weeklySummary([event('a', daysAgo(1, 9)), event('old', daysAgo(9, 9))], NOW)
    expect(s.risky).toBe(1)
  })

  it('같은 시간대가 3건 이상일 때만 패턴을 말한다', () => {
    const two = weeklySummary([event('a', daysAgo(1, 1)), event('b', daysAgo(2, 1))], NOW)
    expect(two.repeatedHour).toBeNull()
    expect(repeatLine(two)).toBeNull()

    const three = weeklySummary(
      [event('a', daysAgo(1, 1)), event('b', daysAgo(2, 1)), event('c', daysAgo(3, 1))],
      NOW,
    )
    expect(three.repeatedHour).toBe(1)
    // 2026-09-11 은 금요일 — 1·2·3일 전은 목 · 수 · 화. 요일은 월요일부터 적는다.
    expect(three.repeatedDays).toEqual([2, 3, 4])
    expect(repeatLine(three)).toBe('주로 화, 수, 목 새벽 1시대에 반복됨')
  })

  it('기록이 없으면 0건 — 없는 숫자를 지어내지 않는다', () => {
    const s = weeklySummary([], NOW)
    expect(summaryLine(s)).toBe('이번 주 요약 · 위험 0건 · 오탐 0건')
    expect(repeatLine(s)).toBeNull()
  })
})
