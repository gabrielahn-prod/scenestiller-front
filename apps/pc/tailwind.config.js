/**
 * 색·반경·그림자·타이포는 전부 src/renderer/styles/tokens.css 의 CSS 변수를 가리킨다.
 * 여기에 숫자를 직접 적지 않는다 — 디자인 값의 단일 출처는
 * design/씬스틸러 디자인시스템.dc.html 이고, 토큰 파일이 그걸 옮긴 것이다.
 *
 * 색을 var() 로 두면 `bg-brand-main/50` 같은 알파 변형이 동작하지 않는다.
 * 반투명이 필요한 자리는 토큰으로 따로 만들어 쓴다(예: --video-label-bg).
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { main: 'var(--brand-main)', sub: 'var(--brand-sub)' },
        gray: {
          50: 'var(--gray-50)',
          100: 'var(--gray-100)',
          200: 'var(--gray-200)',
          300: 'var(--gray-300)',
          400: 'var(--gray-400)',
          500: 'var(--gray-500)',
          600: 'var(--gray-600)',
          700: 'var(--gray-700)',
          800: 'var(--gray-800)',
          900: 'var(--gray-900)',
        },
        blue: {
          50: 'var(--blue-50)',
          100: 'var(--blue-100)',
          200: 'var(--blue-200)',
          300: 'var(--blue-300)',
          400: 'var(--blue-400)',
          500: 'var(--blue-500)',
          600: 'var(--blue-600)',
          700: 'var(--blue-700)',
          800: 'var(--blue-800)',
          900: 'var(--blue-900)',
        },
        error: {
          50: 'var(--error-50)',
          100: 'var(--error-100)',
          200: 'var(--error-200)',
          300: 'var(--error-300)',
          400: 'var(--error-400)',
          500: 'var(--error-500)',
          600: 'var(--error-600)',
          700: 'var(--error-700)',
          800: 'var(--error-800)',
          900: 'var(--error-900)',
          main: 'var(--error-main)',
        },
        success: {
          50: 'var(--success-50)',
          100: 'var(--success-100)',
          200: 'var(--success-200)',
          300: 'var(--success-300)',
          400: 'var(--success-400)',
          500: 'var(--success-500)',
          600: 'var(--success-600)',
          700: 'var(--success-700)',
          800: 'var(--success-800)',
          900: 'var(--success-900)',
        },
        risk: {
          high: 'var(--risk-high)',
          medium: 'var(--risk-medium)',
          low: 'var(--risk-low)',
          'medium-surface': 'var(--risk-medium-surface)',
          'medium-text': 'var(--risk-medium-text)',
        },
        page: 'var(--page-bg)',
        // 'card' 가 아니라 'surface' 인 이유: boxShadow 에도 card 가 있어서 같은
        // 이름이면 Tailwind 가 shadow-card 를 그림자 '색' 유틸리티로 한 번 더
        // 만들고, 뒤에 오는 그 규칙이 카드 그림자를 덮어쓴다.
        surface: 'var(--card-bg)',
        video: 'var(--video-bg)',
      },
      borderRadius: {
        small: 'var(--radius-small)',
        card: 'var(--radius-card)',
        panel: 'var(--radius-panel)',
        chip: 'var(--radius-chip)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        modal: 'var(--shadow-modal)',
        segment: 'var(--shadow-segment)',
      },
      fontFamily: {
        // 로고 워드마크 전용. 본문에 쓰지 않는다 (디자인시스템 2장).
        logo: ['Prompt', 'sans-serif'],
      },
      fontSize: {
        // 디자인시스템 2장 타입 스케일. 줄 높이는 PC 화면 HTML 을 따른다 — 거기엔
        // line-height 가 없어 Pretendard normal(≈1.19)로 그려진다 (index.css body 참고).
        // 여러 줄 문단만 leading-normal 을 따로 준다.
        display: ['40px', { lineHeight: '1.2', fontWeight: '600' }],
        h1: ['32px', { lineHeight: '1.2', fontWeight: '600' }],
        h2: ['24px', { lineHeight: '1.2', fontWeight: '600' }],
        h3: ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        body: ['16px', { lineHeight: '1.2', fontWeight: '500' }],
        'body-sm': ['14px', { lineHeight: '1.2', fontWeight: '500' }],
        caption: ['13px', { lineHeight: '1.2', fontWeight: '400' }],
      },
      spacing: {
        // 페이지 좌우 여백 40 · 내비 높이 76 · 입력 높이 48 (디자인시스템 3·4장)
        page: '40px',
        nav: '76px',
        input: '48px',
      },
    },
  },
  plugins: [],
}
