import { describe, expect, it } from 'vitest'
import { buildPoliceReport } from '../../src/renderer/lib/police-report'

const base = {
  storeName: '강남 1호점',
  address: '서울 강남구 테헤란로 123 1층',
  cameraName: '계산대',
  riskLabel: '높음',
  startedAt: '2026-09-16T05:32:10.000Z',
  endedAt: '2026-09-16T05:32:41.000Z',
  timeZone: 'Asia/Seoul',
}

describe('buildPoliceReport', () => {
  it('주소·시각·CCTV 위치를 한 장에 담는다', () => {
    const text = buildPoliceReport(base)
    expect(text).toContain('서울 강남구 테헤란로 123 1층')
    expect(text).toContain('2026년 9월 16일')
    expect(text).toContain('오후 2시 32분')
    expect(text).toContain('이상 행동 감지 (위험도 높음)')
    expect(text).toContain('계산대')
  })

  it('AI 가 감지한 의심이라는 걸 밝힌다 — 단정해서 신고하면 안 된다', () => {
    expect(buildPoliceReport(base)).toMatch(/AI.*의심|확인 필요/)
  })

  it('AI 가 판정하지 않는 것(무슨 일인지, 인상착의)은 쓰지 않는다', () => {
    const text = buildPoliceReport(base)
    expect(text).not.toContain('인상착의')
    expect(text).not.toContain('절도')
  })

  it('주소가 없으면 비워 두지 않고 매장 설정에서 넣으라고 알린다', () => {
    const text = buildPoliceReport({ ...base, address: null })
    expect(text).toContain('주소')
    expect(text).toContain('설정')
  })

  it('매장 시간대로 적는다 — UTC 로 적으면 경찰이 9시간 틀린 시각을 받는다', () => {
    expect(buildPoliceReport(base)).not.toContain('오전 5시')
  })
})
