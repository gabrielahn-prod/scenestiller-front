import { useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { LogoStacked } from '../components/Logo'
import { Button, GUTTER, TextField } from '../components/ui'
import { config, usingMockAuth } from '../lib/config'
import { palette } from '../lib/palette'
import { useSession } from '../lib/session'
import { font } from '../lib/typography'

/** 010-1234-5678 모양으로 맞춘다 (PC 2a 와 같다). 숫자만 남기고 11자리까지. */
const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

const Brand = () => (
  <View style={styles.brand}>
    <LogoStacked size={24} />
    <Text style={styles.lede}>매장에서 일어난 이상 행동을{'\n'}바로 알려드려요.</Text>
  </View>
)

/**
 * 실서버 시연에서는 로그인 화면이 없다 — 데모 계정으로 들어가지 못했을 때만 여기로 온다.
 * 휴대폰 인증 칸을 보여 봐야 심사위원은 쓸 번호가 없다. 앱 첫 화면 그대로에 이유와 다시 시도만 둔다.
 */
const LiveSignInProblem = () => {
  const { liveError, accessToken } = useSession()
  const [busy, setBusy] = useState(false)
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Brand />
        <View style={styles.form}>
          {liveError ? <Text style={styles.error}>{liveError}</Text> : null}
          <Button
            label="다시 시도"
            tone="blue"
            loading={busy}
            onPress={() => {
              setBusy(true)
              void accessToken().finally(() => setBusy(false))
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  )
}

export default function LoginScreen() {
  return config.live ? <LiveSignInProblem /> : <PhoneLogin />
}

/**
 * 로그인 — 휴대폰 번호 + 인증번호. PC 앱과 같은 계정이다.
 * 피그마에 모바일 로그인 화면이 없어 PC 2a 의 순서(번호 → 코드)를 그대로 따르고,
 * 모양은 모바일 화면의 부품(입력 칸 · 54 버튼)과 세로 로고로 맞췄다.
 */
function PhoneLogin() {
  const { auth, signIn } = useSession()
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await task()
    } catch (e) {
      setError(e instanceof Error ? e.message : '알 수 없는 오류')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Brand />

          <View style={styles.form}>
            <Text style={styles.label}>휴대폰 번호</Text>
            <TextField
              value={phone}
              onChangeText={(value) => setPhone(formatPhone(value))}
              editable={!sent}
              placeholder="010-1234-5678"
              keyboardType="phone-pad"
              autoComplete="tel"
            />

            {sent ? (
              <>
                <Text style={[styles.label, styles.labelGap]}>인증번호</Text>
                <TextField
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6자리"
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  onSubmitEditing={() => {
                    if (code.length === 6) void run(async () => signIn(await auth.verifyOtp(phone, code)))
                  }}
                />
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              {sent ? (
                // 흐름을 끝내는 버튼 — PC 2a 의 '로그인'과 같은 남색.
                <Button
                  label="로그인"
                  tone="navy"
                  loading={busy}
                  disabled={code.length < 6}
                  onPress={() => run(async () => signIn(await auth.verifyOtp(phone, code)))}
                />
              ) : (
                <Button
                  label="인증번호 받기"
                  tone="blue"
                  loading={busy}
                  disabled={phone.replace(/\D/g, '').length < 10}
                  onPress={() =>
                    run(async () => {
                      await auth.sendOtp(phone)
                      setSent(true)
                    })
                  }
                />
              )}

              {sent ? (
                <Button label="번호 다시 입력" tone="outline" onPress={() => { setSent(false); setCode(''); setError(null) }} />
              ) : null}
            </View>
          </View>

          {usingMockAuth ? (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>
                지금은 시험용으로 돌고 있어요. 아무 번호나 넣고 인증번호는 숫자 6자리를 입력하면 들어가요.
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.white },
  flex: { flex: 1 },
  content: { paddingHorizontal: GUTTER + 8, paddingVertical: 32, gap: 36, flexGrow: 1, justifyContent: 'center' },
  brand: { alignItems: 'center', gap: 16 },
  lede: { ...font(15), lineHeight: 22, color: palette.sub, textAlign: 'center' },
  form: { gap: 8 },
  label: { ...font(13, '600'), color: palette.ink },
  labelGap: { marginTop: 8 },
  actions: { marginTop: 12, gap: 10 },
  error: { ...font(13), lineHeight: 19, color: palette.red },
  notice: { padding: GUTTER, backgroundColor: palette.page, borderRadius: 12 },
  noticeText: { ...font(12), lineHeight: 18, color: palette.muted },
})
