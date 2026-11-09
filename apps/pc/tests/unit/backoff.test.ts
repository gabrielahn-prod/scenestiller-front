import { describe, it, expect } from 'vitest'
import { nextDelayMs } from '../../src/main/lib/backoff'

const noJitter = { baseMs: 1000, maxMs: 300_000, jitter: false }

describe('nextDelayMs', () => {
  it('0회차는 baseMs를 반환한다', () => {
    expect(nextDelayMs(0, noJitter)).toBe(1000)
  })

  it('회차마다 2배로 늘어난다', () => {
    expect(nextDelayMs(1, noJitter)).toBe(2000)
    expect(nextDelayMs(2, noJitter)).toBe(4000)
    expect(nextDelayMs(3, noJitter)).toBe(8000)
  })

  it('maxMs를 넘지 않는다', () => {
    expect(nextDelayMs(99, { baseMs: 1000, maxMs: 30_000, jitter: false })).toBe(30_000)
  })

  it('음수 회차는 0회차로 취급한다', () => {
    expect(nextDelayMs(-5, noJitter)).toBe(1000)
  })

  it('지터를 켜면 [delay/2, delay] 범위에 든다', () => {
    const results = Array.from({ length: 200 }, () =>
      nextDelayMs(3, { baseMs: 1000, maxMs: 300_000, jitter: true }),
    )
    expect(results.every((d) => d >= 4000 && d <= 8000)).toBe(true)
    // 지터가 실제로 값을 흩뜨리는지 (전부 같은 값이면 지터가 죽은 것)
    expect(new Set(results).size).toBeGreaterThan(1)
  })
})
