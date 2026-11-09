/**
 * 2d 위험 감지 순간 — 최상위 팝업 (자동 재생 · 소리).
 * 값: design/씬스틸러 PC 앱.dc.html 의 2d 인라인 스타일.
 *
 * 라우트가 아니라 어느 화면 위에서든 뜬다 (App.tsx 의 Shell). 떠 있는 동안 메인
 * 프로세스가 창을 최상위로 붙잡는다 (app/stream.tsx → api.attention).
 *
 * 디자인과 다르게 한 것 (둘 다 '아직 사실이 아닌 문구'를 띄우지 않으려는 것):
 *  - 헤더의 '모바일 앱에도 푸시 전송됨 ✓' 을 뺐다. PC 는 푸시가 실제로 나갔는지
 *    알 수 없고(SSE 에 결과가 없다, FCM 키도 아직 없다), 틀린 ✓ 는 사장님이 모바일을
 *    믿고 PC 팝업을 넘기게 만든다.
 *  - '112 신고 안내문' 은 안내문을 클립보드에 복사한다. 클립 링크는 빠진다
 *    (lib/police-report.ts 첫 주석).
 *
 * 위험 종류 분류를 하지 않기로 해서, 제목의 '절도 의심' 자리는 '이상 행동' 이고
 * 'AI 설명' 칸과 인물 박스는 없다 — AI 는 평소와 다른 움직임 구간과 점수만 준다.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { EventListItem } from '../../../shared/server-types'
import { useConnectedStore } from '../../app/session'
import { useStream } from '../../app/stream'
import { ClipPlayer } from '../../components/ClipPlayer'
import { Button, Notice } from '../../components/ui'
import { useResource } from '../../hooks/useResource'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { EVENT_TITLE, RISK_LABEL } from '../../lib/labels'
import { buildPoliceReport } from '../../lib/police-report'
import { changeEventState, getClip, getEvent, getNearbyCameras, ServerError } from '../../lib/server-api'
import { formatClockSeconds, formatDuration, isToday, formatShortDateTime } from '../../lib/time'

const SEGMENT_LABEL: Record<number, string> = { 30: '30초', 60: '1분', 300: '5분' }

export const RiskAlertModal = ({ event }: { event: EventListItem }) => {
  const navigate = useNavigate()
  const store = useConnectedStore()
  const { dismissAlert } = useStream()
  const [busy, setBusy] = useState<'confirm' | 'false' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'info' | 'bad'; text: string } | null>(null)

  const detail = useResource(() => getEvent(event.id), [event.id])
  const nearby = useResource(() => getNearbyCameras(event.id), [event.id])

  // ✕ 와 같은 뜻 — 미확인으로 남긴다.
  useEffect(() => {
    const onKey = (keyboard: KeyboardEvent) => {
      if (keyboard.key === 'Escape') dismissAlert()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dismissAlert])

  const data = detail.data
  const when = isToday(event.startedAt)
    ? `오늘 ${formatClockSeconds(event.startedAt)}`
    : formatShortDateTime(event.startedAt)
  const segment = SEGMENT_LABEL[store.segmentSeconds] ?? `${store.segmentSeconds}초`
  const otherCamera = nearby.data?.[0]?.name ?? null

  const decide = async (state: 'confirmed' | 'false_positive') => {
    setBusy(state === 'confirmed' ? 'confirm' : 'false')
    try {
      await changeEventState(event.id, state)
      dismissAlert()
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof ServerError ? error.message : '저장하지 못했습니다.' })
      setBusy(null)
    }
  }

  const openDetail = (hash = '') => {
    dismissAlert()
    navigate(`/events/${event.id}${hash}`)
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
    setNotice({ tone: 'info', text: '112 신고 안내문을 복사했습니다. 전화 연결 후 그대로 읽어 주세요.' })
  }

  const saveClip = async () => {
    try {
      const clip = await getClip(event.id)
      await api.openExternal(clip.url)
    } catch (error) {
      setNotice({ tone: 'bad', text: error instanceof ServerError ? error.message : '클립을 열지 못했습니다.' })
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`위험 감지 — ${EVENT_TITLE}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgb(20_35_61/.45)] p-6"
    >
      <div
        className={cn(
          'flex max-h-full w-[1080px] max-w-full flex-col overflow-hidden rounded-panel bg-surface',
          // 2d — modal 그림자 + error/600 3px 테두리
          'shadow-[0_12px_40px_rgb(20_35_61/.16),0_0_0_3px_var(--error-600)]',
        )}
      >
        <header className="flex items-center gap-4 bg-risk-high px-6 py-4 text-white">
          <span className="text-[22px] font-semibold">⚠ 위험 감지 — {EVENT_TITLE}</span>
          <span className="text-[15px] opacity-90">
            {event.cameraName ?? '카메라'} · {when} · 위험도 {RISK_LABEL[event.risk]}
          </span>
          <button
            type="button"
            onClick={dismissAlert}
            aria-label="닫기 (미확인으로 남김)"
            className="ml-auto inline-flex size-8 items-center justify-center rounded-small bg-[rgb(255_255_255/.18)] text-body hover:bg-[rgb(255_255_255/.28)]"
          >
            ✕
          </button>
        </header>

        <div className="grid min-h-0 grid-cols-[1fr_320px] overflow-auto">
          <div className="flex flex-col gap-3.5 border-r border-gray-200 p-6">
            <ClipPlayer
              clipUrl={data?.clipUrl ?? null}
              thumbnailUrl={event.thumbnailUrl}
              startedAt={event.startedAt}
              durationSec={event.durationSec}
              badge="위험 구간 · 반복 재생"
            />
            <div className="flex items-center justify-between text-body-sm font-normal text-gray-600">
              <button type="button" className="hover:text-brand-sub" onClick={() => openDetail()}>
                ◂ 이전 {segment} 조각
              </button>
              <span className="text-gray-900">
                이 조각 안 위험 구간{' '}
                <b>
                  {formatClockSeconds(event.startedAt)} – {formatClockSeconds(event.endedAt)}
                </b>
                {event.durationSec !== null && ` (${formatDuration(event.durationSec)})`}
              </span>
              <button type="button" className="hover:text-brand-sub" onClick={() => openDetail()}>
                다음 {segment} 조각 ▸
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 p-6">
            <Button variant="danger" className="rounded-card p-3.5 text-[17px]" onClick={() => void copyReport()}>
              📞 112 신고 안내문
            </Button>
            <p className="-mt-1 text-center text-caption text-gray-600">
              주소·시각이 한 장으로 정리됩니다
            </p>
            <Button variant="secondary" onClick={() => void saveClip()}>
              클립 저장 · 공유
            </Button>
            <Button variant="secondary" onClick={() => openDetail()}>
              전후 영상 더 보기
            </Button>
            <Button variant="secondary" onClick={() => openDetail('#nearby')}>
              {otherCamera ? `같은 시각 다른 카메라 (${otherCamera})` : '같은 시각 다른 카메라'}
            </Button>
            <div className="my-1.5 h-px bg-gray-200" />
            <Button
              variant="secondary"
              className="text-gray-600"
              loading={busy === 'false'}
              disabled={busy !== null}
              onClick={() => void decide('false_positive')}
            >
              문제 없음 (오탐) — AI에 알려주기
            </Button>
            <Button
              variant="primary"
              className="rounded-small p-3"
              loading={busy === 'confirm'}
              disabled={busy !== null}
              onClick={() => void decide('confirmed')}
            >
              확인했어요
            </Button>
            {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
            {/*
              디자인의 '확인하지 않으면 5분 후 모바일에 1회 재알림' 은 뺐다. 재알림(요구사항
              6.5)은 백엔드 2순위라 아직 동작하지 않는다 — 없는 약속을 띄우면 사장님이
              팝업을 닫고 재알림을 기다린다. 붙으면 문구를 되살린다.
            */}
            <p className="mt-auto text-caption leading-normal text-gray-600">✕ 닫기 = 미확인 유지</p>
          </div>
        </div>
      </div>
    </div>
  )
}
