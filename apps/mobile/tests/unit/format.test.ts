import { describe, expect, it } from 'vitest'
import {
  EVENT_NAME, cameraStateLabel, clockOf, dateHeading, durationLabel,
  elapsedLabel, localDate, phoneLabel, riskLabel, sinceLabel, stateLabel, timeOf, whenLabel,
} from '../../src/lib/format'

const at = (y: number, m: number, d: number, h: number, min: number, s = 0) =>
  new Date(y, m - 1, d, h, min, s).toISOString()

describe('이름과 라벨', () => {
  it('이벤트 이름은 하나뿐이다 — 위험 종류를 나누지 않는다', () => {
    expect(EVENT_NAME).toBe('이상 행동')
  })

  it('위험도·상태·카메라 상태를 한국어로 옮긴다', () => {
    expect(riskLabel.high).toBe('높음')
    expect(stateLabel.false_positive).toBe('오탐')
    expect(cameraStateLabel.auth_failed).toBe('인증 실패')
  })
})

describe('시각', () => {
  it('분까지 / 초까지 두 가지 모양을 준다', () => {
    const iso = at(2026, 9, 11, 14, 32, 10)
    expect(timeOf(iso)).toBe('14:32')
    expect(clockOf(iso)).toBe('14:32:10')
  })

  it('자정 전후에도 0 을 채운다', () => {
    expect(timeOf(at(2026, 9, 11, 2, 5))).toBe('02:05')
  })

  it('날짜 키는 UTC 가 아니라 기기의 날짜다', () => {
    // 한국이면 09-11 23:30 이 UTC 로는 09-11 14:30 — 어느 쪽이든 '그 날'이어야 한다.
    expect(localDate(at(2026, 9, 11, 23, 30))).toBe('2026-09-11')
  })
})

describe('dateHeading', () => {
  it('오늘과 어제에는 말머리를 붙인다', () => {
    const now = new Date()
    const yesterday = new Date(now.getTime() - 86_400_000)
    expect(dateHeading(now.toISOString()).startsWith('오늘 · ')).toBe(true)
    expect(dateHeading(yesterday.toISOString()).startsWith('어제 · ')).toBe(true)
  })

  it('그 전 날짜는 요일까지 적는다', () => {
    // 2026-09-11 은 금요일.
    expect(dateHeading(at(2026, 9, 11, 9, 0))).toContain('9월 11일 (금)')
  })

  it('오래된 날짜에는 말머리가 없다', () => {
    const old = new Date(Date.now() - 10 * 86_400_000)
    expect(dateHeading(old.toISOString())).not.toContain('·')
  })
})

describe('길이와 경과', () => {
  it('1분 미만은 초로, 넘으면 분·초로 적는다', () => {
    expect(durationLabel(31)).toBe('31초')
    expect(durationLabel(95)).toBe('1분 35초')
  })

  it('경과는 가장 큰 단위 하나만 쓴다', () => {
    expect(elapsedLabel(42)).toBe('42초')
    expect(elapsedLabel(13 * 60)).toBe('13분')
    expect(elapsedLabel(2 * 3600 + 59 * 60)).toBe('2시간')
  })

  it('마지막 시각이 없으면 "없음" — 0분 전이라고 하지 않는다', () => {
    expect(sinceLabel(null)).toBe('없음')
  })

  it('기준 시각을 넣으면 그 시점 기준으로 센다', () => {
    const now = new Date(2026, 8, 11, 14, 33, 0)
    expect(sinceLabel(at(2026, 9, 11, 14, 20, 0), now)).toBe('13분 전')
  })
})

describe('whenLabel', () => {
  it('오늘이면 날짜를 반복하지 않는다', () => {
    const now = new Date()
    now.setHours(14, 32, 10, 0)
    expect(whenLabel(now.toISOString())).toBe('오늘 14:32:10')
  })

  it('어제도 마찬가지', () => {
    const y = new Date(Date.now() - 86_400_000)
    y.setHours(2, 10, 0, 0)
    expect(whenLabel(y.toISOString())).toBe('어제 02:10:00')
  })

  it('그 전이면 날짜를 붙인다', () => {
    const old = new Date(Date.now() - 5 * 86_400_000)
    old.setHours(9, 12, 0, 0)
    expect(whenLabel(old.toISOString())).toMatch(/^\d+월 \d+일 \(.\) 09:12:00$/)
  })
})

describe('phoneLabel', () => {
  it('국가번호가 붙은 번호를 010-1234-5678 모양으로', () => {
    expect(phoneLabel('+821012345678')).toBe('010-1234-5678')
    expect(phoneLabel('01012345678')).toBe('010-1234-5678')
    expect(phoneLabel('+82111234567')).toBe('011-123-4567')
  })

  it('번호가 아니면 그대로 — 번호 없는 데모 계정은 이메일이 들어 있다', () => {
    expect(phoneLabel('store-test@scene.test')).toBe('store-test@scene.test')
    expect(phoneLabel('+8210123')).toBe('+8210123')
  })
})
