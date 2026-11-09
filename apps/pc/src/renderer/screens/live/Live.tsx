/**
 * 2c 홈 — 실시간 모니터링.
 * 값: design/씬스틸러 PC 앱.dc.html 의 2c 인라인 스타일.
 *
 * 카메라 상태는 서버(하트비트, 30초 지연)가 아니라 이 PC 의 에이전트 상태를 쓴다 —
 * 사장님이 보고 있는 이 화면이 가장 먼저 알아야 한다. 이름·위치는 서버 값을 쓴다
 * (모바일에서 이름을 바꿀 수 있다).
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EventListItem, MonitoringCamera } from '../../../shared/server-types'
import type { CameraRuntimeStatus, SelectedCamera, UploadStatus } from '../../../shared/types'
import { useSession, useConnectedStore } from '../../app/session'
import { useStream, useStreamMessages } from '../../app/stream'
import { Button, Segmented, Spinner, StatusDot, Tag, VideoSurface } from '../../components/ui'
import { usePreview } from '../../hooks/usePreview'
import { useResource } from '../../hooks/useResource'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatBytes } from '../../lib/format'
import { EVENT_TITLE, RISK_LABEL, SPEED_OPTIONS, STATE_LABEL } from '../../lib/labels'
import { deleteCamera, getMonitoring, listEvents } from '../../lib/server-api'
import { formatAgo, formatClock, formatDuration, localDateKey, localDayRange } from '../../lib/time'

const MAX_CAMERAS = 8

/**
 * 격자 행 수. 디자인 2c 는 3열 2행이라 칸이 적어도 2행 크기를 지킨다 — 행을 내용에 맡기면
 * 카메라 1대일 때 한 행이 화면 높이를 다 먹어 타일이 세로로 늘어나고 영상이 잘린다.
 * 칸이 7개 이상(카메라 6대 이상 + 추가 칸)이면 3행으로 늘린다.
 */
const gridRowsFor = (cells: number): string => (cells > 6 ? 'grid-rows-3' : 'grid-rows-2')

/* --------------------------------------------------------------- 상단 상태 */

const Indicator = ({ tone, children }: { tone: 'good' | 'warn' | 'bad'; children: string }) => (
  <span
    className={cn(
      // 줄어들지 않는다 — 창이 1440 보다 좁으면 한글이 글자마다 끊겨 세로로 쌓였다. 줄이는 건 옆의 설명 글이다.
      'flex shrink-0 items-center gap-1.5 whitespace-nowrap text-body-sm font-semibold',
      tone === 'good' && 'text-success-600',
      tone === 'warn' && 'text-risk-medium-text',
      tone === 'bad' && 'text-error-main',
    )}
  >
    <StatusDot tone={tone === 'good' ? 'connected' : tone === 'warn' ? 'reconnecting' : 'disconnected'} />
    {children}
  </span>
)

const UPLOAD_INDICATOR: Record<UploadStatus, { tone: 'good' | 'warn' | 'bad'; label: string }> = {
  idle: { tone: 'good', label: '서버 전송 정상' },
  uploading: { tone: 'good', label: '서버 전송 정상' },
  retrying: { tone: 'warn', label: '서버 전송 재시도 중' },
  offline: { tone: 'bad', label: '서버 전송 끊김' },
  'auth-failed': { tone: 'bad', label: '서버 인증 실패' },
  'payload-too-large': { tone: 'bad', label: '영상이 너무 큼' },
}

/* ------------------------------------------------------------ 카메라 타일 */

interface TileModel {
  readonly key: string
  readonly index: number
  readonly name: string
  readonly local: SelectedCamera | null
  readonly runtime: CameraRuntimeStatus | null
  readonly server: MonitoringCamera | null
}

const FILL = 'absolute inset-0 size-full object-cover'

/**
 * 미리보기 원본이 무엇이냐에 따라 그리는 태그가 다르다.
 * 실제 카메라는 MJPEG 스트림이라 <img> 가 알아서 움직이고, 웹 데모는 파일이라 <video> 가 필요하다.
 * 주소 모양으로 판단한다 — 화면이 데모인지 아닌지를 알 필요는 없다.
 *
 * 시작 지점(#t=)이 붙은 영상은 그 지점부터 끝까지 한 번만 튼다. 실서버 데모가 지금 올리고
 * 있는 장면과 화면을 맞추는 방법이다 — 반복하면 서버로 간 조각과 화면이 어긋난다.
 * 끝나면 마지막 장면에 머문다. 끝난 영상에 play() 를 부르면 처음부터 다시 트니 부르지 않는다.
 * 브라우저는 뒤로 간 탭의 음소거 영상을 멈춘다. 돌아오면 그동안 흐른 만큼 앞으로 맞춘다.
 */
const LiveImage = ({ camera, quality }: { camera: SelectedCamera; quality: 'tile' | 'full' }) => {
  const preview = usePreview(camera.rtspUri, { key: `live-${quality}-${camera.id}`, quality })
  const videoRef = useRef<HTMLVideoElement>(null)
  // 스트림·파일을 못 그리면 깨진 그림 아이콘 대신 이유를 적고, 5초 뒤 다시 그려 본다 (미리보기 서버가
  // 잠깐 끊겼다 돌아오는 경우). 새 주소를 받아도 다시 그린다.
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => setFailed(false), [preview.url])
  useEffect(() => {
    if (!failed) return
    const timer = setTimeout(() => {
      setFailed(false)
      setAttempt((count) => count + 1)
    }, 5000)
    return () => clearTimeout(timer)
  }, [failed])

  useEffect(() => {
    const start = preview.url ? /#t=([\d.]+)/.exec(preview.url)?.[1] : undefined
    if (start === undefined) return
    const mountedAt = Date.now()
    const resync = (): void => {
      const video = videoRef.current
      if (!video || document.visibilityState !== 'visible') return
      const target = Number(start) + (Date.now() - mountedAt) / 1000
      if (Number.isFinite(video.duration) && target >= video.duration) {
        video.pause()
        video.currentTime = video.duration
        return
      }
      if (Math.abs(video.currentTime - target) > 1) video.currentTime = target
      void video.play().catch(() => undefined)
    }
    document.addEventListener('visibilitychange', resync)
    return () => document.removeEventListener('visibilitychange', resync)
  }, [preview.url])

  if (preview.url && !failed) {
    return /\.(mp4|webm)([?#]|$)/.test(preview.url) ? (
      <video
        key={attempt}
        ref={videoRef}
        src={preview.url}
        className={FILL}
        autoPlay
        loop={!/#t=/.test(preview.url)}
        muted
        playsInline
        // autoPlay 속성만으로는 브라우저가 거를 때가 있다. 준비되면 한 번 더 밀어 본다.
        onLoadedData={(event) => {
          if (!event.currentTarget.ended) void event.currentTarget.play().catch(() => undefined)
        }}
        onError={() => setFailed(true)}
      />
    ) : (
      <img key={attempt} src={preview.url} alt="" className={FILL} onError={() => setFailed(true)} />
    )
  }
  if (preview.error || failed) return <span className="px-4 text-center">화면을 불러오지 못했습니다</span>
  return <Spinner className="text-gray-500" />
}

const CameraCard = ({
  tile,
  quality,
  now,
  onSelect,
  onDelete,
  compact = false,
  className,
}: {
  tile: TileModel
  quality: 'tile' | 'full'
  now: number
  onSelect?: () => void
  /** 있으면 타일 모서리에 삭제 버튼을 둔다 — 서버에 등록된 카메라(tile.server)만 지울 수 있다. */
  onDelete?: () => void
  /** '하나 크게' 아래 줄의 작은 카드 — 상태 글은 빼고 점만 둔다. 글까지 두면 이름이 한 글자로 잘린다. */
  compact?: boolean
  className?: string
}) => {
  const [confirming, setConfirming] = useState(false)
  const state = tile.runtime?.camera ?? 'idle'
  const streaming = state === 'streaming'
  const broken = state === 'reconnecting' || state === 'auth-failed'
  const disconnectedFor = tile.server?.disconnectedForSec ?? null
  const lastFrame = tile.server?.lastFrameAt ?? null
  const label = `CAM ${String(tile.index + 1).padStart(2, '0')}`

  // 2c — '연결됨 · 방금 분석' / '연결됨 · 1분 전'. 마지막 조각이 올라간 시각 기준이다.
  const ago = formatAgo(tile.server?.lastSegmentAt ?? null, now)
  const statusText = streaming
    ? `연결됨 · ${ago === '방금' ? '방금 분석' : (ago ?? '대기 중')}`
    : state === 'auth-failed'
      ? '카메라 인증 실패'
      : broken
        ? `끊김${disconnectedFor ? ` ${formatDuration(disconnectedFor)}` : ''}`
        : state === 'connecting'
          ? '연결 중'
          : '중지'

  return (
    <div
      className={cn(
        'group relative flex min-h-0 flex-col overflow-hidden rounded-card bg-surface shadow-card',
        // 2c — 끊긴 카메라는 error/300 1.5px 테두리
        broken && 'shadow-[inset_0_0_0_1.5px_var(--error-300)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-card text-left',
          onSelect && 'transition hover:shadow-[inset_0_0_0_2px_var(--blue-600)]',
        )}
      >
        {broken ? (
          <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-1.5 bg-gray-100 text-caption text-gray-600">
            <span className="text-[20px]">◌</span>
            {state === 'auth-failed'
              ? '비밀번호를 확인해 주세요'
              : `재연결 중${lastFrame ? ` · 마지막 화면 ${formatClock(lastFrame)}` : ''}`}
          </div>
        ) : (
          <VideoSurface className="min-h-0 flex-1 aspect-auto">
            {tile.local && streaming && <LiveImage camera={tile.local} quality={quality} />}
            {!tile.local && <span>이 PC에 연결 정보가 없습니다</span>}
            {tile.local && !streaming && state !== 'connecting' && <span>감시 중지됨</span>}
            {state === 'connecting' && <Spinner className="text-gray-500" />}
            <span className="absolute left-2.5 top-2.5 rounded-[6px] bg-[rgb(0_0_0/.55)] px-2 py-[3px] text-[12px] text-white">
              {label}
              {streaming ? ' · LIVE' : ''}
            </span>
          </VideoSurface>
        )}
        {/* <button> 의 자식은 flex-col 에서도 폭을 채우지 않는다 — 이름·상태를 양 끝으로 벌리려면 w-full. */}
        <div className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5">
          <span className="truncate text-[15px] font-semibold">{tile.name}</span>
          <span
            title={compact ? statusText : undefined}
            className={cn(
              'flex shrink-0 items-center gap-[5px] text-caption',
              broken ? 'font-semibold text-error-main' : 'text-gray-600',
            )}
          >
            <StatusDot
              className="size-[7px]"
              tone={streaming ? 'connected' : broken ? 'disconnected' : state === 'connecting' ? 'reconnecting' : 'idle'}
            />
            {!compact && statusText}
          </span>
        </div>
      </button>
      {onDelete &&
        (confirming ? (
          <div
            className="absolute right-2 top-2 flex gap-1 rounded-chip bg-[rgb(0_0_0/.7)] p-1"
            // 타일 전체가 onSelect 버튼이라, 여기서 난 클릭이 그 버튼까지 뚫고 가지 않게 한다.
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-[4px] px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/20"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="rounded-[4px] bg-error-500 px-2 py-1 text-[11px] font-semibold text-white hover:bg-error-600"
            >
              삭제
            </button>
          </div>
        ) : (
          <button
            type="button"
            aria-label={`${tile.name} 삭제`}
            onClick={(event) => {
              event.stopPropagation()
              setConfirming(true)
            }}
            className={cn(
              'absolute right-2 top-2 flex size-6 items-center justify-center rounded-full',
              'bg-[rgb(0_0_0/.55)] text-[13px] text-white opacity-0 transition',
              'hover:bg-error-500 group-hover:opacity-100',
            )}
          >
            ✕
          </button>
        ))}
    </div>
  )
}

const AddCameraSlot = ({ remaining, onClick }: { remaining: number; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'flex flex-col items-center justify-center gap-1.5 rounded-card',
      'border-[1.5px] border-dashed border-gray-500 text-gray-600',
      'transition hover:border-brand-sub hover:text-brand-sub',
    )}
  >
    <span className="text-[28px] leading-none">+</span>
    <span className="text-body-sm font-semibold">카메라 추가</span>
    <span className="text-caption">{remaining}자리 남음</span>
  </button>
)

/* ------------------------------------------------------------- 위험 신호 */

type FeedFilter = 'all' | 'unconfirmed' | 'high'

const FeedItem = ({ event, onOpen }: { event: EventListItem; onOpen: () => void }) => {
  const unconfirmed = event.state === 'unconfirmed'
  const falsePositive = event.state === 'false_positive'
  const highlight = unconfirmed && event.risk === 'high'

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        'flex gap-3 rounded-card p-3 text-left transition',
        highlight && 'bg-error-50 shadow-[inset_0_0_0_1.5px_var(--error-600)]',
        unconfirmed && !highlight && 'shadow-[inset_0_0_0_1px_var(--gray-300)]',
        // 2c — 확인됨·오탐은 흐리게
        !unconfirmed && 'opacity-60',
        'hover:shadow-[inset_0_0_0_1.5px_var(--blue-600)]',
      )}
    >
      <VideoSurface className="h-[60px] w-24 shrink-0 rounded-small aspect-auto">
        {event.thumbnailUrl && (
          <img src={event.thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover" />
        )}
      </VideoSurface>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'truncate text-[15px] font-semibold',
              falsePositive && 'text-gray-600 line-through',
            )}
          >
            {EVENT_TITLE}
          </span>
          {unconfirmed && (
            <Tag tone={event.risk} className="px-2 py-0.5 text-[11px]">
              {RISK_LABEL[event.risk]}
            </Tag>
          )}
        </div>
        <div className="mt-0.5 text-caption text-gray-600">
          {event.cameraName ?? '카메라'} · {formatClock(event.startedAt)} ·{' '}
          {falsePositive ? '오탐 처리' : STATE_LABEL[event.state]}
        </div>
      </div>
    </button>
  )
}

const FilterChip = ({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: string
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'inline-flex items-center whitespace-nowrap rounded-chip px-3 py-1 text-caption font-semibold transition',
      active
        ? 'bg-brand-main text-white'
        : 'text-gray-700 shadow-[inset_0_0_0_1px_var(--gray-300)] hover:bg-gray-100',
    )}
  >
    {children}
  </button>
)

const TodayFeed = ({ storeId }: { storeId: string }) => {
  const navigate = useNavigate()
  const { resyncToken } = useStream()
  const [filter, setFilter] = useState<FeedFilter>('all')
  const today = localDateKey()

  const events = useResource(() => listEvents(storeId, { ...localDayRange(today), limit: 100 }), [
    storeId,
    today,
    resyncToken,
  ])

  useStreamMessages((message) => {
    if (message.type === 'event.created') {
      events.mutate((page) => ({ ...page, items: [message.data, ...page.items] }))
    }
    if (message.type === 'event.updated') {
      events.mutate((page) => ({
        ...page,
        items: page.items.map((item) => (item.id === message.data.id ? message.data : item)),
      }))
    }
  })

  const items = events.data?.items ?? []
  const unconfirmed = items.filter((item) => item.state === 'unconfirmed')
  // 계약 5.1 과 같은 순서 — 미확인 먼저, 그다음 최신순. SSE 로 끼워 넣은 항목도 맞춘다.
  const sorted = useMemo(
    () =>
      items.toSorted(
        (a, b) =>
          Number(b.state === 'unconfirmed') - Number(a.state === 'unconfirmed') ||
          Date.parse(b.startedAt) - Date.parse(a.startedAt),
      ),
    [items],
  )
  const visible = sorted.filter((item) =>
    filter === 'all' ? true : filter === 'unconfirmed' ? item.state === 'unconfirmed' : item.risk === 'high',
  )

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-card bg-surface shadow-card">
      <div className="flex items-center justify-between px-5 pb-3 pt-5">
        <h2 className="text-h3">오늘 위험 신호</h2>
        {unconfirmed.length > 0 && <Tag tone="alert">미확인 {unconfirmed.length}</Tag>}
      </div>
      <div className="flex gap-1.5 px-5 pb-3">
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')}>
          {`전체 ${items.length}`}
        </FilterChip>
        <FilterChip active={filter === 'unconfirmed'} onClick={() => setFilter('unconfirmed')}>
          미확인
        </FilterChip>
        <FilterChip active={filter === 'high'} onClick={() => setFilter('high')}>
          높음만
        </FilterChip>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pb-3">
        {events.loading && !events.data && (
          <div className="flex justify-center py-10 text-gray-600">
            <Spinner />
          </div>
        )}
        {events.error && <p className="px-2 py-6 text-center text-caption text-error-main">{events.error}</p>}
        {events.data && visible.length === 0 && (
          <p className="px-2 py-10 text-center text-caption text-gray-600">
            {filter === 'all' ? '오늘은 아직 위험 신호가 없습니다.' : '조건에 맞는 위험 신호가 없습니다.'}
          </p>
        )}
        {visible.map((event) => (
          <FeedItem key={event.id} event={event} onOpen={() => navigate(`/events/${event.id}`)} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => navigate('/events')}
        className="border-t border-gray-200 px-5 py-4 text-center text-[15px] font-semibold text-brand-sub hover:bg-gray-50"
      >
        전체 기록 보기 →
      </button>
    </section>
  )
}

/* ------------------------------------------------------------------ 화면 */

export const Live = () => {
  const navigate = useNavigate()
  const store = useConnectedStore()
  const { config, status, updateConfig } = useSession()
  const { resyncToken } = useStream()
  const [layout, setLayout] = useState<'grid' | 'single'>('grid')
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [pausing, setPausing] = useState(false)
  const [removingKey, setRemovingKey] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const monitoring = useResource(() => getMonitoring(store.id), [store.id, resyncToken])

  // 카메라 관리(설정)와 같은 절차 — 서버에서 지우고, 이 PC 의 감시 목록에서도 뺀 뒤 다시 건다.
  const removeCamera = async (tile: TileModel) => {
    if (!tile.server || removingKey) return
    setRemovingKey(tile.key)
    try {
      await deleteCamera(tile.server.id)
      const next = config.cameras.filter((camera) => camera.id !== tile.key)
      if (next.length === 0) await api.stop()
      else await api.start(next)
      await updateConfig({ cameras: next })
      if (focusKey === tile.key) setFocusKey(null)
      await monitoring.reload()
    } finally {
      setRemovingKey(null)
    }
  }

  // '1분 전' 같은 상대 시각이 멈춰 보이지 않게, 그리고 lastAnalyzedAt 을 따라가게.
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now())
      void monitoring.reload()
    }, 30_000)
    return () => clearInterval(timer)
  }, [monitoring.reload])

  useStreamMessages((message) => {
    if (message.type !== 'camera.state') return
    monitoring.mutate((current) => ({
      ...current,
      cameras: current.cameras.map((camera) =>
        camera.id === message.data.cameraId
          ? { ...camera, state: message.data.state, lastFrameAt: message.data.lastFrameAt }
          : camera,
      ),
    }))
  })

  const tiles: readonly TileModel[] = useMemo(() => {
    const serverByAgentId = new Map((monitoring.data?.cameras ?? []).map((camera) => [camera.agentCameraId, camera]))
    const runtimeById = new Map(status.cameras.map((runtime) => [runtime.cameraId, runtime]))
    return config.cameras.map((local, index) => {
      const server = serverByAgentId.get(local.id) ?? null
      return {
        key: local.id,
        index,
        name: server?.name ?? local.name,
        local,
        runtime: runtimeById.get(local.id) ?? null,
        server,
      }
    })
  }, [config.cameras, monitoring.data, status.cameras])

  const streamingCount = tiles.filter((tile) => tile.runtime?.camera === 'streaming').length
  const pending = status.cameras.reduce((sum, camera) => sum + camera.pendingCount, 0)
  const upload = UPLOAD_INDICATOR[status.upload]
  const speed = SPEED_OPTIONS.find((option) => option.value === config.segmentSeconds)?.label ?? `${config.segmentSeconds}초`
  const focused = tiles.find((tile) => tile.key === focusKey) ?? tiles[0] ?? null

  const togglePause = async () => {
    setPausing(true)
    try {
      if (status.running) await api.stop()
      else await api.start(config.cameras)
    } finally {
      setPausing(false)
    }
  }

  return (
    <div className="grid h-full min-h-[720px] grid-cols-[1fr_380px] gap-4 px-page pb-8 pt-7">
      <div className="flex min-h-0 min-w-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-5">
            <h1 className="shrink-0 whitespace-nowrap text-h1">실시간</h1>
            {/* 2c 는 5대 중 4대만 붙어 있어도 초록이다 — 한 대라도 보고 있으면 감시 중이다. */}
            <Indicator tone={status.running && streamingCount > 0 ? 'good' : 'bad'}>
              {status.running ? `감시 중 ${streamingCount}/${tiles.length}대` : '감시 중지됨'}
            </Indicator>
            <Indicator tone={upload.tone}>{upload.label}</Indicator>
            <span className="truncate text-body-sm font-normal text-gray-600">
              {monitoring.data?.lastAnalyzedAt
                ? `마지막 AI 분석 ${formatClock(monitoring.data.lastAnalyzedAt)} · `
                : ''}
              알림 지연 최대 {speed}
            </span>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <Segmented
              value={layout}
              onChange={setLayout}
              options={[
                { value: 'grid', label: '▦ 격자' },
                { value: 'single', label: '▭ 하나 크게' },
              ]}
            />
            <Button variant="secondary" loading={pausing} onClick={() => void togglePause()}>
              {status.running ? '일시 중지 (영업 중)' : '감시 다시 시작'}
            </Button>
          </div>
        </div>

        {tiles.length === 0 ? (
          <div className={cn('grid min-h-0 flex-1 grid-cols-3 gap-3', gridRowsFor(1))}>
            <AddCameraSlot remaining={MAX_CAMERAS} onClick={() => navigate('/cameras/add')} />
          </div>
        ) : layout === 'grid' ? (
          <div
            className={cn(
              'grid min-h-0 flex-1 grid-cols-3 gap-3',
              gridRowsFor(tiles.length + (tiles.length < MAX_CAMERAS ? 1 : 0)),
            )}
          >
            {tiles.map((tile) => (
              <CameraCard
                key={tile.key}
                tile={tile}
                quality="tile"
                now={now}
                onSelect={() => {
                  setFocusKey(tile.key)
                  setLayout('single')
                }}
                onDelete={tile.server ? () => void removeCamera(tile) : undefined}
              />
            ))}
            {tiles.length < MAX_CAMERAS && (
              <AddCameraSlot remaining={MAX_CAMERAS - tiles.length} onClick={() => navigate('/cameras/add')} />
            )}
          </div>
        ) : (
          // '하나 크게'는 디자인에 펼친 화면이 없다. 격자와 같은 카드를 크게 하나,
          // 나머지는 아래 한 줄로 둬서 누르면 바꾼다.
          <div className="flex min-h-0 flex-1 flex-col gap-3">
            {focused && <CameraCard tile={focused} quality="full" now={now} className="flex-1" />}
            <div className="grid h-[132px] shrink-0 grid-cols-6 gap-3">
              {tiles
                .filter((tile) => tile.key !== focused?.key)
                .map((tile) => (
                  <CameraCard
                    key={tile.key}
                    tile={tile}
                    quality="tile"
                    now={now}
                    compact
                    onSelect={() => setFocusKey(tile.key)}
                  />
                ))}
            </div>
          </div>
        )}

        <div className="flex gap-5 text-caption text-gray-600">
          <span>오늘 전송 {formatBytes(status.bytesUploadedToday)}</span>
          <span>대기 {pending}조각</span>
          <span>알림 빠르기 {speed}</span>
          <span>PC 재부팅 시 자동 시작 {config.autoStart ? '✓' : '꺼짐'}</span>
        </div>
      </div>

      <TodayFeed storeId={store.id} />
    </div>
  )
}
