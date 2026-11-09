import { Tabs } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { navBar } from '@scene-stealer/tokens'
import { Icon, type IconName } from '../../components/icons'
import { bodyFont } from '../../lib/typography'

/**
 * 탭바 — 피그마 `navigation bar` 값 그대로 (꽉 찬 아이콘 24 · 라벨 10 · 위 모서리 16).
 * 피그마 탭바에는 숫자 배지가 없다. 미확인 수는 홈의 '미확인 2' 와 기록의 '미확인 (2)' 칩이 말한다.
 * 아래 여백은 기기 홈 인디케이터에 맞춰 늘린다 (브라우저로 열면 인디케이터가 없어 조금만 둔다).
 */
const TabIcon = ({ name, focused }: { name: IconName; focused: boolean }) => (
  <Icon name={name} size={navBar.iconSize} color={focused ? navBar.activeColor : navBar.inactiveColor} />
)

/** react-navigation 탭 칸의 기본 위아래 여백 */
const ITEM_PADDING = 5
const LABEL_LINE = 14

export default function TabsLayout() {
  const insets = useSafeAreaInsets()
  const bottom = Math.max(insets.bottom, 20)
  // 탭 칸(react-navigation)은 위아래 안쪽 여백 5 를 스스로 둔다. 아이콘 윗선이 피그마처럼 탭바 위에서 16 에 오게 그만큼 뺀다.
  const top = navBar.paddingTop - ITEM_PADDING

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: navBar.activeColor,
        tabBarInactiveTintColor: navBar.inactiveColor,
        tabBarLabelStyle: {
          ...bodyFont,
          fontSize: navBar.label.fontSize,
          fontWeight: navBar.label.fontWeight,
          lineHeight: LABEL_LINE,
          marginTop: navBar.gap,
        },
        // 창이 넓으면 라벨이 아이콘 옆으로 가는 게 기본이다. 앱은 휴대폰 폭으로 그리므로 늘 아래에 둔다.
        tabBarLabelPosition: 'below-icon',
        // 아이콘 틀의 기본 크기(31×28)를 아이콘 크기로 줄인다 — 남는 틀만큼 라벨이 눌려 잘렸다.
        tabBarIconStyle: { width: navBar.iconSize, height: navBar.iconSize },
        tabBarStyle: {
          // 칸 여백 + 아이콘 + 간격 + 라벨 한 줄이 들어갈 높이. 모자라면 라벨이 잘려 아이콘만 남는다.
          height: top + ITEM_PADDING * 2 + navBar.iconSize + navBar.gap + LABEL_LINE + bottom,
          paddingTop: top,
          paddingBottom: bottom,
          // 피그마 화면의 탭 가운데가 72 · 196 · 321 — 세 칸을 폭 가득 나누고 양 끝만 10 띄운 자리다.
          paddingHorizontal: 10,
          backgroundColor: navBar.background,
          borderTopLeftRadius: navBar.radiusTop,
          borderTopRightRadius: navBar.radiusTop,
          borderTopWidth: 0,
          boxShadow: `0 ${navBar.shadow.offsetY}px ${navBar.shadow.blur}px rgba(0, 0, 0, ${navBar.shadow.opacity})`,
          elevation: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: '홈', tabBarIcon: ({ focused }) => <TabIcon name="home" focused={focused} /> }}
      />
      <Tabs.Screen
        name="records"
        options={{ title: '기록', tabBarIcon: ({ focused }) => <TabIcon name="records" focused={focused} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: '설정', tabBarIcon: ({ focused }) => <TabIcon name="settings" focused={focused} /> }}
      />
    </Tabs>
  )
}
