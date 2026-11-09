import { Platform, type TextStyle } from 'react-native'
import { type as tokenType } from '@scene-stealer/tokens'
import { config } from './config'

/**
 * 글꼴 — 디자인시스템 2장: 본문은 Pretendard, 로고 글자(Scene Stealer)만 Prompt Bold.
 * 전역 자간 -0.01em · 숫자 폭 고정(tabular-nums)도 같은 장의 규칙이다.
 *
 * 웹(휴대폰 브라우저로 여는 화면)은 public/fonts 의 글꼴을 쓴다. Pretendard 는 한글을 92조각으로
 * 나눈 'dynamic subset' 판이라 화면에 나온 글자가 든 조각만 받는다 (통째로 받으면 2MB).
 * 네이티브 앱에는 아직 글꼴 파일을 싣지 않아 시스템 글꼴 그대로다 — 싣지 않은 이름을 주면
 * iOS 가 오류를 내므로 글꼴 이름은 웹에서만 준다.
 */
const web = Platform.OS === 'web'

const BODY_STACK =
  "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif"

/** 본문 글꼴. 토큰(type)을 거치지 않고 글자 크기를 직접 주는 곳에 붙인다. */
export const bodyFont: TextStyle = web ? { fontFamily: BODY_STACK } : {}

/** 로고 글자 전용. 디자인의 'Scene Stealer' 워드마크 (Prompt 700). */
export const logoFont: TextStyle = web ? { fontFamily: `Prompt, ${BODY_STACK}`, fontWeight: '700' } : { fontWeight: '700' }

type TypeName = keyof typeof tokenType

/**
 * 토큰의 글자 크기·굵기에 글꼴·자간·숫자 폭을 붙인 것. 화면은 토큰 대신 이것을 쓴다.
 * 자간은 em 을 받지 않으므로 크기마다 -0.01em 을 px 로 바꿔 넣는다.
 */
export const type = Object.fromEntries(
  (Object.keys(tokenType) as TypeName[]).map((name) => {
    const style = tokenType[name]
    return [
      name,
      {
        ...style,
        ...bodyFont,
        letterSpacing: -0.01 * style.fontSize,
        fontVariant: ['tabular-nums'] as TextStyle['fontVariant'],
      },
    ]
  }),
) as { readonly [K in TypeName]: (typeof tokenType)[K] & TextStyle }

/**
 * 피그마 모바일 화면의 글자 — 크기 · 굵기만 주면 글꼴 · 자간(-0.01em) · 숫자 폭을 붙인다.
 * 줄 높이는 한 줄 글자가 칸 가운데 오도록 크기의 1.4배로 둔다.
 */
export const font = (fontSize: number, fontWeight: TextStyle['fontWeight'] = '400'): TextStyle => ({
  ...bodyFont,
  fontSize,
  fontWeight,
  lineHeight: Math.round(fontSize * 1.4),
  letterSpacing: -0.01 * fontSize,
  fontVariant: ['tabular-nums'],
})

/**
 * 웹 글꼴을 문서에 건다. 첫 화면이 그려지기 전에 부르도록 앱 진입점(_layout)의 맨 위에서 부른다.
 * 글꼴이 늦게 와도 글자는 먼저 시스템 글꼴로 보인다 (font-display: swap).
 */
export const installWebFonts = (): void => {
  if (!web || typeof document === 'undefined' || document.getElementById('scene-stealer-fonts')) return
  const base = config.webBaseUrl
  const link = document.createElement('link')
  link.id = 'scene-stealer-fonts'
  link.rel = 'stylesheet'
  link.href = `${base}/fonts/pretendard/pretendardvariable-dynamic-subset.css`
  document.head.appendChild(link)

  const style = document.createElement('style')
  style.textContent = [
    `@font-face{font-family:Prompt;font-style:normal;font-weight:700;font-display:swap;src:url(${base}/fonts/prompt/prompt-latin-700-normal.woff2) format('woff2')}`,
    // 입력 칸·버튼처럼 앱 글꼴을 따로 주지 않은 요소도 같은 글꼴로. 한글은 어절 단위로 줄을 바꾼다 ('숫자 6|자리' 처럼 끊기지 않게).
    `html,body{font-family:${BODY_STACK};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;word-break:keep-all;overflow-wrap:break-word}`,
  ].join('\n')
  document.head.appendChild(style)
}
