/**
 * 2e 위험 기록 — 타임라인 + 목록 + 미리보기.
 * 값: design/씬스틸러 PC 앱.dc.html 의 2e 인라인 스타일.
 *
 * 행 클릭 → 오른쪽 미리보기, 더블클릭 → 2f 상세.
 * 타임라인의 점선은 '영상 없음' 구간이다 — "그 시간엔 아무 일도 없었다"와 "그 시간은
 * 못 봤다"를 구분해서 보여줘야 사장님이 시스템을 잘못 믿지 않는다 (요구사항 4.4).
 *
 * 위험 종류 분류를 하지 않기로 해서 디자인의 '종류' 필터는 '위험도' 필터로, 내용 칸의
 * '절도 의심 · 설명' 은 '이상 행동 · 지속 시간' 으로 바꿨다.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type {
  EventListItem,
  EventQuery,
  EventState,
  EventSummary,
  RiskLevel,
  TimelineDto,
} from '../../../shared/server-types'
import { useConnectedStore } from '../../app/session'
import { useStream, useStreamMessages } from '../../app/stream'
import { ClipPlayer } from '../../components/ClipPlayer'
import { MemoBox } from '../../components/MemoBox'
import { Button, Notice, SelectButton, Spinner, Tag, VideoSurface } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { EVENT_TITLE, RISK_LABEL, RISK_TONE, STATE_LABEL } from '../../lib/labels'
import {
  changeEventState,
  deleteEvent,
  getClip,
  getEvent,
  getSummary,
  getTimeline,
  listCameras,
  listEvents,
  ServerError,
} from '../../lib/server-api'
import {
  formatClock,
  formatClockSeconds,
  formatDateHeader,
  formatDuration,
  formatShortDateTime,
  localDateKey,
  localDayRange,
  shiftDateKey,
} from '../../lib/time'

const PAGE_SIZE = 8
const COLUMNS = 'grid-cols-[70px_96px_1fr_110px_80px_90px]'

type Period = 'day' | 'week' | 'month'
const PERIOD_DAYS: Record<Period, number> = { day: 1, week: 7, month: 30 }

/** 2e 표의 상태 태그. 목록에서는 '미확인'이 빨간 계열이다 (디자인시스템 샘플의 파란색과 다르다). */
const TABLE_STATE_TONE: Record<EventState, string> = {
  unconfirmed: 'bg-error-50 text-error-main',
  confirmed: 'bg-success-50 text-success-600',
  false_positive: 'bg-gray-100 text-gray-600',
}

/* ---------------------------------------------------------------- 타임라인 */

/**
 * 2e 표 아래 '이번 주 · 위험 12건 · 오탐 3건 · 신고 1건'.
 * 서버의 total 은 오탐까지 센 수라 위험에서 오탐을 뺀다 — 모바일 기록 화면의 주간 요약과 같은 셈이다.
 * 서버가 숫자를 빼먹어도 'undefined건' 을 찍지 않는다.
 */
const weeklyLine = (summary: EventSummary): string => {
  const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? value : 0)
  const falsePositive = count(summary.falsePositive)
  return `이번 주 · 위험 ${Math.max(0, count(summary.total) - falsePositive)}건 · 오탐 ${falsePositive}건 · 신고 ${count(summary.reported)}건`
}

const MARK_COLOR = (item: { risk: string; state: EventState }): string =>
  item.state === 'false_positive'
    ? 'bg-gray-500'
    : item.risk === 'high'
      ? 'bg-risk-high'
      : item.risk === 'medium'
        ? 'bg-risk-medium'
        : 'bg-risk-low'

const DayTimeline = ({
  dateKey,
  timeline,
  selectedId,
  onPick,
}: {
  dateKey: string
  timeline: TimelineDto | null
  selectedId: string | null
  onPick: (eventId: string) => void
}) => {
  const { from } = localDayRange(dateKey)
  const dayStart = Date.parse(from)
  const percent = (iso: string): number => Math.min(100, Math.max(0, ((Date.parse(iso) - dayStart) / 86_400_000) * 100))

  return (
    <section className="flex flex-col gap-2 rounded-card bg-surface px-6 py-4 shadow-card">
      <div className="flex justify-between text-caption text-gray-600">
        <span>하루 타임라인 · 막대를 누르면 클립</span>
        <span className="flex gap-3.5">
          <span className="text-error-main">■ 높음</span>
          <span className="text-risk-medium-text">■ 보통</span>
          <span>■ 오탐</span>
          <span>┈ 영상 없음</span>
        </span>
      </div>
      <div className="grid grid-cols-[80px_1fr] items-center gap-y-2 text-caption font-semibold">
        {!timeline && (
          <>
            <span />
            <div className="flex h-14 items-center justify-center text-gray-600">
              <Spinner />
            </div>
          </>
        )}
        {timeline?.cameras.map((camera) => (
          <div key={camera.cameraId} className="contents">
            <span className="truncate pr-2">{camera.name}</span>
            <div className="relative h-3.5 rounded-[4px] bg-gray-100">
              {camera.gaps.map((gap) => (
                <span
                  key={`${gap.from}-${gap.to}`}
                  title="영상 없음"
                  className="absolute inset-y-0 bg-[repeating-linear-gradient(90deg,var(--gray-300)_0_4px,transparent_4px_8px)]"
                  style={{ left: `${percent(gap.from)}%`, width: `${percent(gap.to) - percent(gap.from)}%` }}
                />
              ))}
              {camera.events.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onPick(item.id)}
                  title={`${EVENT_TITLE} · ${formatClock(item.startedAt)}`}
                  aria-label={`${EVENT_TITLE} ${formatClock(item.startedAt)}`}
                  className={cn(
                    // 31초짜리 이벤트는 하루 폭의 0.04% 라 보이지 않는다. 최소 6px 는 준다.
                    'absolute inset-y-0 min-w-1.5 rounded-[2px] transition hover:brightness-110',
                    MARK_COLOR(item),
                    item.id === selectedId && 'ring-2 ring-blue-600 ring-offset-1',
                  )}
                  style={{
                    left: `${percent(item.startedAt)}%`,
                    width: `${percent(item.endedAt) - percent(item.startedAt)}%`,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
        <span />
        <div className="flex justify-between font-normal text-gray-600">
          {['00', '06', '12', '18', '24'].map((hour) => (
            <span key={hour}>{hour}</span>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ 목록 */

const Row = ({
  event,
  selected,
  onSelect,
  onOpen,
}: {
  event: EventListItem
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}) => {
  const falsePositive = event.state === 'false_positive'
  return (
    <button
      type="button"
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={cn(
        'grid items-center gap-3 border-b border-gray-200 px-5 py-2.5 text-left text-[15px]',
        COLUMNS,
        selected ? 'bg-blue-100' : 'hover:bg-gray-50',
        event.state === 'confirmed' && 'text-gray-700',
        falsePositive && 'text-gray-600',
      )}
    >
      <span className="font-semibold">{formatClock(event.startedAt)}</span>
      <VideoSurface className={cn('h-[54px] rounded-[6px] aspect-auto', falsePositive && 'opacity-50')}>
        {event.thumbnailUrl && <img src={event.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />}
      </VideoSurface>
      <span className="min-w-0 truncate">
        {falsePositive ? (
          <span className="line-through">{EVENT_TITLE}</span>
        ) : (
          <>
            <b>{EVENT_TITLE}</b>
            {event.durationSec !== null && (
              <span className="text-body-sm font-normal text-gray-600"> · {formatDuration(event.durationSec)}</span>
            )}
          </>
        )}
      </span>
      <span className="truncate">{event.cameraName ?? '—'}</span>
      {falsePositive ? (
        <span>—</span>
      ) : (
        <Tag tone={RISK_TONE[event.risk]} className="justify-self-start px-2.5 py-0.5 text-[12px]">
          {RISK_LABEL[event.risk]}
        </Tag>
      )}
      <span
        className={cn(
          'inline-flex justify-self-start whitespace-nowrap rounded-chip px-2.5 py-0.5 text-[12px] font-semibold',
          TABLE_STATE_TONE[event.state],
        )}
      >
        {STATE_LABEL[event.state]}
      </span>
    </button>
  )
}

const PageButton = ({
  active,
  disabled,
  onClick,
  children,
  label,
}: {
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: string
  label?: string
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={cn(
      'inline-flex size-8 items-center justify-center rounded-small text-body-sm',
      active
        ? 'bg-brand-sub font-semibold text-white'
        : 'text-gray-600 shadow-[inset_0_0_0_1px_var(--gray-300)] hover:text-gray-900 disabled:opacity-40',
    )}
  >
    {children}
  </button>
)

/* ---------------------------------------------------------------- 미리보기 */

const Preview = ({
  eventId,
  onChanged,
  onDeleted,
}: {
  eventId: string
  onChanged: (event: EventListItem) => void
  onDeleted: (eventId: string) => void
}) => {
  const navigate = useNavigate()
  const detail = useResource(() => getEvent(eventId), [eventId])
  const [busy, setBusy] = useState<EventState | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const data = detail.data

  const decide = async (state: EventState) => {
    setBusy(state)
    setError(null)
    try {
      const updated = await changeEventState(eventId, state)
      detail.mutate((current) => ({ ...current, state: updated.state }))
      onChanged(updated)
    } catch (decideError) {
      setError(decideError instanceof ServerError ? decideError.message : '저장하지 못했습니다.')
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deleteEvent(eventId)
      onDeleted(eventId)
    } catch (deleteError) {
      setError(deleteError instanceof ServerError ? deleteError.message : '삭제하지 못했습니다.')
      setDeleting(false)
      setConfirmingDelete(false)
    }
  }

  const saveClip = async () => {
    try {
      await api.openExternal((await getClip(eventId)).url)
    } catch (clipError) {
      setError(clipError instanceof ServerError ? clipError.message : '클립을 열지 못했습니다.')
    }
  }

  if (!data) {
    return (
      <section className="flex items-center justify-center rounded-card bg-surface p-4 text-gray-600 shadow-card">
        {detail.error ? <span className="text-caption text-error-main">{detail.error}</span> : <Spinner />}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
      <ClipPlayer
        clipUrl={data.clipUrl}
        thumbnailUrl={data.thumbnailUrl}
        startedAt={data.startedAt}
        durationSec={data.durationSec}
        className="rounded-[10px]"
      />
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[18px] font-semibold">{EVENT_TITLE}</span>
          <Tag tone={RISK_TONE[data.risk]} className="px-2.5 py-0.5 text-[12px]">
            {RISK_LABEL[data.risk]}
          </Tag>
        </div>
        <div className="mt-0.5 text-body-sm font-normal text-gray-600">
          {data.cameraName ?? '카메라'} · {formatShortDateTime(data.startedAt)} – {formatClockSeconds(data.endedAt)}
        </div>
      </div>
      <Button variant="action" className="w-full" onClick={() => navigate(`/events/${eventId}`)}>
        전후 영상 · 자세히 →
      </Button>
      <Button variant="secondary" onClick={() => void saveClip()}>
        클립 저장 · 공유
      </Button>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          className={cn('flex-1', data.state === 'false_positive' ? 'text-gray-900' : 'text-gray-600')}
          loading={busy === 'false_positive'}
          disabled={busy !== null || data.state === 'false_positive'}
          onClick={() => void decide('false_positive')}
        >
          {data.state === 'false_positive' ? '오탐 처리됨' : '오탐'}
        </Button>
        <Button
          variant="primary"
          className="flex-[2] rounded-small py-2.5"
          loading={busy === 'confirmed' || busy === 'unconfirmed'}
          // 확인·오탐 뒤에도 되돌릴 수 있어야 한다 (요구사항 4.6 '미확인 복귀').
          disabled={busy !== null}
          onClick={() => void decide(data.state === 'unconfirmed' ? 'confirmed' : 'unconfirmed')}
        >
          {data.state === 'unconfirmed' ? '확인' : '미확인으로 되돌리기'}
        </Button>
      </div>
      {error && <Notice tone="bad">{error}</Notice>}
      <MemoBox eventId={eventId} initial={data.memo} />
      {confirmingDelete ? (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" disabled={deleting} onClick={() => setConfirmingDelete(false)}>
            취소
          </Button>
          <Button variant="danger" className="flex-1" loading={deleting} onClick={() => void remove()}>
            삭제
          </Button>
        </div>
      ) : (
        <Button variant="danger-outline" onClick={() => setConfirmingDelete(true)}>
          삭제
        </Button>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ 화면 */

export const EventList = () => {
  const navigate = useNavigate()
  const store = useConnectedStore()
  const { resyncToken } = useStream()

  const [dateKey, setDateKey] = useState(localDateKey())
  const [period, setPeriod] = useState<Period>('day')
  const [cameraId, setCameraId] = useState('all')
  const [risk, setRisk] = useState<RiskLevel | 'all'>('all')
  const [state, setState] = useState<EventState | 'all'>('all')
  // 커서 페이지네이션을 번호 페이지로 보여주려고 페이지마다 시작 커서를 쌓아 둔다.
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined])
  const [page, setPage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const today = localDateKey()
  const isToday = dateKey === today

  const query: EventQuery = useMemo(() => {
    const end = localDayRange(dateKey).to
    const start = localDayRange(shiftDateKey(dateKey, 1 - PERIOD_DAYS[period])).from
    return {
      from: start,
      to: end,
      cameraId: cameraId === 'all' ? undefined : cameraId,
      risk: risk === 'all' ? undefined : risk,
      state: state === 'all' ? undefined : state,
      limit: PAGE_SIZE,
    }
  }, [dateKey, period, cameraId, risk, state])

  // 필터가 바뀌면 첫 페이지부터.
  useEffect(() => {
    setCursors([undefined])
    setPage(0)
  }, [query])

  const cursor = cursors[page]
  // cursors 배열 자체가 아니라 이 페이지의 커서만 본다 — 다음 페이지 커서가 쌓일 때마다
  // 지금 페이지를 다시 요청하지 않게.
  const events = useResource(
    () => listEvents(store.id, { ...query, cursor }),
    [store.id, query, page, cursor, resyncToken],
  )
  const timeline = useResource(() => getTimeline(store.id, dateKey), [store.id, dateKey, resyncToken])
  const summary = useResource(() => getSummary(store.id), [store.id, resyncToken])
  const cameras = useResource(() => listCameras(store.id), [store.id])

  useEffect(() => {
    const next = events.data?.nextCursor
    if (next && cursors.length === page + 1) setCursors((current) => [...current, next])
  }, [events.data?.nextCursor, cursors.length, page])

  const items = events.data?.items ?? []
  useEffect(() => {
    if (!selectedId || !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id ?? null)
  }, [items, selectedId])

  const replace = (updated: EventListItem) => {
    events.mutate((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === updated.id ? updated : item)),
    }))
    timeline.mutate((current) => ({
      ...current,
      cameras: current.cameras.map((camera) => ({
        ...camera,
        events: camera.events.map((item) => (item.id === updated.id ? { ...item, state: updated.state } : item)),
      })),
    }))
  }

  const remove = (deletedId: string) => {
    events.mutate((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== deletedId),
    }))
    timeline.mutate((current) => ({
      ...current,
      cameras: current.cameras.map((camera) => ({
        ...camera,
        events: camera.events.filter((item) => item.id !== deletedId),
      })),
    }))
    setSelectedId((current) => (current === deletedId ? null : current))
  }

  useStreamMessages((message) => {
    if (message.type === 'event.updated') replace(message.data)
    if (message.type === 'event.deleted') remove(message.data.id)
    // 새 이벤트는 정렬·페이지 경계를 바꾼다. 끼워 넣지 않고 지금 보는 날이면 다시 읽는다.
    if (message.type === 'event.created' && isToday) {
      void events.reload()
      void timeline.reload()
    }
  })

  const retention = `클립은 ${store.clipRetentionDays}일, 원본 조각은 서버에 7일 보관됩니다.`
  const pageCount = cursors.length

  return (
    <div className="flex h-full min-h-[760px] flex-col gap-4 px-page pb-8 pt-7">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-h1">위험 기록</h1>
          <p className="mt-1 text-body-sm font-normal text-gray-600">{retention}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <span className="inline-flex items-center rounded-small bg-surface text-[15px] font-semibold shadow-[inset_0_0_0_1px_var(--gray-300)]">
            <button
              type="button"
              aria-label="이전 날"
              onClick={() => setDateKey((key) => shiftDateKey(key, -1))}
              className="py-2.5 pl-5 pr-2 hover:text-brand-sub"
            >
              ◂
            </button>
            <span className="px-1">{formatDateHeader(dateKey)}</span>
            <button
              type="button"
              aria-label="다음 날"
              disabled={isToday}
              onClick={() => setDateKey((key) => shiftDateKey(key, 1))}
              className="py-2.5 pl-2 pr-5 hover:text-brand-sub disabled:text-gray-500"
            >
              ▸
            </button>
          </span>
          <SelectButton
            label="기간"
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'day', label: isToday ? '오늘' : '하루' },
              { value: 'week', label: '7일' },
              { value: 'month', label: '30일' },
            ]}
          />
          <SelectButton
            label="카메라"
            value={cameraId}
            onChange={setCameraId}
            options={[
              { value: 'all', label: '전체' },
              ...(cameras.data ?? []).map((camera) => ({ value: camera.id, label: camera.name })),
            ]}
          />
          <SelectButton
            label="위험도"
            value={risk}
            onChange={setRisk}
            options={[
              { value: 'all', label: '전체' },
              { value: 'high', label: RISK_LABEL.high },
              { value: 'medium', label: RISK_LABEL.medium },
              { value: 'low', label: RISK_LABEL.low },
            ]}
          />
          <SelectButton
            label="상태"
            value={state}
            onChange={setState}
            options={[
              { value: 'all', label: '전체' },
              { value: 'unconfirmed', label: STATE_LABEL.unconfirmed },
              { value: 'confirmed', label: STATE_LABEL.confirmed },
              { value: 'false_positive', label: STATE_LABEL.false_positive },
            ]}
          />
        </div>
      </div>

      <DayTimeline
        dateKey={dateKey}
        timeline={timeline.data}
        selectedId={selectedId}
        onPick={(eventId) =>
          items.some((item) => item.id === eventId) ? setSelectedId(eventId) : navigate(`/events/${eventId}`)
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_340px] gap-4">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-card bg-surface shadow-card">
          <div
            className={cn(
              'grid gap-3 border-b border-gray-200 px-5 py-3 text-caption font-semibold text-gray-600',
              COLUMNS,
            )}
          >
            <span>시각</span>
            <span>클립</span>
            <span>내용</span>
            <span>카메라</span>
            <span>위험도</span>
            <span>상태</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {events.loading && !events.data && (
              <div className="flex justify-center py-12 text-gray-600">
                <Spinner />
              </div>
            )}
            {events.error && <p className="py-12 text-center text-caption text-error-main">{events.error}</p>}
            {events.data && items.length === 0 && (
              <p className="py-12 text-center text-body-sm font-normal text-gray-600">
                이 기간에는 위험 신호가 없습니다.
              </p>
            )}
            {items.map((event) => (
              <Row
                key={event.id}
                event={event}
                selected={event.id === selectedId}
                onSelect={() => setSelectedId(event.id)}
                onOpen={() => navigate(`/events/${event.id}`)}
              />
            ))}
          </div>
          <div className="mt-auto flex items-center justify-between border-t border-gray-200 px-5 py-3.5">
            <span className="text-caption text-gray-600">{summary.data ? weeklyLine(summary.data) : ' '}</span>
            <div className="flex gap-1.5">
              <PageButton label="이전 페이지" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                ‹
              </PageButton>
              {cursors.map((_, index) => (
                <PageButton key={index} active={index === page} onClick={() => setPage(index)}>
                  {String(index + 1)}
                </PageButton>
              ))}
              <PageButton
                label="다음 페이지"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </PageButton>
            </div>
          </div>
        </section>

        {selectedId ? (
          <Preview eventId={selectedId} onChanged={replace} onDeleted={remove} />
        ) : (
          <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
            <VideoSurface className="rounded-[10px]">선택한 클립 미리보기</VideoSurface>
          </section>
        )}
      </div>
    </div>
  )
}
