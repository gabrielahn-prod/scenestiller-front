import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { colors } from '@scene-stealer/tokens'
import { logoFont } from '../lib/typography'

/**
 * 로고 — 마크(남색 S + 모서리 괄호) + 'Scene Stealer' 워드마크(Prompt 700).
 * 마크는 오른쪽 위 모서리와 왼쪽 삼각형만 로고 노랑(#F9A403, 디자인시스템 1장)이다.
 * PC 앱의 assets/logo-mark-color.svg 와 같은 도형이다 (원본에 붙은 C2PA 메타데이터는 뺐다).
 */
const NAVY = '#14233D'
const YELLOW = '#F9A403'

const MARK = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46.148 42.031">` +
    `<path fill="${NAVY}" d="M32.843 13.474 36.738 7.71C30.648 7.716 18.186 7.743 17.058 7.801 15.93 7.858 14.25 8.62 13.551 8.994 12.382 9.765 9.971 12.07 9.682 15.121 9.507 16.969 10.368 18.447 11.364 19.467 12.45 20.579 13.977 21.082 15.462 21.54L28.605 25.589C29.287 25.733 30.587 26.29 30.326 27.36 30.066 28.43 29.07 28.746 28.605 28.769H15.424C14.335 28.769 13.508 29.379 13.231 29.684L9.056 34.511H27.131C29.697 34.511 32.383 34.328 34.415 32.761 36.404 31.228 38.261 28.687 38.261 24.864 38.261 18.69 33.417 16.836 30.996 16.681H17.444C16.966 16.605 16.01 16.188 16.01 15.121 16.01 14.053 16.966 13.578 17.444 13.474Z"/>` +
    `<path fill="${YELLOW}" d="M18.576 25.189 9.649 28.721V21.657Z"/>` +
    `<path fill="${NAVY}" d="M12.501 0C13.327 0 13.996.67 13.996 1.496V1.769C13.996 2.595 13.327 3.265 12.501 3.265H4.761C3.935 3.265 3.265 3.935 3.265 4.76V11.995C3.265 12.821 2.596 13.49 1.77 13.49H1.496C.67 13.49 0 12.821 0 11.995V1.496C0 .67.67 0 1.496 0Z"/>` +
    `<path fill="${NAVY}" d="M12.501 42.031C13.327 42.031 13.996 41.362 13.996 40.536V40.262C13.996 39.436 13.327 38.766 12.501 38.766H4.761C3.935 38.766 3.265 38.097 3.265 37.271V30.036C3.265 29.21 2.596 28.541 1.77 28.541H1.496C.67 28.541 0 29.21 0 30.036V40.536C0 41.362.67 42.031 1.496 42.031Z"/>` +
    `<path fill="${YELLOW}" d="M33.647 0C32.821 0 32.152.67 32.152 1.496V1.769C32.152 2.595 32.821 3.265 33.647 3.265H41.387C42.213 3.265 42.883 3.935 42.883 4.76V11.995C42.883 12.821 43.552 13.49 44.378 13.49H44.653C45.478 13.49 46.148 12.821 46.148 11.995V1.496C46.148.67 45.478 0 44.653 0Z"/>` +
    `<path fill="${NAVY}" d="M33.647 42.031C32.821 42.031 32.152 41.362 32.152 40.536V40.262C32.152 39.436 32.821 38.766 33.647 38.766H41.387C42.213 38.766 42.883 38.097 42.883 37.271V30.036C42.883 29.21 43.552 28.541 44.378 28.541H44.653C45.478 28.541 46.148 29.21 46.148 30.036V40.536C46.148 41.362 45.478 42.031 44.653 42.031Z"/>` +
    `</svg>`,
)}`

const MARK_RATIO = 42.031 / 46.148

/**
 * 가로 로고 — 앱 머리(피그마: 워드마크 16 · 마크 27 폭 · 사이 5).
 * 워드마크 글자 크기를 주면 마크와 사이는 그 비율로 따라간다.
 */
export const Logo = ({ size = 16 }: { size?: number }) => {
  const markWidth = size * 1.7
  return (
    <View style={[styles.row, { gap: size * 0.32 }]} accessibilityRole="header" accessibilityLabel="Scene Stealer">
      <Image source={{ uri: MARK }} style={{ width: markWidth, height: markWidth * MARK_RATIO }} contentFit="contain" />
      <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.2 }]}>Scene Stealer</Text>
    </View>
  )
}

/** 세로 로고 — 마크 위, 워드마크 아래. 로그인처럼 로고 하나가 화면의 얼굴일 때. */
export const LogoStacked = ({ size = 24 }: { size?: number }) => {
  const markWidth = size * 2.4
  return (
    <View style={[styles.stack, { gap: size * 0.45 }]} accessibilityRole="header" accessibilityLabel="Scene Stealer">
      <Image source={{ uri: MARK }} style={{ width: markWidth, height: markWidth * MARK_RATIO }} contentFit="contain" />
      <Text style={[styles.word, { fontSize: size, lineHeight: size * 1.2 }]}>Scene Stealer</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stack: { alignItems: 'center' },
  word: { ...logoFont, color: colors.brand },
})
