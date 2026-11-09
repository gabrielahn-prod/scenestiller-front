import type { SegmentDto } from '../../shared/server-types'

/**
 * 그 시간 칸에 걸리는 조각.
 *
 * 조각은 눈금에 맞춰 시작하지 않는다 — 녹화가 시작된 시각(13:40:35)이다. 그래서 칸의 시작 시각과
 * 같은 조각만 찾으면, 서버가 조각을 줬는데도 2e 타임라인이 전부 '영상 없음'이 되고 본 화면에는
 * '이 조각의 영상이 없습니다' 가 뜬다.
 *
 * 가장 많이 겹치는 조각을 쓰되, 칸(또는 조각)의 절반도 못 채우면 없는 것으로 본다 —
 * 1초 걸쳤다고 옆 칸까지 같은 조각으로 채우지 않기 위해서다.
 */
export const segmentIn = (segments: readonly SegmentDto[], from: number, to: number): SegmentDto | null => {
  let best: SegmentDto | null = null
  let bestOverlap = 0
  for (const segment of segments) {
    const start = Date.parse(segment.startedAt)
    const end = Date.parse(segment.endedAt)
    const overlap = Math.min(end, to) - Math.max(start, from)
    if (overlap >= Math.min(to - from, end - start) / 2 && overlap > bestOverlap) {
      best = segment
      bestOverlap = overlap
    }
  }
  return best
}
