import { useCallback, useEffect, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import type { NotificationSettings, QuietHours, Risk } from '@scene-stealer/api'
import { GUTTER, OptionRow, RowGroup, Screen, Section, SettingsRow, Sheet, Toggle } from '../../components/ui'
import { notify } from '../../lib/alert'
import { useApi } from '../../lib/api'
import { config, usingMockApi } from '../../lib/config'
import { useSession } from '../../lib/session'
import { useStores } from '../../lib/store-context'
import { elapsedLabel, riskLabel } from '../../lib/format'
import { registerForPush, sendLocalTestNotification } from '../../lib/notifications'
import { palette } from '../../lib/palette'
import { font } from '../../lib/typography'
import { enableWebNotifications, isWeb, needsHomeScreenInstall, showLocalNotification } from '../../lib/web-push'

const RISKS: readonly Risk[] = ['low', 'medium', 'high']

const riskChoice = (risk: Risk): string => (risk === 'high' ? '높음만' : `${riskLabel[risk]} 이상`)

/** 수면 구간을 처음 켤 때 쓰는 값 — 피그마의 '01:00 - 07:00'. */
const SLEEP_DEFAULT = { start: '01:00', end: '07:00' } as const

const shiftHour = (value: string, delta: number): string => {
  const hour = (Number(value.slice(0, 2)) + delta + 24) % 24
  return `${String(hour).padStart(2, '0')}:00`
}

/** '09:00' → '09' — 피그마의 '09 - 21시'. */
const hourOnly = (value: string): string => value.slice(0, 2)

type SheetName = 'risk' | 'sleep' | 'hours' | null

/**
 * 설정 — 피그마 '설정'. 알림 · 내 매장 · 매장 상세 세 묶음.
 * 피그마의 '위험 종류별 알림 6/7'은 없다 — 종류를 나누지 않으므로 PC 2g 처럼 '어떤 위험부터 알릴지' 한 줄이다.
 * 카메라 추가 · 비밀번호 · 이름 순서 · PC 재시작은 매장 네트워크가 필요해 PC 앱에서만 된다. 여기서는 안내만 한다.
 */
export default function SettingsScreen() {
  const api = useApi()
  const { signOut } = useSession()
  const { stores, selected, select } = useStores()
  const [settings, setSettings] = useState<NotificationSettings | null>(null)
  const [sheet, setSheet] = useState<SheetName>(null)
  const [sending, setSending] = useState(false)

  const load = useCallback(async () => {
    if (!selected) return
    try {
      setSettings(await api.getNotificationSettings(selected.id))
    } catch {
      // 못 읽으면 값 칸을 비워 둔다. 다시 들어오면 또 묻는다.
    }
  }, [api, selected])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  // 앱(네이티브)은 들어오면 이 기기를 푸시 받을 곳으로 등록한다. 웹은 '테스트 알림 보내기'를 누를 때 권한을 묻는다.
  useEffect(() => {
    if (isWeb) return
    void (async () => {
      const result = await registerForPush()
      if (!result.ok) return
      await api.registerPushDevice('expo', result.token).catch(() => undefined)
    })()
  }, [api])

  /** 화면을 먼저 바꾸고 서버에 보낸다. 실패하면 되돌린다. */
  const save = useCallback(
    async (next: NotificationSettings) => {
      if (!selected || !settings) return
      const previous = settings
      setSettings(next)
      try {
        setSettings(await api.putNotificationSettings(selected.id, next))
      } catch {
        setSettings(previous)
        notify('저장하지 못했어요', '잠시 후 다시 시도해 주세요.')
      }
    },
    [api, selected, settings],
  )

  const saveQuiet = (patch: Partial<QuietHours>) => {
    if (settings) void save({ ...settings, quietHours: { ...settings.quietHours, ...patch } })
  }

  /**
   * 웹은 브라우저 알림을 바로 하나 띄운다 — 이 브라우저가 실제로 받는 알림이 그것이다.
   * (서버의 테스트 발송은 앱 푸시로 가서 브라우저에는 오지 않는다.) 누른 순간이라 권한도 여기서 묻는다.
   */
  const testOnWeb = useCallback(async () => {
    if (typeof Notification === 'undefined' && needsHomeScreenInstall()) {
      return notify('홈 화면에 추가해 주세요', "아이폰은 사파리 공유 버튼 → '홈 화면에 추가'한 앱에서 알림을 받을 수 있어요.")
    }
    const state = await enableWebNotifications()
    if (state.kind === 'denied') return notify('알림이 꺼져 있어요', '브라우저의 사이트 설정에서 알림을 허용해 주세요.')
    if (state.kind === 'unsupported') return notify('알림을 띄울 수 없어요', state.reason)
    const shown = await showLocalNotification(
      `${selected?.name ?? '씬스틸러'} · 테스트 알림`,
      '위험 신호가 생기면 이렇게 알려 드려요.',
      '',
    )
    if (!shown) notify('알림을 띄울 수 없어요', '브라우저의 사이트 설정에서 알림을 허용해 주세요.')
  }, [selected?.name])

  const test = useCallback(async () => {
    if (!selected || sending) return
    setSending(true)
    try {
      if (isWeb) return await testOnWeb()
      await api.sendTestNotification(selected.id)
      // 가짜 서버는 푸시를 보내지 못한다 — 대신 기기 안에서 같은 모양의 알림을 띄운다 (ev-1 은 가짜 서버의 이벤트).
      if (usingMockApi) await sendLocalTestNotification('ev-1')
      notify('테스트 알림을 보냈어요', '잠시 뒤 알림이 오면 탭해 보세요. 상세 화면으로 이동합니다.')
    } catch {
      notify('보내지 못했어요', '서버에 연결할 수 없어요.')
    } finally {
      setSending(false)
    }
  }, [api, selected, sending, testOnWeb])

  const quiet = settings?.quietHours
  const sleepOn = Boolean(quiet?.sleepStart && quiet?.sleepEnd)
  const pcOnly = (title: string) => () =>
    notify(title, '매장 네트워크가 필요해 PC 앱에서만 할 수 있어요. 매장 PC의 씬스틸러에서 바꿔 주세요.')

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>설정</Text>

        <Section caption="알림">
          <RowGroup>
            <SettingsRow
              icon="bell"
              label="위험도별 알림"
              value={settings ? riskChoice(settings.minRisk) : ''}
              onPress={() => setSheet('risk')}
            />
            <SettingsRow
              icon="moon"
              label="방해금지 (수면)"
              value={!settings ? '' : sleepOn ? `${quiet!.sleepStart} - ${quiet!.sleepEnd} 켬` : '꺼짐'}
              onPress={() => setSheet('sleep')}
            />
            <SettingsRow
              icon="alarm"
              label="응급 높음은 방해금지 무시"
              right={
                <Toggle
                  label="응급 높음은 방해금지 무시"
                  value={quiet?.overrideDndForHigh ?? false}
                  onChange={(next) => saveQuiet({ overrideDndForHigh: next })}
                />
              }
              chevron={false}
            />
            <SettingsRow icon="phoneDevice" label="테스트 알림 보내기" value={sending ? '보내는 중…' : '보내기'} onPress={() => void test()} />
          </RowGroup>
        </Section>

        <Section caption="내 매장" style={styles.section}>
          <RowGroup>
            {stores.map((store) => {
              const online = store.device?.online === true
              const since = store.device?.lastHeartbeatAt
                ? elapsedLabel((Date.now() - Date.parse(store.device.lastHeartbeatAt)) / 1000)
                : null
              const current = store.id === selected?.id
              return (
                <SettingsRow
                  key={store.id}
                  icon="store"
                  label={store.name}
                  sub={online ? `PC 연결됨 · 카메라 ${store.cameraCount}대` : `PC 꺼짐${since ? ` (${since})` : ''} · 감시 중단`}
                  subTone={online ? 'muted' : 'danger'}
                  // 지금 보고 있는 매장엔 꺾쇠가 없다 (피그마). 다른 매장을 누르면 그 매장으로 바꾼다.
                  onPress={current ? undefined : () => select(store.id)}
                />
              )
            })}
            <SettingsRow
              icon="plusCircle"
              label="매장 추가 (PC에서 QR 스캔)"
              chevron={false}
              onPress={() =>
                notify('매장 추가는 PC 앱에서 해요', '매장 PC에 씬스틸러를 설치하고 이 계정으로 로그인하면 여기에 매장이 생겨요.')
              }
            />
          </RowGroup>
        </Section>

        <Section caption="매장 상세" style={styles.section}>
          <RowGroup>
            <SettingsRow
              icon="pin"
              label="매장 주소 (신고용)"
              value={selected?.address ?? '없음'}
              onPress={() =>
                notify(
                  selected?.address ? '매장 주소' : '매장 주소가 없어요',
                  `${selected?.address ? `${selected.address}\n\n` : ''}112 신고 때 읽어 드릴 주소예요. 주소는 매장 PC의 씬스틸러 설정에서 바꿀 수 있어요.`,
                )
              }
            />
            <SettingsRow
              icon="clock"
              label="운영 시간 (알림 줄이기)"
              value={selected?.opensAt && selected.closesAt ? `${hourOnly(selected.opensAt)} - ${hourOnly(selected.closesAt)}시` : '정하지 않음'}
              onPress={() => setSheet('hours')}
            />
            <SettingsRow icon="camera" label="카메라 이름순서" onPress={pcOnly('카메라 이름 · 순서')} />
            <SettingsRow icon="monitor" label="PC 앱 원격 재시작" onPress={pcOnly('PC 앱 재시작')} />
          </RowGroup>
        </Section>

        <Text style={styles.footer}>
          카메라 추가, 비밀번호 등은 PC 앱에서만 (같은 네트워크 필요){'\n'}*모바일은 안내만
        </Text>

        {/* 실서버 시연은 데모 계정 하나로만 연다 — 로그아웃하면 다시 들어올 길이 없다. */}
        {config.live ? null : (
          <Pressable accessibilityRole="button" onPress={() => void signOut()} style={styles.signOut} hitSlop={8}>
            <Text style={styles.signOutText}>로그아웃</Text>
          </Pressable>
        )}
      </ScrollView>

      <Sheet visible={sheet === 'risk'} title="위험도별 알림" onClose={() => setSheet(null)}>
        <Text style={styles.sheetHint}>고른 위험도 이상만 알려 드려요.</Text>
        <RowGroup>
          {RISKS.map((risk) => (
            <OptionRow
              key={risk}
              label={riskChoice(risk)}
              selected={settings?.minRisk === risk}
              onPress={() => {
                if (settings) void save({ ...settings, minRisk: risk })
                setSheet(null)
              }}
            />
          ))}
        </RowGroup>
      </Sheet>

      <Sheet visible={sheet === 'sleep'} title="방해금지 (수면)" onClose={() => setSheet(null)}>
        <Text style={styles.sheetHint}>자는 동안에는 알림을 줄여요. '응급 높음'은 위 설정을 따라요.</Text>
        <RowGroup>
          <SettingsRow
            icon="moon"
            label="방해금지 켜기"
            chevron={false}
            right={
              <Toggle
                label="방해금지 켜기"
                value={sleepOn}
                onChange={(next) =>
                  saveQuiet(
                    next
                      ? { sleepStart: quiet?.sleepStart ?? SLEEP_DEFAULT.start, sleepEnd: quiet?.sleepEnd ?? SLEEP_DEFAULT.end }
                      : { sleepStart: null, sleepEnd: null },
                  )
                }
              />
            }
          />
          {sleepOn ? (
            <View style={styles.steppers}>
              <Stepper caption="시작" value={quiet!.sleepStart!} onChange={(sleepStart) => saveQuiet({ sleepStart })} />
              <Stepper caption="종료" value={quiet!.sleepEnd!} onChange={(sleepEnd) => saveQuiet({ sleepEnd })} />
            </View>
          ) : null}
        </RowGroup>
      </Sheet>

      <Sheet visible={sheet === 'hours'} title="운영 시간" onClose={() => setSheet(null)}>
        <Text style={styles.sheetHint}>
          {selected?.opensAt && selected.closesAt
            ? `${selected.opensAt} - ${selected.closesAt} · 시간은 매장 PC의 씬스틸러에서 바꿀 수 있어요.`
            : '운영 시간은 매장 PC의 씬스틸러에서 정할 수 있어요.'}
        </Text>
        <RowGroup>
          <SettingsRow
            icon="clock"
            label="영업 시간엔 '높음'만 알림"
            chevron={false}
            right={
              <Toggle
                label="영업 시간엔 '높음'만 알림"
                value={quiet?.businessHoursHighOnly ?? false}
                onChange={(next) => saveQuiet({ businessHoursHighOnly: next })}
              />
            }
          />
        </RowGroup>
      </Sheet>
    </Screen>
  )
}

/** 네이티브 시간 선택기를 새로 붙이지 않고 1시간 단위로 움직인다 — 수면 구간엔 이 정도면 충분하다. */
const Stepper = ({ caption, value, onChange }: { caption: string; value: string; onChange: (next: string) => void }) => (
  <View style={styles.stepper}>
    <Text style={styles.stepperCaption}>{caption}</Text>
    <View style={styles.stepperControls}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${caption} 1시간 빼기`} hitSlop={8} onPress={() => onChange(shiftHour(value, -1))}>
        <Text style={styles.stepperSign}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`${caption} 1시간 더하기`} hitSlop={8} onPress={() => onChange(shiftHour(value, 1))}>
        <Text style={styles.stepperSign}>+</Text>
      </Pressable>
    </View>
  </View>
)

const styles = StyleSheet.create({
  content: { paddingTop: GUTTER, paddingHorizontal: GUTTER, paddingBottom: 28 },
  title: { ...font(18, '700'), lineHeight: 24, color: palette.ink, marginBottom: 22 },
  section: { marginTop: 24 },
  footer: { ...font(12), lineHeight: 17, color: palette.muted, textAlign: 'center', marginTop: 18 },
  signOut: { alignSelf: 'center', marginTop: 16, paddingVertical: 4 },
  signOutText: { ...font(13, '500'), color: palette.muted, textDecorationLine: 'underline' },

  sheetHint: { ...font(13), lineHeight: 19, color: palette.sub },
  steppers: { flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  stepper: { flex: 1, gap: 6 },
  stepperCaption: { ...font(12), color: palette.muted },
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
  },
  stepperSign: { ...font(20, '600'), lineHeight: 24, color: palette.blue },
  stepperValue: { ...font(15, '600'), color: palette.ink },
})
