/**
 * 2f 클립 상세 — 전후 탐색 · 동시각 카메라 · 증거.
 * 값: design/씬스틸러 PC 앱.dc.html 의 2f 인라인 스타일.
 *
 * 메인 플레이어는 하이라이트 클립이 아니라 원본 조각을 튼다 — "전후"를 보려면 위험
 * 구간 앞뒤가 이어져 있어야 한다. 조각은 벽시계에 맞춰 잘려 있어서(alignToClock)
 * 같은 시각의 다른 카메라 조각을 그대로 나란히 틀 수 있다.
 *
 * 디자인과 다르게 한 것:
 *  - '증거 묶음 내보내기'는 비활성이다. 요구사항 5.3 이 후순위라 백엔드에 없고,
 *    누르면 아무 일도 안 일어나는 1차 버튼을 둘 수는 없다. 그래서 드래그 범위
 *    선택도 넣지 않았다 (쓸 곳이 없다).
 *  - '클립만 저장 · 공유 링크 (7일)' → '클립만 저장'. 공유 링크(5.2)가 아직 없다.
 *  - 플레이어의 '📷 스냅샷'을 뺐다. 요구사항 목록에 없고, 저장할 경로를 따로 열어야 한다.
 *  - 위험 종류 분류를 하지 않기로 해서 제목은 '이상 행동 · 카메라' 이고 오른쪽 위
 *    'AI 설명' 칸이 없다 — AI 는 평소와 다른 움직임 구간과 점수만 준다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import type { EventDetail, EventState, NearbyCamera, SegmentDto } from '../../../shared/server-types'
import { useConnectedStore } from '../../app/session'
import { useStreamMessages } from '../../app/stream'
import { MemoBox } from '../../components/MemoBox'
import { Button, Notice, Segmented, Spinner, Tag, VideoSurface } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { EVENT_TITLE, RISK_LABEL, RISK_TONE } from '../../lib/labels'
import { buildPoliceReport } from '../../lib/police-report'
import { segmentIn } from '../../lib/segments'
import {
  changeEventState,
  getClip,
  getEvent,
  getNearbyCameras,
  listCameras,
  listEvents,
  listSegments,
  ServerError,
} from '../../lib/server-api'
import {
  formatClock,
  formatClockSeconds,
  formatDuration,
  formatFullDateTime,
  formatStamp,
  localDateKey,
  localDayRange,
} from '../../lib/time'

/** 조각 타임라인에 한 번에 보여줄 칸 수 (디자인 #1282 ~ #1285). */
const SLOTS = 4
/** 이벤트 조각이 몇 번째 칸에 오는가 (디자인은 세 번째). */
const EVENT_SLOT = 2
/** 원본 조각은 서버에 7일 보관된다 (요구사항 5.5). */
const RETENTION_MS = 7 * 86_400_000

interface MainSource {
  readonly cameraId: string
  readonly cameraName: string
  readonly url: string | null
  readonly segmentStartedAt: string
  /** 조각 안에서 이벤트 시각까지 */
  readonly offsetSec: number
}

/* ------------------------------------------------------------ 조각 타임라인 */

const SegmentTimeline = ({
  slotStarts,
  segmentMs,
  segments,
  event,
  selectedStart,
  playheadAt,
  onPick,
  onShift,
  canGoBack,
  canGoForward,
}: {
  slotStarts: readonly number[]
  segmentMs: number
  segments: readonly SegmentDto[]
  event: EventDetail
  selectedStart: number
  /** 지금 틀고 있는 지점 (epoch ms). 조각이 칸보다 늦게 시작하므로 칸 시작으로는 셀 수 없다. */
  playheadAt: number
  onPick: (start: number) => void
  onShift: (slots: number) => void
  canGoBack: boolean
  canGoForward: boolean
}) => {
  const eventStart = Date.parse(event.startedAt)
  const eventEnd = Date.parse(event.endedAt)
  const windowStart = slotStarts[0] ?? 0
  const windowMs = segmentMs * SLOTS
  const playhead = ((playheadAt - windowStart) / windowMs) * 100
  // 눈금은 칸의 경계(칸 수 + 1)다 — 칸 시작만 찍으면 맨 오른쪽 글자가 마지막 칸의 '시작'인데 '끝' 자리에 선다.
  // 조각이 분 단위가 아니면(웹 체험판 30초) 시·분만으로는 이웃 눈금이 같은 글자가 되므로 초까지 적는다.
  const ticks = [...slotStarts, windowStart + windowMs]
  const withSeconds = ticks.some((tick) => new Date(tick).getSeconds() !== 0)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-caption text-gray-600">
        {ticks.map((tick) => (
          <span key={tick}>{(withSeconds ? formatClockSeconds : formatClock)(new Date(tick).toISOString())}</span>
        ))}
      </div>
      <div className="relative flex h-9 overflow-hidden rounded-small bg-gray-100">
        {slotStarts.map((start, index) => {
          const segment = segmentIn(segments, start, start + segmentMs)
          const inSlot = eventStart < start + segmentMs && eventEnd > start
          return (
            <button
              key={start}
              type="button"
              disabled={!segment}
              onClick={() => onPick(start)}
              className={cn(
                'relative flex flex-1 items-center justify-center text-[12px] text-gray-600',
                index < SLOTS - 1 && 'border-r border-dashed border-gray-300',
                segment ? 'hover:bg-gray-200' : 'cursor-default',
                start === selectedStart && 'bg-blue-50 font-semibold text-gray-900',
              )}
            >
              {/* 영상 없는 칸은 2e 타임라인과 같은 점선으로 */}
              {!segment && (
                <span className="absolute inset-0 bg-[repeating-linear-gradient(90deg,var(--gray-300)_0_4px,transparent_4px_8px)] opacity-60" />
              )}
              <span className="relative">
                {segment ? `${index === 0 ? '조각 ' : ''}#${segment.sequence ?? '—'}` : '영상 없음'}
              </span>
              {inSlot && (
                <span
                  className="absolute inset-y-1.5 rounded-[4px] bg-risk-high opacity-85"
                  style={{
                    left: `${Math.max(0, (eventStart - start) / segmentMs) * 100}%`,
                    width: `${Math.max(2, ((Math.min(eventEnd, start + segmentMs) - Math.max(eventStart, start)) / segmentMs) * 100)}%`,
                  }}
                />
              )}
            </button>
          )
        })}
        {playhead >= 0 && playhead <= 100 && (
          <span className="pointer-events-none absolute inset-y-0 w-0.5 bg-brand-main" style={{ left: `${playhead}%` }} />
        )}
      </div>
      <div className="flex justify-between text-caption text-gray-600">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => onShift(-SLOTS)}
          className="font-semibold text-brand-sub disabled:text-gray-500"
        >
          ◂ 더 이전 (7일 내)
        </button>
        <span>빨간 구간 = AI 위험 판정</span>
        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => onShift(SLOTS)}
          className="font-semibold text-brand-sub disabled:text-gray-500"
        >
          더 이후 ▸
        </button>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------- 메인 플레이어 */

const MainPlayer = ({
  source,
  cameraIndex,
  videoRef,
  onPosition,
  onPrevSegment,
  onNextSegment,
}: {
  source: MainSource
  cameraIndex: number
  videoRef: React.RefObject<HTMLVideoElement | null>
  onPosition: (seconds: number) => void
  onPrevSegment: () => void
  onNextSegment: () => void
}) => {
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [position, setPosition] = useState(source.offsetSec)
  const clock = formatClockSeconds(new Date(Date.parse(source.segmentStartedAt) + position * 1000).toISOString())

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.playbackRate = speed
  }, [speed, videoRef])

  const seek = (delta: number) => {
    const video = videoRef.current
    if (video) video.currentTime = Math.max(0, video.currentTime + delta)
  }

  return (
    <VideoSurface className="aspect-auto h-[300px] rounded-card">
      {source.url ? (
        <video
          ref={videoRef}
          key={source.url}
          src={source.url}
          muted
          playsInline
          autoPlay
          className="absolute inset-0 size-full object-contain"
          onLoadedMetadata={(event) => {
            // 이벤트 시각부터 틀어야 사장님이 찾지 않는다.
            event.currentTarget.currentTime = source.offsetSec
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            setPosition(event.currentTarget.currentTime)
            onPosition(event.currentTarget.currentTime)
          }}
        />
      ) : (
        <span className="relative rounded-[6px] bg-[rgb(0_0_0/.55)] px-3 py-1.5 text-white">
          이 조각의 영상이 없습니다
        </span>
      )}
      <span className="absolute left-3 top-3 rounded-[6px] bg-[rgb(0_0_0/.55)] px-2 py-1 text-[12px] text-white">
        CAM {String(cameraIndex + 1).padStart(2, '0')} {source.cameraName} ·{' '}
        {formatStamp(new Date(Date.parse(source.segmentStartedAt) + position * 1000).toISOString())}
      </span>
      <div className="absolute inset-x-3 bottom-3 flex h-10 items-center gap-3.5 rounded-small bg-[rgb(0_0_0/.55)] px-3.5 text-caption text-white">
        <button
          type="button"
          aria-label={playing ? '일시정지' : '재생'}
          disabled={!source.url}
          onClick={() => {
            const video = videoRef.current
            if (!video) return
            if (video.paused) void video.play()
            else video.pause()
          }}
          className="w-4"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="flex gap-2">
          <button type="button" aria-label="이전 조각" onClick={onPrevSegment}>
            |◂
          </button>
          <button type="button" aria-label="10초 뒤로" onClick={() => seek(-10)}>
            ◂
          </button>
          <button type="button" aria-label="10초 앞으로" onClick={() => seek(10)}>
            ▸
          </button>
          <button type="button" aria-label="다음 조각" onClick={onNextSegment}>
            ▸|
          </button>
        </span>
        <span className="tabular-nums">{clock}</span>
        <span className="flex-1" />
        <button type="button" onClick={() => setSpeed((current) => (current === 1 ? 2 : current === 2 ? 0.5 : 1))}>
          {speed}×
        </button>
        <button type="button" aria-label="전체 화면" onClick={() => void videoRef.current?.requestFullscreen()}>
          ⛶
        </button>
      </div>
    </VideoSurface>
  )
}

/* ------------------------------------------------------------ 동시각 카메라 */

const NearbyTile = ({
  camera,
  mainVideo,
  mainOffsetSec,
  onSwap,
}: {
  camera: NearbyCamera
  mainVideo: React.RefObject<HTMLVideoElement | null>
  mainOffsetSec: number
  onSwap: () => void
}) => {
  const video = useRef<HTMLVideoElement>(null)

  // 동기 재생 — 메인의 '이벤트 시각으로부터 몇 초'에 맞춘다. 0.7초 넘게 어긋날 때만
  // 맞춰서, 계속 currentTime 을 건드려 끊기는 걸 막는다.
  useEffect(() => {
    const main = mainVideo.current
    const tile = video.current
    if (!main || !tile) return
    const sync = () => {
      const target = camera.offsetSec + (main.currentTime - mainOffsetSec)
      if (Math.abs(tile.currentTime - target) > 0.7) tile.currentTime = Math.max(0, target)
      if (main.paused !== tile.paused) void (main.paused ? tile.pause() : tile.play())
    }
    main.addEventListener('timeupdate', sync)
    main.addEventListener('play', sync)
    main.addEventListener('pause', sync)
    return () => {
      main.removeEventListener('timeupdate', sync)
      main.removeEventListener('play', sync)
      main.removeEventListener('pause', sync)
    }
  }, [camera.offsetSec, mainOffsetSec, mainVideo])

  const noVideo = !camera.playbackUrl
  return (
    <button
      type="button"
      onClick={onSwap}
      disabled={noVideo}
      className={cn(
        'overflow-hidden rounded-[10px] text-left shadow-[inset_0_0_0_1px_var(--gray-300)]',
        noVideo ? 'opacity-[.55]' : 'hover:shadow-[inset_0_0_0_1.5px_var(--blue-600)]',
      )}
    >
      {noVideo ? (
        <div className="flex h-[110px] items-center justify-center bg-gray-100 text-caption text-gray-600">영상 없음</div>
      ) : (
        <VideoSurface className="aspect-auto h-[110px]">
          <video
            ref={video}
            src={camera.playbackUrl ?? undefined}
            muted
            playsInline
            className="absolute inset-0 size-full object-cover"
            onLoadedMetadata={(event) => {
              event.currentTarget.currentTime = camera.offsetSec
            }}
          />
        </VideoSurface>
      )}
      <div className="px-2.5 py-2 text-caption">
        <b>{camera.name ?? '카메라'}</b>
        {noVideo && ' · 영상 없음'}
      </div>
    </button>
  )
}

/* ------------------------------------------------------------------ 화면 */

export const EventDetailScreen = () => {
  const { eventId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const store = useConnectedStore()
  const mainVideo = useRef<HTMLVideoElement>(null)

  const detail = useResource(() => getEvent(eventId), [eventId])
  const nearby = useResource(() => getNearbyCameras(eventId), [eventId])
  const cameras = useResource(() => listCameras(store.id), [store.id])
  const [notice, setNotice] = useState<{ tone: 'info' | 'bad'; text: string } | null>(null)
  const [savingState, setSavingState] = useState(false)

  const event = detail.data
  const segmentMs = store.segmentSeconds * 1000
  const eventSlotStart = event ? Math.floor(Date.parse(event.startedAt) / segmentMs) * segmentMs : 0

  // 창을 옮겨도 이벤트 조각을 기준으로 센다.
  const [windowShift, setWindowShift] = useState(0)
  const [selectedStart, setSelectedStart] = useState<number | null>(null)
  const [mainCameraId, setMainCameraId] = useState<string | null>(null)
  const [position, setPosition] = useState(0)

  useEffect(() => {
    setWindowShift(0)
    setSelectedStart(null)
    setMainCameraId(null)
    setNotice(null)
  }, [eventId])

  const cameraId = mainCameraId ?? event?.cameraId ?? null
  const slotStarts = useMemo(
    () => Array.from({ length: SLOTS }, (_, index) => eventSlotStart + (index - EVENT_SLOT + windowShift) * segmentMs),
    [eventSlotStart, windowShift, segmentMs],
  )

  const segments = useResource(
    async () =>
      cameraId && event
        ? listSegments(store.id, {
            cameraId,
            from: new Date(slotStarts[0] ?? 0).toISOString(),
            to: new Date((slotStarts[SLOTS - 1] ?? 0) + segmentMs).toISOString(),
          })
        : [],
    [store.id, cameraId, event?.id, slotStarts[0], segmentMs],
  )

  // 앞뒤 사건 — 같은 날의 이벤트를 시각순으로.
  const day = event ? localDateKey(new Date(event.startedAt)) : null
  const siblings = useResource(
    async () => (day ? (await listEvents(store.id, { ...localDayRange(day), limit: 100 })).items : []),
    [store.id, day],
  )

  useStreamMessages((message) => {
    if (message.type === 'event.updated' && message.data.id === eventId) {
      detail.mutate((current) => ({ ...current, ...message.data }))
    }
  })

  // 2d 의 '같은 시각 다른 카메라' 로 들어오면 그 칸으로 내린다.
  useEffect(() => {
    if (location.hash === '#nearby' && nearby.data) {
      document.getElementById('nearby')?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [location.hash, nearby.data])

  if (!event) {
    return (
      <div className="flex h-full items-center justify-center text-gray-600">
        {detail.error ? <Notice tone="bad">{detail.error}</Notice> : <Spinner />}
      </div>
    )
  }

  const activeStart = selectedStart ?? eventSlotStart
  const segmentList = segments.data ?? []
  const activeSegment = segmentIn(segmentList, activeStart, activeStart + segmentMs)
  const cameraName =
    cameras.data?.find((camera) => camera.id === cameraId)?.name ?? event.cameraName ?? '카메라'
  const cameraIndex = Math.max(0, cameras.data?.findIndex((camera) => camera.id === cameraId) ?? 0)
  // 재생 위치는 칸이 아니라 조각 안에서 센다 — 조각은 칸 중간(13:40:35)에서 시작한다.
  const segmentStart = activeSegment ? Date.parse(activeSegment.startedAt) : activeStart
  const playFrom = activeStart === eventSlotStart ? Date.parse(event.startedAt) : activeStart
  const source: MainSource = {
    cameraId: cameraId ?? event.cameraId,
    cameraName,
    url: activeSegment?.playbackUrl ?? null,
    segmentStartedAt: new Date(segmentStart).toISOString(),
    offsetSec: Math.max(0, (playFrom - segmentStart) / 1000),
  }

  const ordered = (siblings.data ?? []).toSorted((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt))
  const index = ordered.findIndex((item) => item.id === event.id)
  const previous = index > 0 ? ordered[index - 1] : undefined
  const next = index >= 0 ? ordered[index + 1] : undefined

  const oldestAllowed = Date.now() - RETENTION_MS
  const canGoBack = (slotStarts[0] ?? 0) - SLOTS * segmentMs >= oldestAllowed
  const canGoForward = (slotStarts[SLOTS - 1] ?? 0) + segmentMs < Date.now()

  const pickSegment = (start: number) => {
    setSelectedStart(start)
    setPosition(0)
  }
  const stepSegment = (delta: number) => {
    const target = activeStart + delta * segmentMs
    const first = slotStarts[0] ?? target
    const last = slotStarts[SLOTS - 1] ?? target
    // 창 밖으로 넘어가면 창도 한 칸 따라간다.
    if (target < first || target > last) setWindowShift((shift) => shift + delta)
    pickSegment(target)
  }

  const decide = async (state: EventState) => {
    if (state === event.state) return
    setSavingState(true)
    try {
      const updated = await changeEventState(event.id, state)
      detail.mutate((current) => ({ ...current, state: updated.state }))
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof ServerError ? error.message : '상태를 바꾸지 못했습니다.' })
    } finally {
      setSavingState(false)
    }
  }

  const copyReport = async () => {
    await api.copyText(
      buildPoliceReport({
        storeName: store.name,
        address: store.address,
        cameraName: event.cameraName,
        riskLabel: RISK_LABEL[event.risk],
        startedAt: event.startedAt,
        endedAt: event.endedAt,
      }),
    )
    setNotice({ tone: 'info', text: '112 신고 안내문을 복사했습니다.' })
  }

  const saveClip = async () => {
    try {
      await api.openExternal((await getClip(event.id)).url)
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof ServerError ? error.message : '클립을 열지 못했습니다.' })
    }
  }

  return (
    <div className="flex h-full min-h-[820px] flex-col gap-4 px-page pb-8 pt-6">
      <div className="flex items-center gap-4">
        <button
          type="button"
          aria-label="뒤로"
          onClick={() => navigate(-1)}
          className="text-[22px] text-gray-700 hover:text-brand-sub"
        >
          ‹
        </button>
        <h1 className="text-h2">
          {EVENT_TITLE} · {event.cameraName ?? '카메라'}
        </h1>
        <Tag tone={RISK_TONE[event.risk]}>{RISK_LABEL[event.risk]}</Tag>
        <span className="text-body-sm font-normal text-gray-600">
          {formatFullDateTime(event.startedAt)} – {formatClockSeconds(event.endedAt)}
          {event.durationSec !== null && ` (${formatDuration(event.durationSec)})`}
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" disabled={!previous} onClick={() => previous && navigate(`/events/${previous.id}`)}>
            ◂ 이전 사건
          </Button>
          <Button variant="secondary" disabled={!next} onClick={() => next && navigate(`/events/${next.id}`)}>
            다음 사건 ▸
          </Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px] gap-4">
        <div className="flex min-w-0 flex-col gap-3">
          <section className="flex flex-col gap-3 rounded-card bg-surface p-4 shadow-card">
            <MainPlayer
              source={source}
              cameraIndex={cameraIndex}
              videoRef={mainVideo}
              onPosition={setPosition}
              onPrevSegment={() => stepSegment(-1)}
              onNextSegment={() => stepSegment(1)}
            />
            <SegmentTimeline
              slotStarts={slotStarts}
              segmentMs={segmentMs}
              segments={segmentList}
              event={event}
              selectedStart={activeStart}
              playheadAt={segmentStart + position * 1000}
              onPick={pickSegment}
              onShift={(slots) => setWindowShift((shift) => shift + slots)}
              canGoBack={canGoBack}
              canGoForward={canGoForward}
            />
          </section>

          <section id="nearby" className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-hidden rounded-card bg-surface p-4 shadow-card">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-semibold">같은 시각 다른 카메라</h2>
              <span className="text-caption text-gray-600">
                모든 카메라가 같은 시각에 잘리므로 동기 재생 · 누르면 메인과 교체
              </span>
            </div>
            {nearby.loading && !nearby.data && (
              <div className="flex justify-center py-8 text-gray-600">
                <Spinner />
              </div>
            )}
            {nearby.data && nearby.data.length === 0 && (
              <p className="py-8 text-center text-caption text-gray-600">이 매장에는 다른 카메라가 없습니다.</p>
            )}
            <div className="grid grid-cols-4 gap-2.5">
              {nearby.data?.map((camera) => (
                <NearbyTile
                  key={camera.cameraId}
                  camera={camera}
                  mainVideo={mainVideo}
                  mainOffsetSec={source.offsetSec}
                  onSwap={() => {
                    setMainCameraId(camera.cameraId)
                    setSelectedStart(null)
                    setWindowShift(0)
                  }}
                />
              ))}
            </div>
          </section>
        </div>

        <section className="flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card">
          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm font-semibold">상태</span>
            <Segmented
              fill
              value={event.state}
              onChange={(state) => void decide(state)}
              options={[
                { value: 'unconfirmed', label: '미확인' },
                { value: 'confirmed', label: '확인' },
                { value: 'false_positive', label: '오탐' },
              ]}
            />
            {savingState && <span className="text-[12px] text-gray-600">저장 중…</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-body-sm font-semibold">메모</span>
            <MemoBox eventId={event.id} initial={event.memo} />
          </div>

          <div className="my-1 h-px bg-gray-200" />

          <Button variant="primary" className="rounded-small p-3" disabled title="아직 준비 중인 기능입니다">
            증거 묶음 내보내기
          </Button>
          <p className="-mt-1.5 text-caption leading-normal text-gray-600">
            선택 범위 영상(카메라별) + 시각·매장 정보 PDF 1장 → 경찰 제출용 폴더. 준비 중인
            기능이라 지금은 아래 클립 저장과 112 안내문을 써 주세요.
          </p>
          <Button variant="secondary" onClick={() => void saveClip()}>
            클립만 저장
          </Button>
          <Button variant="danger-outline" onClick={() => void copyReport()}>
            112 신고 안내문 복사
          </Button>
          {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        </section>
      </div>
    </div>
  )
}
