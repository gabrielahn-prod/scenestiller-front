import { describe, expect, it } from 'vitest'
import { segmentIn } from '../../src/renderer/lib/segments'
import type { SegmentDto } from '../../src/shared/server-types'

const at = (iso: string) => Date.parse(iso)

const segment = (startedAt: string, endedAt: string, sequence: number): SegmentDto => ({
  videoId: `v-${sequence}`,
  cameraId: 'cam-1',
  sequence,
  startedAt,
  endedAt,
  durationSec: (at(endedAt) - at(startedAt)) / 1000,
  status: 'done',
  playbackUrl: `https://example.test/${sequence}.mp4`,
})

const SLOT = 30_000

describe('segmentIn — 칸에 걸리는 조각 찾기', () => {
  it('눈금에 맞춰 시작하지 않는 조각도 그 칸에 붙인다', () => {
    // 진짜 서버의 조각은 녹화가 시작된 시각에 시작한다 (13:40:35, 26초).
    const segments = [segment('2026-09-20T04:40:35.010Z', '2026-09-20T04:41:01.010Z', 7)]
    const slot = at('2026-09-20T04:40:30.000Z')

    expect(segmentIn(segments, slot, slot + SLOT)?.sequence).toBe(7)
  })

  it('조금 걸친 이웃 칸은 비워 둔다', () => {
    // 위 조각은 04:41:00 칸에 1초만 걸친다 — 그 칸까지 같은 조각으로 채우면 없는 영상을 있다고 하는 셈이다.
    const segments = [segment('2026-09-20T04:40:35.010Z', '2026-09-20T04:41:01.010Z', 7)]
    const slot = at('2026-09-20T04:41:00.000Z')

    expect(segmentIn(segments, slot, slot + SLOT)).toBeNull()
  })

  it('여럿이 걸치면 가장 많이 겹치는 것을 쓴다', () => {
    const segments = [
      segment('2026-09-20T04:40:20.000Z', '2026-09-20T04:40:38.000Z', 6),
      segment('2026-09-20T04:40:38.000Z', '2026-09-20T04:41:04.000Z', 7),
    ]
    const slot = at('2026-09-20T04:40:30.000Z')

    expect(segmentIn(segments, slot, slot + SLOT)?.sequence).toBe(7)
  })

  it('그 시간에 올라온 조각이 없으면 없는 것으로 본다', () => {
    const segments = [segment('2026-09-20T04:30:00.000Z', '2026-09-20T04:30:26.000Z', 3)]
    const slot = at('2026-09-20T04:40:30.000Z')

    expect(segmentIn(segments, slot, slot + SLOT)).toBeNull()
  })

  it('눈금에 딱 맞는 조각도 그대로 찾는다 (가짜 서버)', () => {
    const segments = [segment('2026-09-20T04:40:30.000Z', '2026-09-20T04:41:00.000Z', 9)]
    const slot = at('2026-09-20T04:40:30.000Z')

    expect(segmentIn(segments, slot, slot + SLOT)?.sequence).toBe(9)
  })
})
