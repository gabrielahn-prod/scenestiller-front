import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import type { EventListItem, MonitoringCamera, TimelineCamera, WeeklySummaryDto } from '@scene-stealer/api'
import { Chip, EmptyCard, GUTTER, OptionRow, RowGroup, Screen, Sheet } from '../../components/ui'
import { EventGroup } from '../../components/EventRow'
import { Gradient, PINK_SWEEP } from '../../components/art'
import { Icon } from '../../components/icons'
import { useApi } from '../../lib/api'
import { dateHeading, localDate, timeOf } from '../../lib/format'
import { palette } from '../../lib/palette'
import { repeatLine, weeklySummary } from '../../lib/summary'
import { useStores } from '../../lib/store-context'
import { font } from '../../lib/typography'

type Filter = 'all' | 'unconfirmed' | 'high'

/** 떠 있는 '이번 주 요약' 카드의 높이 + 탭바와의 사이 — 목록 끝이 카드 뒤에 숨지 않게 이만큼 더 내린다. */
const SUMMARY_SPACE = 110 + 18 + 16

/**
 * 위험 기록 — 피그마 '기록'.
 * 필터는 '미확인 (N) · 전체 · 높음 · 카메라 ⌄'. 피그마의 '종류 ⌄'는 없다 — 위험 종류를 나누지 않기로 했다.
 * 날짜별로 접고 펴며, 날마다 미확인은 분홍 묶음, 처리한 건은 흐린 흰 묶음으로 나눈다.
 * 카메라가 끊겨 영상이 없던 구간은 선 사이 한 줄로 끼워 넣어 기록의 공백을 설명한다.
 * 아래에는 '이번 주 요약' 카드가 떠 있다.
 */
export default function RecordsScreen() {
  const api = useApi()
  const { selected } = useStores()
  const [events, setEvents] = useState<readonly EventListItem[]>([])
  const [cameras, setCameras] = useState<readonly MonitoringCamera[]>([])
  const [gaps, setGaps] = useState<readonly TimelineCamera[]>([])
  const [serverSummary, setServerSummary] = useState<WeeklySummaryDto | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [cameraId, setCameraId] = useState<string | null>(null)
  const [pickingCamera, setPickingCamera] = useState(false)
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!selected) return
    setBusy(true)
    try {
      const today = localDate(new Date().toISOString())
      const [page, timeline, monitoring, summary] = await Promise.all([
        api.listEvents(selected.id),
        api.getTimeline(selected.id, today).catch(() => []),
        api.getMonitoring(selected.id).catch(() => null),
        // 요약은 계약에서 후순위다 — 서버에 없으면 목록으로 센 값을 쓴다.
        api.getWeeklySummary(selected.id).catch(() => null),
      ])
      setEvents(page.items)
      setGaps(timeline.filter((camera) => camera.gaps.length > 0))
      setCameras(monitoring?.cameras ?? [])
      setServerSummary(summary)
    } catch {
      // 목록을 못 읽으면 지금 화면을 그대로 둔다. 당겨서 새로고침하면 다시 묻는다.
    } finally {
      setBusy(false)
    }
  }, [api, selected])

  useFocusEffect(useCallback(() => { void load() }, [load]))

  // 매장을 바꾸면 고른 카메라 · 접은 날짜는 그 매장 것이 아니다.
  useEffect(() => {
    setCameraId(null)
    setFolded(new Set())
    setEvents([])
    setServerSummary(null)
  }, [selected?.id])

  const shown = useMemo(
    () =>
      events
        .filter((e) => (filter === 'unconfirmed' ? e.state === 'unconfirmed' : filter === 'high' ? e.risk === 'high' : true))
        .filter((e) => (cameraId ? e.cameraId === cameraId : true)),
    [events, filter, cameraId],
  )

  /** 날짜별 — 최신 날짜부터, 날 안에서는 미확인 묶음 · 처리한 묶음, 각각 최신부터. */
  const days = useMemo(() => {
    const byDate = new Map<string, EventListItem[]>()
    for (const event of shown) {
      const key = localDate(event.startedAt)
      byDate.set(key, [...(byDate.get(key) ?? []), event])
    }
    const newest = (a: EventListItem, b: EventListItem) => Date.parse(b.startedAt) - Date.parse(a.startedAt)
    return [...byDate.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({
        date,
        heading: dateHeading(items[0]!.startedAt),
        open: items.filter((e) => e.state === 'unconfirmed').sort(newest),
        done: items.filter((e) => e.state !== 'unconfirmed').sort(newest),
      }))
  }, [shown])

  const local = useMemo(() => weeklySummary(events), [events])
  const counts = serverSummary
    ? { risky: serverSummary.total - serverSummary.falsePositive, falsePositive: serverSummary.falsePositive, reported: serverSummary.reported }
    : { risky: local.risky, falsePositive: local.falsePositive, reported: null }
  const unconfirmed = events.filter((e) => e.state === 'unconfirmed').length
  const today = localDate(new Date().toISOString())
  const shownGaps = gaps
    .filter((camera) => (cameraId ? camera.cameraId === cameraId : true))
    .flatMap((camera) => camera.gaps.map((gap) => ({ ...gap, camera: camera.name, key: `${camera.cameraId}-${gap.from}` })))
  const cameraName = cameras.find((camera) => camera.id === cameraId)?.name ?? null
  const open = (event: EventListItem) => router.push(`/events/${event.id}`)
  const toggleDay = (date: string) =>
    setFolded((current) => {
      const next = new Set(current)
      if (next.has(date)) next.delete(date)
      else next.add(date)
      return next
    })

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} />}
      >
        <View style={styles.titleRow}>
          <Text style={styles.title}>위험 기록</Text>
          <Text style={styles.store} numberOfLines={1}>{selected?.name ?? ''}</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroller} contentContainerStyle={styles.filters}>
          <Chip
            label={`미확인 (${unconfirmed})`}
            selected={filter === 'unconfirmed'}
            onPress={() => setFilter((current) => (current === 'unconfirmed' ? 'all' : 'unconfirmed'))}
          />
          <Chip label="전체" selected={filter === 'all'} onPress={() => setFilter('all')} />
          <Chip
            label="높음"
            selected={filter === 'high'}
            onPress={() => setFilter((current) => (current === 'high' ? 'all' : 'high'))}
          />
          <Chip
            label={cameraName ?? '카메라'}
            trailing="chevronDown"
            selected={cameraId !== null}
            onPress={() => setPickingCamera(true)}
          />
        </ScrollView>

        {days.length === 0 ? (
          <View style={styles.day}>
            <EmptyCard text={events.length === 0 ? '아직 위험 기록이 없어요' : '해당하는 기록이 없어요'} />
          </View>
        ) : (
          days.map((day) => {
            const isFolded = folded.has(day.date)
            return (
              <View key={day.date} style={styles.day}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded: !isFolded }}
                  onPress={() => toggleDay(day.date)}
                  style={styles.dayHead}
                >
                  <Text style={styles.dayTitle}>{day.heading}</Text>
                  <Icon name={isFolded ? 'chevronDown' : 'chevronUp'} size={20} color={palette.ink} />
                </Pressable>
                {isFolded ? null : (
                  <View style={styles.dayBody}>
                    {day.open.length > 0 ? <EventGroup events={day.open} alert onOpen={open} /> : null}
                    {day.done.length > 0 ? <EventGroup events={day.done} alert={false} onOpen={open} /> : null}
                    {day.date === today
                      ? shownGaps.map((gap) => (
                          <View key={gap.key} style={styles.gap}>
                            <View style={styles.gapLine} />
                            <Text style={styles.gapText}>
                              {timeOf(gap.from)} '{gap.camera}' 카메라 {gap.reason === 'pc_offline' ? 'PC 꺼짐' : '끊김'} (영상 없음)
                            </Text>
                            <View style={styles.gapLine} />
                          </View>
                        ))
                      : null}
                  </View>
                )}
              </View>
            )
          })
        )}
      </ScrollView>

      <WeekSummary
        risky={counts.risky}
        falsePositive={counts.falsePositive}
        reported={counts.reported}
        caption={repeatLine(local) ?? '최근 7일 동안의 기록이에요'}
      />

      <Sheet visible={pickingCamera} title="카메라" onClose={() => setPickingCamera(false)}>
        <RowGroup>
          {[{ id: null, name: '모든 카메라' }, ...cameras].map((camera) => (
            <OptionRow
              key={camera.id ?? 'all'}
              label={camera.name}
              selected={cameraId === camera.id}
              onPress={() => {
                setCameraId(camera.id)
                setPickingCamera(false)
              }}
            />
          ))}
        </RowGroup>
      </Sheet>
    </Screen>
  )
}

/** 떠 있는 '이번 주 요약' — 문서 동그라미 + 위험(빨강) · 오탐 · 신고 세 칸 + 반복 시간대 한 줄. */
const WeekSummary = ({
  risky, falsePositive, reported, caption,
}: {
  risky: number
  falsePositive: number
  /** 서버 요약이 없으면 모른다 — 지어내지 않고 '-' 로 둔다. */
  reported: number | null
  caption: string
}) => (
  <View style={styles.summary} accessibilityLabel={`이번 주 요약 위험 ${risky}건 오탐 ${falsePositive}건 신고 ${reported ?? '알 수 없음'}`}>
    <Gradient stops={PINK_SWEEP} />
    <View style={styles.summaryIcon}>
      <Icon name="document" size={22} color={palette.pinkIcon} inner={palette.pinkCircle} />
    </View>
    <View style={styles.summaryBody}>
      <Text style={styles.summaryTitle}>이번 주 요약</Text>
      <View style={styles.stats}>
        <Stat label="위험" value={String(risky)} danger />
        <Stat label="오탐" value={String(falsePositive)} />
        <Stat label="신고" value={reported === null ? '-' : String(reported)} />
      </View>
      <Text style={styles.summaryCaption} numberOfLines={1}>{caption}</Text>
    </View>
  </View>
)

const Stat = ({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) => (
  <View style={styles.stat}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={[styles.statValue, danger && { color: palette.red }]}>{value}</Text>
  </View>
)

const styles = StyleSheet.create({
  content: { paddingTop: GUTTER, paddingHorizontal: GUTTER, paddingBottom: SUMMARY_SPACE },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 14 },
  title: { ...font(18, '700'), lineHeight: 24, color: palette.ink },
  store: { ...font(12, '600'), color: palette.ink, flexShrink: 1 },
  // 칩 줄은 화면 끝까지 밀리게 좌우 여백 밖으로 편다.
  filterScroller: { marginHorizontal: -GUTTER, marginTop: 16, flexGrow: 0 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: GUTTER },

  day: { marginTop: 20 },
  dayHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 24 },
  dayTitle: { ...font(14, '600'), lineHeight: 20, color: palette.ink },
  dayBody: { marginTop: 10, gap: 10 },

  gap: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 2 },
  gapLine: { flex: 1, height: 1, backgroundColor: palette.border },
  gapText: { ...font(12), color: palette.muted, flexShrink: 1 },

  summary: {
    position: 'absolute',
    left: GUTTER,
    right: GUTTER,
    bottom: 18,
    borderRadius: 12,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingTop: 11,
    paddingBottom: 10,
    paddingHorizontal: 10,
    boxShadow: '0 4px 16px rgba(20, 35, 61, 0.10)',
  },
  summaryIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.pinkCircle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryBody: { flex: 1, gap: 6 },
  summaryTitle: { ...font(13, '700'), lineHeight: 18, color: palette.navy },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    height: 44,
    borderRadius: 8,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  statLabel: { ...font(10), lineHeight: 13, color: palette.muted },
  statValue: { ...font(16, '700'), lineHeight: 20, color: palette.navy },
  summaryCaption: { ...font(11), lineHeight: 15, color: palette.muted },
})
