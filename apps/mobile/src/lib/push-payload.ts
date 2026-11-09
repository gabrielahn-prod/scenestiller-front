/**
 * 푸시 데이터에서 화면이 필요한 값만 꺼낸다.
 * 네이티브 모듈을 건드리지 않으므로 그냥 테스트할 수 있다 — 알림 탭 → 상세 이동은
 * 사용자가 화면을 못 보는 상태에서 일어나는 일이라 여기가 조용히 틀리면 안 된다.
 */

export interface PushPayload {
  readonly eventId?: string
  readonly storeId?: string
}

export const eventIdFrom = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) return null
  const { eventId } = payload as PushPayload
  return typeof eventId === 'string' && eventId.length > 0 ? eventId : null
}

export const storeIdFrom = (payload: unknown): string | null => {
  if (typeof payload !== 'object' || payload === null) return null
  const { storeId } = payload as PushPayload
  return typeof storeId === 'string' && storeId.length > 0 ? storeId : null
}
