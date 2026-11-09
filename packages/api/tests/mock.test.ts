import { describe, expect, it } from 'vitest'
import { createMockApi } from '../src/mock'

const api = () => createMockApi({ latencyMs: 0 })

describe('가짜 서버 — 목록 정렬', () => {
  it('미확인이 먼저, 그 안에서 최신순', () => {
    return api().listEvents('store-gangnam').then(({ items }) => {
      const states = items.map((e) => e.state)
      expect(states.slice(0, 2)).toEqual(['unconfirmed', 'unconfirmed'])
      expect(Date.parse(items[0]!.startedAt)).toBeGreaterThan(Date.parse(items[1]!.startedAt))
    })
  })

  it('확인·오탐은 같은 무게로 뒤에 놓되 지우지는 않는다 (AI 개선 근거)', async () => {
    const { items } = await api().listEvents('store-gangnam')
    expect(items.some((e) => e.state === 'false_positive')).toBe(true)
  })
})

describe('가짜 서버 — 필터', () => {
  it('카메라로 거른다', async () => {
    const { items } = await api().listEvents('store-gangnam', { cameraId: 'cam-door' })
    expect(items.every((e) => e.cameraId === 'cam-door')).toBe(true)
    expect(items.length).toBeGreaterThan(0)
  })

  it('위험도로 거른다', async () => {
    const { items } = await api().listEvents('store-gangnam', { risk: 'high' })
    expect(items.every((e) => e.risk === 'high')).toBe(true)
  })

  it('위험 종류라는 축은 없다 — 모든 이벤트가 같은 모양이다', async () => {
    const { items } = await api().listEvents('store-gangnam')
    items.forEach((e) => expect(e).not.toHaveProperty('kind'))
  })
})

describe('가짜 서버 — 상태 변경', () => {
  it('확인하면 미확인 수가 줄어든다', async () => {
    const mock = api()
    const before = await mock.getUnconfirmedCount('store-gangnam')
    await mock.setEventState('ev-1', 'confirmed')
    expect(await mock.getUnconfirmedCount('store-gangnam')).toBe(before - 1)
  })

  it('오탐도 미확인에서 빠진다', async () => {
    const mock = api()
    const before = await mock.getUnconfirmedCount('store-gangnam')
    await mock.setEventState('ev-2', 'false_positive')
    expect(await mock.getUnconfirmedCount('store-gangnam')).toBe(before - 1)
  })

  it('없는 이벤트는 조용히 성공하지 않는다', async () => {
    await expect(api().getEvent('없음')).rejects.toThrow()
  })

  it('매장 목록의 미확인 수도 같이 따라간다', async () => {
    const mock = api()
    await mock.setEventState('ev-1', 'confirmed')
    const stores = await mock.listStores()
    const gangnam = stores.find((s) => s.id === 'store-gangnam')!
    expect(gangnam.unconfirmedCount).toBe(1)
  })
})

describe('가짜 서버 — 카메라가 죽어 있는 상태', () => {
  it('창고는 끊겨 있고, 감시 대수가 전체보다 적다', async () => {
    const monitoring = await api().getMonitoring('store-gangnam')
    const stock = monitoring.cameras.find((c) => c.id === 'cam-stock')!
    expect(stock.state).toBe('disconnected')
    expect(stock.disconnectedForSec).toBe(13 * 60)
    expect(monitoring.monitoringCount).toBeLessThan(monitoring.totalCount)
  })

  it('PC 가 꺼진 매장은 카메라도 없고 마지막 분석도 없다 — 안전하다고 말할 근거가 없다', async () => {
    const monitoring = await api().getMonitoring('store-yeoksam')
    expect(monitoring.device?.online).toBe(false)
    expect(monitoring.cameras).toHaveLength(0)
    expect(monitoring.lastAnalyzedAt).toBeNull()
  })

  it('끊긴 구간이 타임라인에 공백으로 남는다', async () => {
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    const timeline = await api().getTimeline('store-gangnam', date)
    const stock = timeline.find((c) => c.cameraId === 'cam-stock')!
    expect(stock.gaps[0]?.reason).toBe('camera_disconnected')
  })
})

describe('가짜 서버 — 알림 설정', () => {
  it('저장한 값이 그대로 돌아온다', async () => {
    const mock = api()
    const current = await mock.getNotificationSettings('store-gangnam')
    const next = { ...current, minRisk: 'high' as const }
    expect(await mock.putNotificationSettings('store-gangnam', next)).toEqual(next)
    expect(await mock.getNotificationSettings('store-gangnam')).toEqual(next)
  })
})

describe('가짜 서버 — 매장 경계', () => {
  it('다른 매장에 남의 기록을 보여 주지 않는다', async () => {
    const mock = createMockApi({ latencyMs: 0 })
    const { items } = await mock.listEvents('store-yeoksam')
    expect(items).toHaveLength(0)
    expect(await mock.getUnconfirmedCount('store-yeoksam')).toBe(0)
    expect(await mock.getTimeline('store-yeoksam', '2026-09-18')).toHaveLength(0)
  })
})

describe('가짜 서버 — 응답 모양은 진짜 서버와 같다', () => {
  it('상태를 바꾸면 목록 모양만 돌려준다 — 상세 필드(점수·클립)는 없다', async () => {
    const updated = await api().setEventState('ev-1', 'confirmed')
    expect(updated.state).toBe('confirmed')
    expect(updated).not.toHaveProperty('anomalyScore')
    expect(updated).not.toHaveProperty('clipUrl')
  })

  it('목록은 매번 새 객체다 — 상태를 바꿔도 화면이 들고 있던 객체는 그대로다', async () => {
    const mock = api()
    const { items } = await mock.listEvents('store-gangnam')
    const held = items.find((e) => e.id === 'ev-1')!
    await mock.setEventState('ev-1', 'confirmed')
    // 안쪽 객체를 그대로 주면 여기서 held.state 도 바뀐다. 그러면 객체가 같다고 다시 그리지 않는
    // React Compiler 가 옛 글자('미확인')를 그대로 두었다 (카드는 흐려졌는데 글자는 '미확인').
    expect(held.state).toBe('unconfirmed')
    const again = await mock.listEvents('store-gangnam')
    expect(again.items.find((e) => e.id === 'ev-1')!.state).toBe('confirmed')
  })
})

describe('가짜 서버 — 이번 주 요약', () => {
  it('오탐까지 센 수(total) · 오탐 · 메모가 남은 수(신고)를 준다', async () => {
    const mock = api()
    const before = await mock.getWeeklySummary('store-gangnam')
    expect(before.total).toBeGreaterThan(before.falsePositive)
    expect(before.reported).toBe(0)
    await mock.setEventMemo('ev-1', '112 접수 2026-0911-001')
    await mock.setEventState('ev-2', 'false_positive')
    const after = await mock.getWeeklySummary('store-gangnam')
    expect(after.reported).toBe(1)
    expect(after.falsePositive).toBe(before.falsePositive + 1)
    expect(after.total).toBe(before.total)
  })

  it('다른 매장은 0 — 남의 기록을 세지 않는다', async () => {
    expect(await api().getWeeklySummary('store-yeoksam')).toEqual({ total: 0, falsePositive: 0, reported: 0 })
  })
})
