import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import type { EventListItem } from '@scene-stealer/api'
import { EVENT_NAME, riskLabel, stateLabel, timeOf } from '../lib/format'
import { palette } from '../lib/palette'
import { font } from '../lib/typography'
import { Gradient } from './art'
import { Icon } from './icons'

/**
 * 위험 신호 한 건 — 피그마 홈 '오늘 위험 신호' 카드 · 기록 목록 줄.
 * 왼쪽 첫 장면(74×48), 오른쪽 '이상 행동 높음' / '계산대 · 14:32 · 미확인'.
 * 처리한 건(확인됨 · 오탐)은 흐리게 둔다 — 스캔할 때 미확인이 먼저 보이게.
 */
const accessibleLabel = (event: EventListItem): string =>
  `${EVENT_NAME} 위험도 ${riskLabel[event.risk]} ${event.cameraName} ${timeOf(event.startedAt)} ${stateLabel[event.state]}`

/** 첫 장면이 없을 때의 자리 — PC 앱의 가짜 화면(mock-server frame)과 같은 어두운 카메라 화면. */
const DARK_FRAME = [
  [0, '#2A3038'],
  [1, '#555D6D'],
] as const

/** 서버가 준 첫 장면. 없으면 어두운 화면에 카메라 그림만 둔다. */
export const EventThumb = ({ uri }: { uri: string | null }) => (
  <View style={styles.thumb}>
    {uri ? (
      <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
    ) : (
      <>
        <Gradient stops={DARK_FRAME} />
        <Icon name="camera" size={18} color="#9AA1AD" />
      </>
    )}
  </View>
)

const EventText = ({ event }: { event: EventListItem }) => (
  <View style={styles.body}>
    <View style={styles.titleLine}>
      <Text style={styles.title} numberOfLines={1}>{EVENT_NAME}</Text>
      <Text style={[styles.risk, event.risk === 'high' && { color: palette.red }]}>{riskLabel[event.risk]}</Text>
    </View>
    <Text style={styles.meta} numberOfLines={1}>
      {event.cameraName} · {timeOf(event.startedAt)} · {stateLabel[event.state]}
    </Text>
  </View>
)

/** 홈 카드 — 미확인 '높음'만 분홍 바탕 · 빨간 테두리. */
export const EventCard = ({ event, onPress }: { event: EventListItem; onPress: () => void }) => {
  const unconfirmed = event.state === 'unconfirmed'
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibleLabel(event)}
      style={({ pressed }) => [
        styles.card,
        unconfirmed && event.risk === 'high' && styles.cardAlert,
        !unconfirmed && styles.dim,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.inner}>
        <EventThumb uri={event.thumbnailUrl} />
        <EventText event={event} />
      </View>
    </Pressable>
  )
}

/** 기록 목록 줄 — 테두리는 묶음(EventGroup)이 그린다. */
export const EventListRow = ({ event, onPress }: { event: EventListItem; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    accessibilityRole="button"
    accessibilityLabel={accessibleLabel(event)}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
  >
    <View style={styles.inner}>
      <EventThumb uri={event.thumbnailUrl} />
      <EventText event={event} />
    </View>
  </Pressable>
)

/**
 * 기록의 한 묶음 — 미확인은 분홍 바탕 · 빨간 테두리(줄 사이 선도 빨강), 나머지는 흰 카드를 통째로 흐리게.
 */
export const EventGroup = ({
  events, alert, onOpen,
}: {
  events: readonly EventListItem[]
  alert: boolean
  onOpen: (event: EventListItem) => void
}) => (
  <View style={[styles.group, alert ? styles.groupAlert : styles.dim]}>
    {events.map((event, index) => (
      <View key={event.id}>
        {index > 0 ? <View style={[styles.divider, alert && { backgroundColor: palette.redLine }]} /> : null}
        <EventListRow event={event} onPress={() => onOpen(event)} />
      </View>
    ))}
  </View>
)

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cardAlert: { borderColor: palette.redLine, backgroundColor: palette.pinkSurface },
  row: { paddingHorizontal: 10, paddingVertical: 10 },
  inner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  // 피그마의 처리한 건 — 카드째(바탕 · 테두리 · 글자 · 사진) 60% 로 흐리다.
  dim: { opacity: 0.6 },
  thumb: {
    width: 74,
    height: 48,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: palette.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  titleLine: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  title: { ...font(14, '600'), lineHeight: 20, color: palette.navy, flexShrink: 1 },
  risk: { ...font(12, '500'), lineHeight: 16, color: palette.faint },
  meta: { ...font(13), lineHeight: 18, color: palette.sub },
  group: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    overflow: 'hidden',
  },
  groupAlert: { borderColor: palette.redLine, backgroundColor: palette.pinkSurface },
  divider: { height: 1, backgroundColor: palette.divider },
})
