import { useCallback, useEffect, useRef, useState } from 'react'
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import type { EventListItem, Monitoring, MonitoringCamera, Store } from '@scene-stealer/api'
import { AddChip, Chip, EmptyCard, GUTTER, MoreButton, Screen, SectionHeader } from '../../components/ui'
import { EventCard } from '../../components/EventRow'
import { CCTV_INSET, CctvIllustration, Gradient, PINK_SWEEP } from '../../components/art'
import { Icon } from '../../components/icons'
import { DemoNotice } from '../../components/DemoNotice'
import { notify } from '../../lib/alert'
import { useApi } from '../../lib/api'
import { config } from '../../lib/config'
import { cameraStateLabel, elapsedLabel, EVENT_NAME, localDate, riskLabel, timeOf } from '../../lib/format'
import { palette } from '../../lib/palette'
import { useStores } from '../../lib/store-context'
import { font } from '../../lib/typography'
import { showLocalNotification } from '../../lib/web-push'

/** 홈 목록은 두 건만 먼저 보인다 (피그마). 나머지는 '전체 기록 보기 (N건 더)' 로 편다. */
const FOLDED = 2

/**
 * 홈 — 피그마 '홈'.
 * 매장 칩 → 감시 상태 카드 → 오늘 위험 신호 → 카메라 상태 → 안내 카드.
 * 감시 상태 카드는 '지금 안전한가' 를 말한다. 카메라가 끊겼거나 PC 가 꺼져 있으면 분홍 카드에 사이렌을 띄우고,
 * 안내 카드도 'AI가 지키고 있어요' 라고 말하지 않는다.
 */
export default function HomeScreen() {
  const api = useApi()
  const { stores, selected, select, refresh } = useStores()
  const [monitoring, setMonitoring] = useState<Monitoring | null>(null)
  const [events, setEvents] = useState<readonly EventListItem[]>([])
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)
  /** 이미 본 경고. 처음 읽은 목록은 본 것으로 친다 — 들어오자마자 옛 경고로 알림이 울리면 안 된다. */
  const seen = useRef<Set<string> | null>(null)

  /**
   * 실서버 시연은 잠금화면 푸시를 쓰지 않는다. 대신 이 페이지가 열려 있는 동안 새로 생긴
   * 미확인 경고를 휴대폰 알림으로 띄운다 (알림을 허용했을 때만 — showLocalNotification 이 확인한다).
   */
  const notifyNew = useCallback((items: readonly EventListItem[]) => {
    if (seen.current === null) {
      seen.current = new Set(items.map((item) => item.id))
      return
    }
    for (const item of items) {
      if (seen.current.has(item.id)) continue
      seen.current.add(item.id)
      if (item.state !== 'unconfirmed') continue
      void showLocalNotification(
        `${selected?.name ?? '매장'} · ${item.cameraName ?? '카메라'}`,
        `${EVENT_NAME}이 감지되었습니다 · 위험도 ${riskLabel[item.risk]}`,
        item.id,
      )
    }
  }, [selected?.name])

  const load = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!selected) return
    if (!options.silent) setBusy(true)
    try {
      const [status, page] = await Promise.all([
        api.getMonitoring(selected.id),
        api.listEvents(selected.id, { date: localDate(new Date().toISOString()) }),
      ])
      setMonitoring(status)
      setEvents(page.items)
      if (config.live) notifyNew(page.items)
    } catch {
      // 조용한 새로고침이 실패해도 지금 화면은 그대로 둔다. 당겨서 새로고침하면 다시 묻는다.
    } finally {
      if (!options.silent) setBusy(false)
    }
  }, [api, selected, notifyNew])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  // 매장을 바꾸면 그 매장의 목록을 처음부터 본 것으로 치고, 편 목록도 접는다.
  useEffect(() => {
    seen.current = null
    setExpanded(false)
    setMonitoring(null)
    setEvents([])
  }, [selected?.id])

  // 실서버 시연 — 서버 AI 판정은 몇십 초 간격으로 온다. 페이지가 열려 있는 동안 조용히 다시 읽는다.
  // 다른 앱으로 잠깐 가 있어도 돌게 둔다 — 그때 오는 경고가 알림의 쓸모다 (화면이 꺼지면 브라우저가 멈춘다).
  useEffect(() => {
    if (!config.live) return
    const timer = setInterval(() => void load({ silent: true }), 10_000)
    return () => clearInterval(timer)
  }, [load])

  const unconfirmed = events.filter((e) => e.state === 'unconfirmed').length
  const pcOffline = monitoring?.device?.online === false
  const shown = expanded ? events : events.slice(0, FOLDED)

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={() => { void refresh(); void load() }} />}
      >
        <DemoNotice />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.storeScroller} contentContainerStyle={styles.storeChips}>
          {/* 문제가 있는 매장(PC 꺼짐)은 이름 뒤에 빨간 점. */}
          {stores.map((store) => (
            <Chip
              key={store.id}
              label={store.name}
              selected={store.id === selected?.id}
              dot={store.device?.online === false ? 'danger' : undefined}
              dotPosition="after"
              onPress={() => select(store.id)}
            />
          ))}
          <AddChip
            label="매장 추가"
            onPress={() =>
              notify('매장 추가는 PC 앱에서 해요', '매장 PC에 씬스틸러를 설치하고 이 계정으로 로그인하면 여기에 매장이 생깁니다.')
            }
          />
        </ScrollView>

        <StatusCard store={selected} monitoring={monitoring} />

        <SectionHeader
          title="오늘 위험 신호"
          right={unconfirmed > 0 ? <Text style={styles.unconfirmed}>미확인 {unconfirmed}</Text> : null}
        />
        <View style={styles.events}>
          {events.length === 0 ? (
            // PC 가 꺼져 있으면 '위험 신호 없음'은 거짓말이다. 볼 수 없었을 뿐이다.
            <EmptyCard text={pcOffline ? 'PC가 꺼져 있던 동안은 기록이 없어요' : '오늘은 아직 위험 신호가 없어요'} />
          ) : (
            shown.map((event) => (
              <EventCard key={event.id} event={event} onPress={() => router.push(`/events/${event.id}`)} />
            ))
          )}
          {events.length > FOLDED ? (
            <MoreButton
              label={expanded ? '접기' : `전체 기록 보기 (${events.length - FOLDED}건 더)`}
              icon={expanded ? 'chevronUp' : 'chevronDown'}
              onPress={() => setExpanded((open) => !open)}
            />
          ) : null}
        </View>

        <SectionHeader title="카메라 상태" right="실시간 영상은 PC에서만 확인 가능해요" />
        <View style={styles.cameras}>
          {(monitoring?.cameras ?? []).length === 0 ? (
            <Text style={styles.noCamera}>
              {!monitoring ? '카메라 상태를 불러오는 중…' : pcOffline ? 'PC가 꺼져 있어 카메라 상태를 알 수 없어요' : '연결된 카메라가 없어요'}
            </Text>
          ) : (
            monitoring!.cameras.map((camera) => <CameraChip key={camera.id} camera={camera} />)
          )}
        </View>

        <GuardBanner watching={!pcOffline && (monitoring?.monitoringCount ?? 1) > 0} />
      </ScrollView>
    </Screen>
  )
}

/** 카메라 칩 — 연결됨 초록 점, 끊김 빨간 테두리 '창고 · 끊김 13분', 멈춤 회색 점. */
const CameraChip = ({ camera }: { camera: MonitoringCamera }) => {
  if (camera.state === 'connected') return <Chip variant="outline" label={camera.name} dot="ok" />
  if (camera.state === 'unknown') return <Chip variant="outline" label={`${camera.name} · ${cameraStateLabel.unknown}`} dot="idle" />
  const since = camera.disconnectedForSec ? ` ${elapsedLabel(camera.disconnectedForSec)}` : ''
  return <Chip variant="outline" tone="danger" label={`${camera.name} · ${cameraStateLabel[camera.state]}${since}`} dot="danger" />
}

/**
 * 감시 상태 카드 — '감시중 · 카메라 4/5대' + 빨간 한 줄(끊긴 카메라 · 꺼진 PC) + 회색 한 줄(마지막 분석 · 알림 지연).
 * 문제가 있으면 분홍 바탕에 사이렌, 없으면 흰 바탕에 초록 방패.
 */
const StatusCard = ({ store, monitoring }: { store: Store | null; monitoring: Monitoring | null }) => {
  const pcOffline = monitoring?.device?.online === false
  const broken = monitoring?.cameras.filter((c) => c.state !== 'connected' && c.state !== 'unknown') ?? []
  const idle = monitoring !== null && monitoring.totalCount > 0 && monitoring.monitoringCount === 0
  const problem = pcOffline || broken.length > 0 || idle

  const heartbeat = monitoring?.device?.lastHeartbeatAt ?? store?.device?.lastHeartbeatAt ?? null
  const first = broken[0]
  const alertLine = pcOffline
    ? `PC 꺼짐${heartbeat ? ` ${elapsedLabel((Date.now() - Date.parse(heartbeat)) / 1000)}` : ''} → 매장 PC를 켜 주세요`
    : first
      ? broken.length === 1
        ? `'${first.name}' 카메라 ${cameraStateLabel[first.state]}${first.disconnectedForSec ? ` ${elapsedLabel(first.disconnectedForSec)}` : ''} → PC에서 확인 필요`
        : `'${first.name}' 외 카메라 ${broken.length - 1}대 연결 문제 → PC에서 확인 필요`
      : idle
        ? '보고 있는 카메라가 없어요 → PC에서 감시를 켜 주세요'
        : null

  return (
    <View style={[styles.status, problem ? styles.statusAlert : styles.statusCalm]}>
      <View style={[styles.statusIcon, { backgroundColor: problem ? palette.pinkCircle : SUCCESS_SOFT }]}>
        <Icon name={problem ? 'siren' : 'shieldCheck'} size={24} color={problem ? palette.pinkIcon : palette.green} inner={problem ? palette.pinkCircle : SUCCESS_SOFT} />
      </View>
      <View style={styles.statusBody}>
        <Text style={styles.statusTitle} numberOfLines={1}>
          {monitoring === null
            ? '감시 상태 확인 중…'
            : pcOffline
              ? 'PC가 꺼져 있어 감시가 멈췄어요'
              : `감시중 · 카메라 ${monitoring.monitoringCount}/${monitoring.totalCount}대`}
        </Text>
        {alertLine ? <Text style={styles.statusAlertLine} numberOfLines={1}>{alertLine}</Text> : null}
        <Text style={styles.statusInfo} numberOfLines={1}>
          마지막 AI 분석 {monitoring?.lastAnalyzedAt ? timeOf(monitoring.lastAnalyzedAt) : '없음'} · 알림 지연 최대{' '}
          {elapsedLabel(monitoring?.segmentSeconds ?? store?.segmentSeconds ?? 0)}
        </Text>
      </View>
    </View>
  )
}

/** 안내 카드 — '지금 이 순간도 AI가 매장을 지키고 있어요.' PC 가 꺼져 있으면 그렇게 말하지 않는다. */
const GuardBanner = ({ watching }: { watching: boolean }) => (
  <View style={styles.banner}>
    <Gradient stops={PINK_SWEEP} />
    <View style={styles.bannerIcon}>
      <Icon name="shieldCheck" size={22} color={palette.pinkIcon} inner={palette.pinkCircle} />
    </View>
    <View style={styles.bannerBody}>
      <Text style={styles.bannerSmall}>{watching ? '지금 이 순간도' : '지금은'}</Text>
      <Text style={styles.bannerTitle}>{watching ? 'AI가 매장을 지키고 있어요.' : '감시가 멈춰 있어요.'}</Text>
      <Text style={styles.bannerSub} numberOfLines={1}>
        {watching ? '이상행동을 빠르게 감지하고 알림으로 알려드려요' : '매장 PC와 카메라가 켜지면 AI가 다시 지켜요'}
      </Text>
    </View>
    <CctvIllustration style={styles.bannerArt} />
  </View>
)

/** 문제가 없을 때의 방패 동그라미 — success/50 */
const SUCCESS_SOFT = '#EEFBF3'

const SHADOW_SOFT = '0 2px 8px rgba(20, 35, 61, 0.06)'

const styles = StyleSheet.create({
  content: { paddingTop: GUTTER, paddingHorizontal: GUTTER, paddingBottom: 28 },
  // 칩 줄은 화면 끝까지 밀리게 좌우 여백 밖으로 편다.
  storeScroller: { marginHorizontal: -GUTTER, flexGrow: 0 },
  storeChips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: GUTTER },

  status: {
    marginTop: 16,
    marginBottom: 20,
    // 높이는 글 줄 수가 정한다 — 세 줄이면 피그마의 88, 문제 없을 때(두 줄)는 그만큼 낮다.
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
    paddingLeft: 10,
    paddingRight: 12,
    paddingVertical: 10,
    borderRadius: 12,
    boxShadow: SHADOW_SOFT,
  },
  statusAlert: { backgroundColor: palette.pinkSurface },
  statusCalm: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.border },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  statusBody: { flex: 1 },
  statusTitle: { ...font(16, '700'), lineHeight: 22, color: palette.navy },
  statusAlertLine: { ...font(12, '500'), lineHeight: 17, color: palette.red, marginTop: 4 },
  statusInfo: { ...font(12), lineHeight: 17, color: palette.muted, marginTop: 7 },

  unconfirmed: { ...font(16, '700'), lineHeight: 22, color: palette.red },
  events: { marginTop: 12, marginBottom: 20, gap: 10 },

  cameras: { marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  noCamera: { ...font(13), color: palette.muted },

  banner: {
    marginTop: 20,
    height: 96,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 10,
    paddingRight: 16,
    gap: 16,
    boxShadow: SHADOW_SOFT,
  },
  bannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: palette.pinkCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerBody: { flex: 1, gap: 1 },
  bannerSmall: { ...font(11), lineHeight: 15, color: palette.muted },
  bannerTitle: { ...font(16, '700'), lineHeight: 22, color: palette.navy },
  bannerSub: { ...font(11), lineHeight: 15, color: palette.muted },
  // 피그마: 카메라 오른쪽 끝이 카드 끝에서 17, 위가 16.
  bannerArt: { position: 'absolute', right: 17 - CCTV_INSET, top: 16 - CCTV_INSET },
})
