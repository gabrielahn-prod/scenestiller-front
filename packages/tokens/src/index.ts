import { darkTokens, lightTokens } from './generated'

export { darkTokens, lightTokens }
export type { TokenName } from './generated'

/**
 * 화면에서 쓰는 이름.
 *
 * 생성된 토큰은 피그마 변수 이름 그대로라 `gray-600-2` 처럼 뜻이 안 보인다.
 * 여기서 한 번만 의미로 바꿔 두고, 화면 코드는 이쪽만 쓴다.
 */
export const colors = {
  brand: lightTokens['main'],            // #14233d 네이비
  accent: lightTokens['sub'],            // #3b6ff5 파랑 — 선택·강조
  accentStrong: lightTokens['blue-600'],

  bg: lightTokens['bg'],
  surface: lightTokens['surface-default'],
  surfaceSubtle: lightTokens['surface-subtle'],
  surfaceError: lightTokens['surface-error'],

  text: lightTokens['text-default'],
  textSecondary: lightTokens['text-secondary'],
  textInverse: lightTokens['text-inverse'],
  textError: lightTokens['text-error'],

  border: lightTokens['border-default'],
  borderStrong: lightTokens['border-strong'],
  borderFocus: lightTokens['border-focus'],

  danger: lightTokens['error-main'],     // 위험도 높음
  dangerStrong: lightTokens['error-600'],
  warning: lightTokens['error-400'],     // 위험도 보통
  ok: lightTokens['success-500'],        // 정상·연결됨
} as const

/** 피그마 unit 토큰. 그 사이 값은 4의 배수로 채운다. */
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const
export const radius = { small: 4, medium: 8, large: 16, pill: 999 } as const

/**
 * 하단 탭바 — 피그마 `navigation bar` (node 118:1555) 실측값.
 * 폭 393 은 아이폰 Pro 기준이라 화면 폭에 맞춰 늘린다. 아래 패딩 28 은 홈 인디케이터 자리.
 */
export const navBar = {
  height: 56,
  paddingTop: 16,
  paddingBottom: 28,
  paddingHorizontal: 60,
  radiusTop: 16,
  background: '#ffffff',
  shadow: { color: '#000000', opacity: 0.04, offsetY: -2, blur: 4 },
  iconSize: 24,
  gap: 4,
  label: { fontSize: 10, fontWeight: '500' as const },
  activeColor: lightTokens['sub'],
  inactiveColor: lightTokens['text-secondary'],
} as const

/**
 * 토글 — 피그마 `toggle switch` (node 119:2235).
 * 원본 수치(25.6×16)는 0.8배로 축소된 인스턴스라 그대로 쓰면 손가락으로 누르기 어렵다.
 * 모양 비율만 가져오고 실제 크기는 1.25배로 되돌려 44pt 터치 영역 안에 놓는다.
 */
export const toggle = {
  track: { width: 32, height: 20, radius: 999 },
  knob: { size: 14.4, radius: 999, color: lightTokens['bg-2'] },
  onColor: lightTokens['sub'],
  offColor: lightTokens['border-strong'],
  touchTarget: 44,
} as const

/** 본문 타이포. PC 와 같은 계열(Pretendard)을 쓰되 모바일 크기로 내린다. */
export const type = {
  title: { fontSize: 20, fontWeight: '700' as const },
  heading: { fontSize: 16, fontWeight: '700' as const },
  body: { fontSize: 14, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '500' as const },
  caption: { fontSize: 12, fontWeight: '400' as const },
  tiny: { fontSize: 10, fontWeight: '500' as const },
} as const
