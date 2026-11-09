import { Alert, Platform } from 'react-native'

/**
 * 알림 창. react-native-web 의 Alert.alert 는 아무것도 하지 않는다 — 웹에서 '저장하지 못했습니다'
 * 같은 안내가 소리 없이 사라졌다. 웹은 브라우저 기본 창으로 띄운다.
 */
export const notify = (title: string, message?: string): void => {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title)
    return
  }
  Alert.alert(title, message)
}
