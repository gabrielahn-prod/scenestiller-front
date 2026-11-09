/**
 * 위험 클립 재생기 — 2d 팝업의 영상 칸 그대로 (2e 미리보기·2f 상세도 같이 쓴다).
 *
 * 클립은 위험 구간 앞뒤로 5초씩 붙여 잘려 있다 (ai-worker/pipeline/report.py 의
 * HIGHLIGHT_PAD_SEC). 그래서 진행 막대의 빨간 구간은 5초 지점에서 시작한다.
 */
import { useEffect, useRef, useState } from 'react'
import { cn } from '../lib/cn'
import { formatClockSeconds } from '../lib/time'
import { VideoSurface } from './ui'

/** ai-worker 의 HIGHLIGHT_PAD_SEC 와 같아야 한다. */
export const CLIP_PAD_SEC = 5

const SPEEDS = [0.5, 1, 2] as const

interface ClipPlayerProps {
  readonly clipUrl: string | null
  readonly thumbnailUrl?: string | null
  /** 위험 구간의 절대 시작 시각. 재생 위치를 실제 시각으로 보여준다. */
  readonly startedAt: string
  readonly durationSec: number | null
  readonly badge?: string
  readonly autoPlay?: boolean
  readonly className?: string
}

export const ClipPlayer = ({
  clipUrl,
  thumbnailUrl,
  startedAt,
  durationSec,
  badge,
  autoPlay = true,
  className,
}: ClipPlayerProps) => {
  const video = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(autoPlay)
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [position, setPosition] = useState(0)
  const [length, setLength] = useState(0)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
    setPosition(0)
  }, [clipUrl])

  useEffect(() => {
    if (video.current) video.current.playbackRate = speed
  }, [speed])

  const toggle = () => {
    const element = video.current
    if (!element) return
    if (element.paused) void element.play()
    else element.pause()
  }

  const risk = durationSec ?? 0
  const total = length || CLIP_PAD_SEC * 2 + risk
  const riskLeft = Math.min(100, (CLIP_PAD_SEC / total) * 100)
  const riskWidth = Math.min(100 - riskLeft, (risk / total) * 100)
  const clock = formatClockSeconds(new Date(Date.parse(startedAt) + (position - CLIP_PAD_SEC) * 1000).toISOString())
  const hasVideo = Boolean(clipUrl) && !failed

  return (
    <VideoSurface className={cn('rounded-card', className)}>
      {hasVideo ? (
        <video
          ref={video}
          src={clipUrl ?? undefined}
          poster={thumbnailUrl ?? undefined}
          autoPlay={autoPlay}
          // 2d — 반복 재생. 사장님이 무슨 일인지 볼 때까지 계속 돈다.
          loop
          muted
          playsInline
          className="absolute inset-0 size-full object-contain"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onLoadedMetadata={(event) => setLength(event.currentTarget.duration)}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onError={() => setFailed(true)}
        />
      ) : thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="absolute inset-0 size-full object-cover opacity-80" />
      ) : null}

      {!hasVideo && (
        <span className="relative rounded-[6px] bg-[rgb(0_0_0/.55)] px-3 py-1.5 text-white">
          {clipUrl ? '클립을 불러오지 못했습니다' : '클립 영상이 없습니다'}
        </span>
      )}

      {badge && (
        <span className="absolute left-3 top-3 rounded-[6px] bg-risk-high px-2.5 py-1 text-[12px] font-semibold text-white">
          {badge}
        </span>
      )}

      {hasVideo && (
        <div className="absolute inset-x-3 bottom-3 flex h-10 items-center gap-3 rounded-small bg-[rgb(0_0_0/.55)] px-3.5 text-caption text-white">
          <button type="button" onClick={toggle} aria-label={playing ? '일시정지' : '재생'} className="w-4">
            {playing ? '❚❚' : '▶'}
          </button>
          <span className="tabular-nums">{clock}</span>
          <button
            type="button"
            aria-label="재생 위치"
            className="relative h-1 flex-1 rounded-[2px] bg-[rgb(255_255_255/.3)]"
            onClick={(event) => {
              const element = video.current
              if (!element || !total) return
              const rect = event.currentTarget.getBoundingClientRect()
              element.currentTime = ((event.clientX - rect.left) / rect.width) * total
            }}
          >
            {/* 재생한 만큼. 디자인에 없는 표시라 같은 흰색 계열로 옅게 둔다. */}
            <span
              className="absolute inset-y-0 left-0 rounded-[2px] bg-[rgb(255_255_255/.55)]"
              style={{ width: `${Math.min(100, (position / total) * 100)}%` }}
            />
            <span
              className="absolute inset-y-0 rounded-[2px] bg-risk-high"
              style={{ left: `${riskLeft}%`, width: `${riskWidth}%` }}
            />
          </button>
          <span className="flex gap-1">
            {SPEEDS.map((value, index) => (
              <span key={value} className="flex gap-1">
                {index > 0 && <span>·</span>}
                <button
                  type="button"
                  onClick={() => setSpeed(value)}
                  className={cn(value === speed && 'font-bold')}
                >
                  {value}×
                </button>
              </span>
            ))}
          </span>
          <button
            type="button"
            aria-label="전체 화면"
            onClick={() => void video.current?.requestFullscreen()}
          >
            ⛶
          </button>
        </div>
      )}
    </VideoSurface>
  )
}
