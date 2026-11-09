import { lightTokens } from '@scene-stealer/tokens'

/**
 * 피그마 모바일 화면(알림 상세 · 홈 · 기록 · 설정)에서 뽑은 색.
 * 디자인시스템 토큰에 있는 값은 토큰 이름으로 쓰고, 피그마에만 있는 옅은 분홍 세 가지는 값 그대로 둔다.
 */
export const palette = {
  /** 화면 바탕 — gray/50 */
  page: lightTokens['gray-50'],
  /** 머리 · 탭바 · 흰 카드 */
  white: '#FFFFFF',
  /** 흰 카드 · 칩 테두리 — gray/300 */
  border: lightTokens['gray-300'],
  /** 카드 안 줄 — gray/200 */
  divider: lightTokens['gray-200'],
  /** '전체 기록 보기' 같은 회색 버튼 바탕 — gray/100 */
  fill: lightTokens['gray-100'],

  /** 카드 제목 · 주요 버튼 · 선택한 칩 — brand main */
  navy: lightTokens['main'],
  /** 섹션 제목 — gray/900 */
  ink: lightTokens['gray-900'],
  /** 본문 보조 — gray/700 */
  sub: lightTokens['gray-700'],
  /** 시각 · 값 — gray/600 */
  muted: lightTokens['gray-600'],
  /** 옅은 안내 · 꺼진 칩 — gray/500 */
  faint: lightTokens['gray-500'],

  /** 탭 · 토글 · 링크 — brand sub */
  blue: lightTokens['sub'],
  /** 위험 글자 · 112 버튼 — error/main */
  red: lightTokens['error-main'],
  /** 미확인 '높음' 카드 테두리 — error/500 */
  redLine: lightTokens['error-500'],
  /** 끊긴 카메라 칩 테두리 — error/400 */
  redSoftLine: lightTokens['error-400'],
  /** 미확인 카드 안 줄 — error/200 */
  redDivider: lightTokens['error-200'],
  /** 연결됨 점 — success/500 */
  green: lightTokens['success-500'],

  /** 위험 카드 · 상태 카드 바탕 (피그마 값) */
  pinkSurface: '#FDF6F6',
  /** 사이렌 · 방패 · 문서 아이콘 동그라미 (피그마 값) */
  pinkCircle: '#FDE5E7',
  /** 사이렌 · 방패 · 문서 아이콘 (피그마 값) */
  pinkIcon: '#DE7164',
  /** 요약 · 안내 카드의 오른쪽 끝 분홍 (피그마 값) */
  pinkEdge: '#F5DFDF',
} as const
