import { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native'
import * as Clipboard from 'expo-clipboard'
import { router, useLocalSearchParams } from 'expo-router'
import { VideoView, useVideoPlayer } from 'expo-video'
import { useEvent } from 'expo'
import type { EventDetail, EventState, NearbyCamera, Risk } from '@scene-stealer/api'
import { AppHeader, Button, Card, EmptyCard, GUTTER, RowGroup, Sheet, TextLink, Tile } from '../../components/ui'
import { Icon } from '../../components/icons'
import { notify } from '../../lib/alert'
import { useApi } from '../../lib/api'
import { useStores } from '../../lib/store-context'
import { EVENT_NAME, clockOf, durationLabel, riskLabel, timeOf, whenLabel } from '../../lib/format'
import { palette } from '../../lib/palette'
import { font } from '../../lib/typography'
import { reportAck } from '../../lib/web-push'

/** 알림으로 바로 열렸으면 돌아갈 화면이 없다 — 그때는 홈으로. */
const goBack = (): void => {
  if (router.canGoBack()) router.back()
  else router.replace('/')
}

/** 위험도 색 — 높음은 피그마의 빨강, 보통은 디자인시스템의 로고 노랑, 낮음은 회색. */
const RISK_COLOR: Record<Risk, { fill: string; text: string }> = {
  high: { fill: palette.red, text: palette.red },
  medium: { fill: '#F9A403', text: '#B86A00' },
  low: { fill: palette.muted, text: palette.muted },
}

type ListName = 'segments' | 'nearby'

/**
 * 알림 상세 — 피그마 '알림 상세'.
 * 푸시를 탭하면 여기로 온다. 첫 화면에서 판단하고 전화까지 가는 것이 목표라
 * 영상 → 위험 구간 → 무슨 일·어디·언제 → 112 → 확인 순서로 쌓았다.
 * '전후 영상 보기 · 다른 카메라'는 칸을 누르면 아래에 목록을 편다 — 늘 펼쳐 두면 확인 버튼이 화면 밖으로 밀린다.
 */
export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const api = useApi()
  const { selected: store, refresh: refreshStores } = useStores()
  const [event, setEvent] = useState<EventDetail | null>(null)
  const [nearby, setNearby] = useState<readonly NearbyCamera[]>([])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [source, setSource] = useState<string | null>(null)
  const [openList, setOpenList] = useState<ListName | null>(null)
  const [calling, setCalling] = useState(false)
  const videoRef = useRef<VideoView>(null)

  useEffect(() => {
    void (async () => {
      if (!id) return
      try {
        const detail = await api.getEvent(id)
        setEvent(detail)
        setSource(detail.clipUrl)
        setNearby(await api.getNearbyCameras(id).catch(() => []))
      } catch (e) {
        setError(e instanceof Error ? e.message : '불러오지 못했어요')
      }
    })()
  }, [api, id])

  /** 위험 클립은 소리 없이 반복 재생 — 사장님이 다시 누를 필요가 없게. */
  const player = useVideoPlayer(source, (p) => {
    p.loop = true
    p.muted = true
    p.play()
  })

  // 영상이 안 나오면 검은 네모만 남는다. 못 불러왔다는 사실을 말해 준다.
  const { status } = useEvent(player, 'statusChange', { status: player.status })
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })
  /** 사장님이 직접 멈췄으면 다시 틀지 않는다. */
  const pausedByUser = useRef(false)

  // 웹의 expo-video 는 화면에 붙기 전에 부른 play() 를 버린다 — 영상이 준비되면 그때 튼다.
  useEffect(() => {
    if (status === 'readyToPlay' && !pausedByUser.current) player.play()
  }, [status, player])

  const setState = useCallback(
    async (state: EventState) => {
      if (!event || saving) return
      setSaving(true)
      try {
        // 서버는 목록 모양만 돌려준다 (점수·클립·조각 없음). 통째로 바꾸면 상세가 비어 화면이 깨진다 — state 만 합친다.
        const updated = await api.setEventState(event.id, state)
        setEvent((current) => (current ? { ...current, state: updated.state } : current))
        // 홈 · 기록의 미확인 수가 매장 목록에서 나온다 — 처리한 만큼 바로 줄어야 한다.
        void refreshStores({ silent: true })
        if (state !== 'unconfirmed') void reportAck(event.id, state)
      } catch {
        notify('저장하지 못했어요', '잠시 후 다시 시도해 주세요.')
      } finally {
        setSaving(false)
      }
    },
    [api, event, refreshStores, saving],
  )

  /** 112 — 전화를 걸면서 주소 카드를 띄워 둔다. 통화 중에 앱으로 돌아오면 읽어 줄 내용이 그대로 있다. */
  const call112 = useCallback(async () => {
    setCalling(true)
    const url = 'tel:112'
    try {
      if (await Linking.canOpenURL(url)) await Linking.openURL(url)
    } catch {
      // 전화 기능이 없는 기기(컴퓨터 브라우저)면 카드만 남는다.
    }
  }, [])

  /** 공유 창을 띄운다. 공유 창이 없는 브라우저면 클립 링크를 복사해 둔다. */
  const share = useCallback(async () => {
    if (!event?.clipUrl) return
    const message = `${store?.name ?? ''} ${event.cameraName} · ${whenLabel(event.startedAt)}\n${EVENT_NAME} 감지\n${event.clipUrl}`
    try {
      await Share.share({ message })
    } catch (shareError) {
      // 사용자가 공유 창을 닫은 것은 실패가 아니다.
      if (shareError instanceof Error && shareError.name === 'AbortError') return
      await Clipboard.setStringAsync(event.clipUrl)
      notify('클립 링크를 복사했어요', '메신저에 붙여 넣어 보낼 수 있어요.')
    }
  }, [event, store])

  const toggle = (list: ListName) => setOpenList((current) => (current === list ? null : list))

  if (error || !event) {
    return (
      <View style={styles.screen}>
        <AppHeader />
        <SubHeader title={store?.name ?? '알림 상세'} />
        <View style={styles.pad}>
          {error ? <EmptyCard text={error} /> : <ActivityIndicator color={palette.blue} style={styles.loading} />}
        </View>
      </View>
    )
  }

  const color = RISK_COLOR[event.risk]

  return (
    <View style={styles.screen}>
      <AppHeader />
      <ScrollView contentContainerStyle={styles.content}>
        <SubHeader title={store?.name ?? '알림 상세'} onShare={event.clipUrl ? () => void share() : undefined} />

        <View style={styles.player}>
          <VideoView
            ref={videoRef}
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            fullscreenOptions={{ enable: true, orientation: 'landscape' }}
          />
          {/* 누르면 멈추고 다시 누르면 재생 — 멈췄을 때만 가운데 재생 단추가 보인다. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? '일시 정지' : '재생'}
            onPress={() => {
              pausedByUser.current = isPlaying
              if (isPlaying) player.pause()
              else player.play()
            }}
            style={styles.playerCover}
          >
            {status === 'error' || !source ? (
              <Text style={styles.playerNote}>
                {source ? '영상을 불러오지 못했어요 — 인터넷 연결을 확인해 주세요' : '이 경고에는 남은 영상이 없어요'}
              </Text>
            ) : status === 'loading' ? (
              <ActivityIndicator color={palette.white} />
            ) : !isPlaying ? (
              <View style={styles.playButton}>
                <Icon name="play" size={26} color={palette.white} />
              </View>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="전체화면으로 보기"
            hitSlop={8}
            onPress={() => void videoRef.current?.enterFullscreen()}
            style={styles.expand}
          >
            <Icon name="expand" size={18} color={palette.white} />
          </Pressable>
        </View>

        <RiskRange event={event} segmentSeconds={store?.segmentSeconds ?? 60} />

        <View style={styles.info}>
          <View style={styles.infoHead}>
            <View style={[styles.tag, { backgroundColor: color.fill }]}>
              <Icon name="warning" size={14} color={palette.white} />
              <Text style={styles.tagText}>{EVENT_NAME}</Text>
            </View>
            <Text style={[styles.riskText, { color: color.text }]}>위험도 {riskLabel[event.risk]}</Text>
          </View>
          <Text style={styles.where}>
            {event.cameraName} · {whenLabel(event.startedAt)} ({durationLabel(event.durationSec)})
          </Text>
          <View style={styles.desc}>
            <Text style={styles.descText}>{describe(event)}</Text>
          </View>
        </View>

        <Button tone="danger" icon="phone" label="112 전화하기" onPress={() => void call112()} style={styles.call} />
        <Text style={styles.callCaption}>통화 중에도 볼 수 있게 매장 주소 · 시각 카드를 띄워 둬요</Text>

        <View style={styles.tiles}>
          <Tile icon="playOutline" label="전후 영상 보기" active={openList === 'segments'} onPress={() => toggle('segments')} />
          <Tile icon="camera" label="다른 카메라" active={openList === 'nearby'} onPress={() => toggle('nearby')} />
          <Tile icon="upload" label="클립 저장·공유" disabled={!event.clipUrl} onPress={() => void share()} />
        </View>

        {openList ? (
          <View style={styles.listBox}>
            {openList === 'segments' ? (
              event.segments.length === 0 ? (
                <EmptyCard text="보관된 앞뒤 영상이 없어요" />
              ) : (
                <RowGroup>
                  {event.segments.map((segment) => (
                    <ListButton
                      key={segment.videoId}
                      label={`${clockOf(segment.startedAt)} 부터`}
                      meta={segment.playbackUrl ? (source === segment.playbackUrl ? '보는 중' : '이 영상 보기') : '재생 주소 없음'}
                      active={source === segment.playbackUrl}
                      onPress={() => segment.playbackUrl && setSource(segment.playbackUrl)}
                    />
                  ))}
                </RowGroup>
              )
            ) : null}
            {openList === 'nearby' ? (
              nearby.length === 0 ? (
                <EmptyCard text="같은 시각에 남은 다른 카메라 영상이 없어요" />
              ) : (
                <RowGroup>
                  {nearby.map((camera) => (
                    <ListButton
                      key={camera.cameraId}
                      label={camera.name}
                      meta={source === camera.playbackUrl ? '보는 중' : camera.offsetSec === 0 ? '같은 시각' : `${Math.round(camera.offsetSec)}초 차이`}
                      active={source === camera.playbackUrl}
                      onPress={() => setSource(camera.playbackUrl)}
                    />
                  ))}
                </RowGroup>
              )
            ) : null}
          </View>
        ) : null}

        {/* 확인(남색 채움)과 오탐(밑줄 글자)을 모양으로 갈라 잘못 누르지 않게 한다. */}
        <Button
          tone="navy"
          icon="checkCircle"
          label={event.state === 'confirmed' ? '확인 완료' : '확인했어요'}
          disabled={event.state === 'confirmed'}
          loading={saving}
          onPress={() => void setState('confirmed')}
          style={styles.confirm}
        />
        <View style={styles.fp}>
          <TextLink
            label={event.state === 'false_positive' ? '오탐으로 신고했어요' : '문제 없음 (오탐신고)'}
            disabled={event.state === 'false_positive' || saving}
            onPress={() => void setState('false_positive')}
          />
        </View>
        {event.state !== 'unconfirmed' ? (
          <Text style={styles.resolved}>
            {event.state === 'false_positive' ? '오탐으로 처리했어요' : '확인 처리했어요'} · PC 앱에도 같이 반영돼요
          </Text>
        ) : null}
      </ScrollView>

      <Sheet visible={calling} title="112 신고" onClose={() => setCalling(false)}>
        <Card style={styles.callCard}>
          <Text style={styles.callLabel}>매장 주소</Text>
          <Text style={styles.callAddress}>{store?.address ?? '주소가 없어요 — 매장 PC의 씬스틸러에서 넣어 주세요'}</Text>
          <View style={styles.callDivider} />
          <Text style={styles.callLine}>
            {store?.name ?? '매장'} · {event.cameraName}
          </Text>
          <Text style={styles.callLine}>
            {whenLabel(event.startedAt)} 부터 {durationLabel(event.durationSec)}
          </Text>
          <Text style={styles.callLine}>{EVENT_NAME} · 위험도 {riskLabel[event.risk]}</Text>
        </Card>
        <Button tone="danger" icon="phone" label="112에 전화 걸기" onPress={() => void call112()} />
      </Sheet>
    </View>
  )
}

/** 설명 칸 — AI 는 글로 된 설명을 주지 않는다. 점수와 길이로 무엇을 봤는지 말한다. 메모가 있으면 덧붙인다. */
const describe = (event: EventDetail): string => {
  const score =
    typeof event.anomalyScore === 'number' && typeof event.anomalyThreshold === 'number'
      ? `
이상 점수 ${event.anomalyScore.toFixed(2)} · 알림 기준 ${event.anomalyThreshold.toFixed(2)} 이상`
      : ''
  const memo = event.memo?.trim() ? `\n메모: ${event.memo.trim()}` : ''
  return `AI가 평소와 다른 움직임을 ${durationLabel(event.durationSec)} 동안 감지했어요.${score}${memo}`
}

/** 머리 아래 줄 — 왼쪽 '‹ 매장 이름', 오른쪽 '공유' 단추. */
const SubHeader = ({ title, onShare }: { title: string; onShare?: () => void }) => (
  <View style={styles.subHeader}>
    <Pressable accessibilityRole="button" accessibilityLabel="뒤로" hitSlop={12} onPress={goBack} style={styles.back}>
      <Icon name="chevronLeft" size={26} color={palette.navy} />
      <Text style={styles.subTitle} numberOfLines={1}>{title}</Text>
    </Pressable>
    {onShare ? (
      <Pressable accessibilityRole="button" onPress={onShare} style={({ pressed }) => [styles.share, pressed && { opacity: 0.7 }]}>
        <Icon name="share" size={18} color={palette.navy} />
        <Text style={styles.shareText}>공유</Text>
      </Pressable>
    ) : null}
  </View>
)

/**
 * 영상 아래 '00:00 [━━■━○━━] 14:35' — 이 경고가 영상 조각 안의 어디쯤인지.
 * 경고가 들어 있는 조각을 찾아 그 길이를 막대로 그린다. 조각이 없으면 경고를 가운데 둔 같은 길이로 그린다.
 */
const RiskRange = ({ event, segmentSeconds }: { event: EventDetail; segmentSeconds: number }) => {
  const start = Date.parse(event.startedAt)
  const windowMs = Math.max(segmentSeconds, event.durationSec) * 1000
  const containing = event.segments
    .map((segment) => Date.parse(segment.startedAt))
    .filter((at) => Number.isFinite(at) && at <= start && start < at + windowMs)
    .sort((a, b) => b - a)[0]
  const from = containing ?? start - Math.max(0, windowMs - event.durationSec * 1000) / 2
  const left = Math.min(1, Math.max(0, (start - from) / windowMs))
  const width = Math.max(0.03, Math.min(1 - left, (event.durationSec * 1000) / windowMs))
  // 조각이 1분보다 짧으면 시·분만으로는 양 끝이 같은 글자가 된다.
  const label = (at: number): string => (windowMs < 60_000 ? clockOf : timeOf)(new Date(at).toISOString())

  return (
    <View style={styles.range} accessibilityLabel={`위험 구간 ${clockOf(event.startedAt)}부터 ${durationLabel(event.durationSec)}`}>
      <Text style={styles.rangeTime}>{label(from)}</Text>
      <View style={styles.rangeTrack}>
        <View style={[styles.rangeHit, { left: `${left * 100}%`, width: `${width * 100}%` }]} />
        <View style={[styles.rangeKnob, { left: `${(left + width) * 100}%` }]} />
      </View>
      <Text style={styles.rangeTime}>{label(from + windowMs)}</Text>
    </View>
  )
}

/** 펼친 목록의 한 줄 — 지금 보는 영상은 파랗게. */
const ListButton = ({
  label, meta, active, onPress,
}: {
  label: string
  meta: string
  active: boolean
  onPress: () => void
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected: active }}
    onPress={onPress}
    style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: palette.fill }]}
  >
    <Text style={[styles.listLabel, active && { color: palette.blue, fontWeight: '600' }]}>{label}</Text>
    <Text style={[styles.listMeta, active && { color: palette.blue }]}>{meta}</Text>
  </Pressable>
)

const SHADOW_SOFT = '0 2px 8px rgba(20, 35, 61, 0.06)'

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.page },
  pad: { paddingHorizontal: GUTTER },
  loading: { marginTop: 48 },
  content: { paddingHorizontal: GUTTER, paddingBottom: 32 },

  subHeader: { height: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 18, flexShrink: 1, marginLeft: -9 },
  subTitle: { ...font(20, '600'), lineHeight: 26, color: palette.navy, flexShrink: 1 },
  share: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    boxShadow: SHADOW_SOFT,
  },
  shareText: { ...font(12, '600'), color: palette.navy },

  player: { height: 193, borderRadius: 12, overflow: 'hidden', backgroundColor: palette.navy },
  playerCover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  playButton: {
    width: 55,
    height: 55,
    borderRadius: 28,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  playerNote: { ...font(12, '500'), color: palette.white, textAlign: 'center', paddingHorizontal: GUTTER },
  expand: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  range: { marginTop: 14, height: 16, flexDirection: 'row', alignItems: 'center', gap: 18 },
  rangeTime: { ...font(12), lineHeight: 16, color: palette.muted },
  rangeTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: palette.border },
  rangeHit: { position: 'absolute', top: 0, bottom: 0, borderRadius: 3, backgroundColor: palette.red },
  rangeKnob: {
    position: 'absolute',
    top: -4,
    width: 13,
    height: 13,
    marginLeft: -6.5,
    borderRadius: 7,
    backgroundColor: palette.white,
    borderWidth: 1,
    borderColor: palette.border,
    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)',
  },

  info: {
    marginTop: 18,
    padding: 8,
    gap: 8,
    borderRadius: 12,
    backgroundColor: palette.pinkSurface,
    boxShadow: SHADOW_SOFT,
  },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { height: 27, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 6 },
  tagText: { ...font(13, '500'), lineHeight: 18, color: palette.white },
  riskText: { ...font(13, '500'), lineHeight: 18 },
  where: { ...font(13), lineHeight: 18, color: palette.sub, paddingHorizontal: 4 },
  desc: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
  },
  descText: { ...font(14), lineHeight: 20, color: palette.ink },

  call: { marginTop: 10 },
  callCaption: { ...font(13), lineHeight: 18, color: palette.muted, textAlign: 'center', marginTop: 8 },

  tiles: { marginTop: 18, flexDirection: 'row', gap: 11 },
  listBox: { marginTop: 12, gap: 12 },
  confirm: { marginTop: 12 },
  fp: { marginTop: 14, alignItems: 'center' },
  resolved: { ...font(12), color: palette.muted, textAlign: 'center', marginTop: 8 },

  listRow: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 14,
  },
  listLabel: { ...font(14), color: palette.ink },
  listMeta: { ...font(12), color: palette.muted },

  callCard: { padding: 16, gap: 4 },
  callLabel: { ...font(12, '500'), color: palette.muted },
  callAddress: { ...font(20, '700'), lineHeight: 28, color: palette.ink },
  callDivider: { height: 1, backgroundColor: palette.divider, marginVertical: 8 },
  callLine: { ...font(14), lineHeight: 20, color: palette.sub },
})
