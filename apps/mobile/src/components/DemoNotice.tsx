import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, radius, spacing } from '@scene-stealer/tokens'
import { type as type_ } from '../lib/typography'
import { Button } from './ui'
import { config } from '../lib/config'
import { enableWebNotifications, isWeb, pairingCode, type WebPushState } from '../lib/web-push'

/**
 * 데모 페이지 상단 안내 — 심사위원이 처음 보는 카드. 가짜 서버 데모(`EXPO_PUBLIC_DEMO=1`)에서만 뜬다.
 * 실서버 시연(/wanted-test/m/)에는 없다 — 거기서는 실제 앱 화면만 보인다.
 *
 * 알림 권한은 사용자가 직접 누른 직후에만 물을 수 있다(브라우저 규칙). 그래서
 * 자동으로 띄우지 않고 버튼 하나를 둔다. 누르기 전에 무엇이 일어날지 먼저 적는다 —
 * 맥락 없이 뜨는 권한 요청은 대부분 거절당한다.
 */
/** 남색 카드 위의 작은 글 */
const Caption = ({ children }: { children: ReactNode }) => <Text style={styles.caption}>{children}</Text>

export const DemoNotice = () => {
  const [state, setState] = useState<WebPushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [code, setCode] = useState('')

  useEffect(() => {
    if (isWeb) setCode(pairingCode())
  }, [])

  const enable = useCallback(async () => {
    setBusy(true)
    try {
      setState(await enableWebNotifications())
    } finally {
      setBusy(false)
    }
  }, [])

  if (!config.demo) return null

  return (
    <View style={styles.card}>
      <Text style={styles.title}>체험용 데모입니다</Text>

      {state === null ? (
        <>
          <Text style={styles.body}>
            노트북에서 열어 둔 매장 감시 화면이 이상 행동을 잡으면, 이 휴대폰으로 알림이 옵니다.
            먼저 알림을 허용해 주세요.
          </Text>
          <Button label="알림 받기" tone="blue" onPress={() => void enable()} loading={busy} />
        </>
      ) : state.kind === 'push' ? (
        <>
          <Text style={styles.body}>
            준비됐습니다. 이제 <Text style={styles.strong}>화면을 꺼도</Text> 알림이 옵니다.
            노트북 화면으로 돌아가 데모를 진행해 주세요.
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>연결 코드</Text>
            <Text style={styles.code}>{state.code}</Text>
          </View>
        </>
      ) : state.kind === 'local' ? (
        <>
          <Text style={styles.body}>
            알림을 허용했습니다. 다만 이 브라우저에서는{' '}
            <Text style={styles.strong}>이 페이지를 열어 둔 동안에만</Text> 알림이 옵니다.
          </Text>
          <Caption>
            아이폰은 사파리 공유 버튼 → '홈 화면에 추가' 를 하면 화면을 꺼도 알림을 받을 수 있습니다.
          </Caption>
        </>
      ) : state.kind === 'denied' ? (
        <>
          <Text style={styles.warn}>알림이 거부돼 있습니다.</Text>
          <Caption>
            주소창 왼쪽 자물쇠 → 알림 → 허용으로 바꾼 뒤 새로고침해 주세요. 그동안에도 화면 안에서는
            위험 기록을 다 보실 수 있습니다.
          </Caption>
        </>
      ) : (
        <>
          <Text style={styles.warn}>{state.reason}</Text>
          <Caption>알림 없이도 아래 화면들은 그대로 보실 수 있습니다.</Caption>
        </>
      )}

      {code && state === null ? <Caption>연결 코드 {code}</Caption> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brand,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  title: { ...type_.heading, color: colors.textInverse },
  body: { ...type_.body, color: colors.textInverse, lineHeight: 20, opacity: 0.92 },
  strong: { fontWeight: '700', opacity: 1 },
  warn: { ...type_.body, color: colors.textInverse, lineHeight: 20 },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: radius.medium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  caption: { ...type_.caption, color: colors.textInverse, opacity: 0.7, lineHeight: 18 },
  codeLabel: { ...type_.caption, color: colors.textInverse, opacity: 0.7 },
  code: { ...type_.heading, color: colors.textInverse, letterSpacing: 2 },
})
