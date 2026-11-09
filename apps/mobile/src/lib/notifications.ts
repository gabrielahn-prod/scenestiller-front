import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { Platform } from 'react-native'
import type { PushPayload } from './push-payload'

export { eventIdFrom, storeIdFrom, type PushPayload } from './push-payload'

/**
 * 푸시 — 받는 쪽.
 *
 * 발송은 서버가 한다. 여기서는 권한을 받고, 토큰을 서버에 등록하고,
 * 알림을 탭했을 때 그 이벤트 상세로 보내는 것까지만 한다.
 *
 * 토큰은 **Expo 푸시 토큰**을 쓴다. Firebase 프로젝트도 APNs 키도 없이 실제 발송을
 * 확인할 수 있는 유일한 길이고, 서버는 계약대로 `POST /push/devices` 에
 * `platform: "expo"` 로 받아 두었다가 Expo 푸시 API 로 보내면 된다.
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

export const pushSupported = Platform.OS !== 'web'

const projectId = (): string | undefined =>
  (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
  (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId

export type PushRegistration =
  | { readonly ok: true; readonly token: string }
  | { readonly ok: false; readonly reason: string }

export const registerForPush = async (): Promise<PushRegistration> => {
  if (!pushSupported) return { ok: false, reason: '웹에서는 푸시를 받을 수 없습니다' }
  if (!Device.isDevice) return { ok: false, reason: '시뮬레이터에서는 푸시 토큰이 발급되지 않습니다' }

  const existing = await Notifications.getPermissionsAsync()
  const granted =
    existing.granted || (await Notifications.requestPermissionsAsync()).granted
  if (!granted) return { ok: false, reason: '알림 권한이 거부되었습니다' }

  if (Platform.OS === 'android') {
    // 채널이 없으면 안드로이드에서 알림이 조용히 사라진다.
    await Notifications.setNotificationChannelAsync('risk', {
      name: '위험 알림',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      sound: 'default',
    })
  }

  try {
    const id = projectId()
    const token = await Notifications.getExpoPushTokenAsync(id ? { projectId: id } : undefined)
    return { ok: true, token: token.data }
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : '토큰 발급 실패' }
  }
}

/**
 * 서버 없이 알림 → 상세 이동 경로를 확인하기 위한 로컬 알림.
 * 실제 푸시와 같은 데이터 모양을 쓰므로 탭 처리 코드는 동일하게 동작한다.
 */
export const sendLocalTestNotification = async (eventId: string): Promise<void> => {
  if (!pushSupported) return
  await Notifications.scheduleNotificationAsync({
    content: {
      title: '강남 1호점 · 계산대',
      body: '이상 행동이 감지되었습니다 · 위험도 높음',
      data: { eventId } satisfies PushPayload,
      sound: 'default',
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 2 },
  })
}
