import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import { Stack, router, useRootNavigationState, useSegments } from 'expo-router'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { lightTokens } from '@scene-stealer/tokens'
import { WEB_FRAME_WIDTH } from '../components/ui'
import { ApiProvider } from '../lib/api'
import { config } from '../lib/config'
import { eventIdFrom, pushSupported } from '../lib/notifications'
import { askNotificationsOnFirstTap, installWebAppManifest, isWeb, onNotificationOpen } from '../lib/web-push'
import { palette } from '../lib/palette'
import { SessionProvider, useSession } from '../lib/session'
import { StoreProvider } from '../lib/store-context'
import { installWebFonts } from '../lib/typography'

// 첫 화면이 그려지기 전에 글꼴을 건다 (웹만).
installWebFonts()

/** 로그인 전에는 로그인 화면 밖으로 못 나가고, 로그인 뒤에는 로그인 화면에 머물지 않는다. */
const useAuthGate = () => {
  const { session, loading } = useSession()
  const segments = useSegments()
  const navigationState = useRootNavigationState()

  useEffect(() => {
    if (loading || !navigationState?.key) return
    const onLogin = segments[0] === 'login'
    if (!session && !onLogin) router.replace('/login')
    if (session && onLogin) router.replace('/')
  }, [session, loading, segments, navigationState?.key])
}

/** 알림을 탭하면 그 이벤트 상세로 간다 — 앱이 꺼져 있다가 알림으로 열린 경우까지. */
const useNotificationRouting = () => {
  const { session } = useSession()

  useEffect(() => {
    // 웹 미리보기에는 알림 네이티브 모듈이 없다. 없는 걸 부르면 화면 전체가 죽는다.
    if (!session || !pushSupported) return
    let cancelled = false

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      const eventId = eventIdFrom(response?.notification.request.content.data)
      if (!cancelled && eventId) router.push(`/events/${eventId}`)
    })

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const eventId = eventIdFrom(response.notification.request.content.data)
      if (eventId) router.push(`/events/${eventId}`)
    })
    return () => {
      cancelled = true
      subscription.remove()
    }
  }, [session])
}

/** 웹에서의 알림 탭 — 서비스워커가 보낸 메시지든, 주소의 ?event= 든 같은 곳으로 보낸다. */
const useWebNotificationRouting = () => {
  useEffect(() => {
    if (!isWeb) return
    return onNotificationOpen((eventId) => router.push(`/events/${eventId}`))
  }, [])
}

const Gate = () => {
  useAuthGate()
  useNotificationRouting()
  useWebNotificationRouting()
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="events/[id]" options={{ presentation: 'card' }} />
    </Stack>
  )
}

export default function RootLayout() {
  // 홈 화면에 추가할 수 있게 웹앱 정보를 건다 — 아이폰은 그래야 웹 푸시를 받는다.
  useEffect(() => {
    installWebAppManifest()
  }, [])

  // 실서버 시연에는 알림 안내 카드가 없다. 권한은 첫 탭에 브라우저 기본 창으로만 묻는다.
  useEffect(() => (config.live ? askNotificationsOnFirstTap() : undefined), [])

  return (
    <SafeAreaProvider>
      <View style={styles.page}>
        <View style={styles.frame}>
          <SessionProvider>
            <ApiProvider>
              <StoreProvider>
                <StatusBar style="dark" />
                <Gate />
              </StoreProvider>
            </ApiProvider>
          </SessionProvider>
        </View>
      </View>
    </SafeAreaProvider>
  )
}

/**
 * 웹을 넓은 창(컴퓨터)으로 열어도 휴대폰 화면처럼 보이게, 가운데에 휴대폰 폭(430)으로 둔다.
 * 사장님 앱은 휴대폰 앱이다 — 1280 폭으로 늘어난 카드는 이 앱이 아니다. 네이티브는 그대로 화면 가득.
 */
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: isWeb ? lightTokens['gray-200'] : palette.page },
  frame: isWeb
    ? { flex: 1, width: '100%', maxWidth: WEB_FRAME_WIDTH, alignSelf: 'center', overflow: 'hidden', backgroundColor: palette.page }
    : { flex: 1 },
})
