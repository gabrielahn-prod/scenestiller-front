import { describe, expect, it } from 'vitest'
import { eventIdFrom, storeIdFrom } from '../../src/lib/push-payload'

describe('푸시 데이터 읽기', () => {
  it('eventId 가 있으면 그 상세로 간다', () => {
    expect(eventIdFrom({ eventId: 'evt_1' })).toBe('evt_1')
  })

  it('없거나 이상하면 null — 홈에 머문다', () => {
    expect(eventIdFrom(undefined)).toBeNull()
    expect(eventIdFrom(null)).toBeNull()
    expect(eventIdFrom({})).toBeNull()
    expect(eventIdFrom({ eventId: '' })).toBeNull()
    expect(eventIdFrom({ eventId: 42 })).toBeNull()
    expect(eventIdFrom('evt_1')).toBeNull()
  })

  it('storeId 도 같은 규칙으로 읽는다', () => {
    expect(storeIdFrom({ storeId: 'store_1' })).toBe('store_1')
    expect(storeIdFrom({ storeId: null })).toBeNull()
  })
})
