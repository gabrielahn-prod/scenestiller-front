import { StyleSheet, type StyleProp, type ImageStyle } from 'react-native'
import { Image } from 'expo-image'
import cctvImage from '../../assets/images/cctv.png'

/**
 * 그림 두 가지 — 카드 바탕 그라디언트와 홈 안내 카드의 CCTV 그림.
 * 그라디언트는 의존성을 늘리지 않고 SVG 로 그린다 (아이콘과 같은 방식, expo-image 는 웹 · 네이티브 모두 SVG 를 그린다).
 */
const svgUri = (svg: string): string => `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`

/** 피그마의 분홍 카드 바탕(홈 안내 · 이번 주 요약) — 왼쪽 옅은 분홍 → 가운데 거의 흰색 → 오른쪽 분홍. */
export const PINK_SWEEP = [
  [0, '#FAF2F2'],
  [0.5, '#FFFDFD'],
  [1, '#F4DFDF'],
] as const

/** 가로 그라디언트. 부모가 모서리(borderRadius)와 overflow: 'hidden' 을 준다. */
export const Gradient = ({ stops }: { stops: readonly (readonly [number, string])[] }) => (
  <Image
    source={{
      uri: svgUri(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">' +
          `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="0">${stops
            .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
            .join('')}</linearGradient></defs>` +
          '<rect width="100" height="100" fill="url(#g)"/></svg>',
      ),
    }}
    style={StyleSheet.absoluteFill}
    contentFit="fill"
    accessible={false}
  />
)

/**
 * 벽에 붙은 흰 CCTV — 피그마 홈 'AI가 매장을 지키고 있어요' 카드 오른쪽 그림.
 * 디자인에서 받은 그림(95×81, 둘레 9 는 투명)을 원래 크기로 쓴다 — 카메라 자체가 피그마 크기(77×62)다.
 * 놓을 때는 투명 둘레(CCTV_INSET)만큼 밖으로 빼야 카메라가 피그마 자리에 온다.
 */
export const CCTV_INSET = 9

export const CctvIllustration = ({ style }: { style?: StyleProp<ImageStyle> }) => (
  <Image source={cctvImage} style={[{ width: 95, height: 81 }, style]} contentFit="contain" accessible={false} />
)
