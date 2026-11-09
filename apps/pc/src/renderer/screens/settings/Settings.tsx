/**
 * 2g 설정.
 * 값: design/씬스틸러 PC 앱.dc.html 의 2g 인라인 스타일.
 *
 * 디자인에 그려진 건 '알림' 칸뿐이다. 나머지 칸(운영 시간·모바일 연결·카메라 관리·
 * 저장 공간·매장 정보)은 같은 카드·줄 모양(2g 알림 방식 카드)으로 만들었다.
 *
 * 저장 버튼이 없다 — 토글·세그먼트를 만지면 바로 저장한다 (2g '변경은 즉시 저장됩니다').
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { LocationTag, NotificationSettings, RiskLevel } from '../../../shared/server-types'
import { useConnectedStore, useSession } from '../../app/session'
import { Button, Input, Notice, Spinner, Toggle } from '../../components/ui'
import { POPUP_ALERTS_KEY, usePreference } from '../../hooks/usePreference'
import { useResource } from '../../hooks/useResource'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { formatBytes } from '../../lib/format'
import { LOCATION_LABEL, LOCATION_ORDER } from '../../lib/labels'
import {
  deleteCamera,
  getNotificationSettings,
  listCameras,
  putNotificationSettings,
  sendTestNotification,
  ServerError,
  updateCamera,
  updateStore,
} from '../../lib/server-api'

type Section = 'alerts' | 'hours' | 'mobile' | 'cameras' | 'storage' | 'store'

const messageOf = (error: unknown, fallback: string): string =>
  error instanceof ServerError ? error.message : fallback

/* ------------------------------------------------------------------ 공통 모양 */

const Card = ({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) => (
  // shrink-0: 스크롤되는 세로 flex 안에서 카드가 줄어들면 overflow-hidden 에 마지막 줄이 잘린다.
  <section className="shrink-0 overflow-hidden rounded-card bg-surface shadow-card">
    <div className="flex items-center justify-between px-6 pb-2 pt-4">
      <h2 className="text-h3">{title}</h2>
      {aside && <span className="text-caption text-gray-600">{aside}</span>}
    </div>
    {children}
  </section>
)

/** 2g '알림 방식' 카드의 한 줄. */
const Line = ({
  label,
  hint,
  last,
  children,
}: {
  label: string
  hint?: string
  last?: boolean
  children: ReactNode
}) => (
  <div
    className={cn(
      'flex items-center justify-between gap-4 px-6 py-2.5 text-[15px]',
      !last && 'border-b border-gray-200',
    )}
  >
    <span>
      <span className="font-semibold">{label}</span>
      {hint && <span className="ml-1 text-caption text-gray-600">{hint}</span>}
    </span>
    <span className="flex items-center gap-3 text-body-sm font-normal text-gray-600">{children}</span>
  </div>
)

/** 2g 표 안의 작은 세그먼트 (padding 3, 칸 5px 10px 13px). */
const MiniSegmented = <T extends string>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (next: T) => void
  disabled?: boolean
}) => (
  <div className={cn('inline-flex gap-0.5 rounded-small bg-gray-100 p-[3px]', disabled && 'opacity-50')}>
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        disabled={disabled}
        onClick={() => onChange(option.value)}
        className={cn(
          'flex-1 whitespace-nowrap rounded-[6px] px-2.5 py-[5px] text-center text-caption',
          option.value === value ? 'bg-surface font-semibold shadow-segment' : 'text-gray-600 hover:text-gray-900',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/** 00:00 ~ 23:59. 한 자리 시(9:00)도 받아 두 자리로 맞춘다. */
const normalizeClock = (raw: string): string | null => {
  const match = /^(\d{1,2}):?(\d{2})$/.exec(raw.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

/**
 * 시각 입력. 네이티브 <input type="time"> 은 로케일에 따라 '오전 01:00' 으로 그려진다 —
 * 2g 디자인은 '01:00 – 07:00' 처럼 24시간 글자로 두어서, 평소엔 글자처럼 보이고
 * 누르면 고칠 수 있는 칸으로 만든다.
 */
const TimeInput = ({
  value,
  onCommit,
  label,
}: {
  value: string | null
  onCommit: (next: string) => void
  label: string
}) => {
  const [invalid, setInvalid] = useState(false)
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={label}
      aria-invalid={invalid}
      placeholder="00:00"
      defaultValue={value?.slice(0, 5) ?? ''}
      key={value ?? ''}
      maxLength={5}
      onBlur={(event) => {
        const next = normalizeClock(event.target.value)
        setInvalid(next === null && event.target.value !== '')
        if (next === null) return
        event.target.value = next
        if (next !== value?.slice(0, 5)) onCommit(next)
      }}
      className={cn(
        // 칸 폭을 글자 폭에 맞춘다 (field-sizing: content). 못 하는 브라우저는 예전처럼 고정 폭.
        'w-14 rounded-small bg-transparent px-1 py-0.5 text-right text-body-sm font-normal text-gray-600 outline-none',
        '[field-sizing:content] supports-[field-sizing:content]:w-auto',
        'tabular-nums hover:bg-gray-100 focus:bg-surface focus:text-gray-900',
        'focus:shadow-[inset_0_0_0_1px_var(--blue-600)]',
        invalid && 'text-error-main shadow-[inset_0_0_0_1px_var(--error-500)]',
      )}
    />
  )
}

const MIN_RISK_OPTIONS: readonly { value: RiskLevel; label: string }[] = [
  { value: 'low', label: '낮음 이상' },
  { value: 'medium', label: '보통 이상' },
  { value: 'high', label: '높음만' },
]

/* ------------------------------------------------------------------ 알림 */

const AlertsSection = ({ storeId }: { storeId: string }) => {
  const store = useConnectedStore()
  const settings = useResource(() => getNotificationSettings(storeId), [storeId])
  const [popups, setPopups] = usePreference(POPUP_ALERTS_KEY, true)
  const [error, setError] = useState<string | null>(null)
  const [testState, setTestState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const save = async (next: NotificationSettings) => {
    const previous = settings.data
    settings.mutate(() => next)
    setError(null)
    try {
      await putNotificationSettings(storeId, next)
    } catch (saveError) {
      // 서버가 거절하면 화면을 원래대로 되돌린다 — 저장 안 된 값을 켜진 것처럼 두지 않는다.
      if (previous) settings.mutate(() => previous)
      setError(messageOf(saveError, '알림 설정을 저장하지 못했습니다.'))
    }
  }

  const setQuiet = (patch: Partial<NotificationSettings['quietHours']>) => {
    if (!settings.data) return
    void save({ ...settings.data, quietHours: { ...settings.data.quietHours, ...patch } })
  }

  const sendTest = async () => {
    setTestState('sending')
    setError(null)
    try {
      await sendTestNotification(storeId)
      setTestState('sent')
    } catch (testError) {
      setError(messageOf(testError, '테스트 알림을 보내지 못했습니다.'))
      setTestState('idle')
    }
  }

  if (!settings.data) {
    return (
      <div className="flex justify-center py-16 text-gray-600">
        {settings.error ? <Notice tone="bad">{settings.error}</Notice> : <Spinner />}
      </div>
    )
  }

  const data = settings.data
  const quiet = data.quietHours
  const businessHours = store.opensAt && store.closesAt ? `${store.opensAt.slice(0, 5)} – ${store.closesAt.slice(0, 5)}` : null

  return (
    <>
      {error && <Notice tone="bad">{error}</Notice>}
      {/*
        디자인은 위험 종류 7개를 줄마다 켜고 끄는 표다. 위험 종류 분류를 하지 않기로 해서
        '이 위험도 이상만 알림' 한 줄로 바꿨다 (위험도는 AI 이상 점수로 정한다).
      */}
      <Card title="어떤 위험을 알려드릴까요" aside="변경은 즉시 저장됩니다">
        <Line label="알림 받을 위험도" hint="고른 위험도 이상만 알립니다" last>
          <MiniSegmented
            value={data.minRisk}
            options={MIN_RISK_OPTIONS}
            onChange={(minRisk) => void save({ ...data, minRisk })}
          />
        </Line>
      </Card>

      <Card title="알림 방식">
        <Line label="PC 팝업 + 소리">
          <Toggle checked={popups} onChange={setPopups} label="PC 팝업 + 소리" />
        </Line>
        {/* 이 PC 는 어떤 휴대폰이 연결됐는지 알 수 없다 (푸시 기기 조회 API 가 없다). */}
        <Line label="모바일 푸시">모바일 앱에서 같은 번호로 로그인하면 연결됩니다</Line>
        <Line label="영업 시간엔 알림 줄이기" hint="사장님이 매장에 있을 때">
          <span>'높음'만{businessHours ? ` · ${businessHours}` : ' · 운영 시간을 먼저 정해 주세요'}</span>
          <Toggle
            checked={quiet.businessHoursHighOnly}
            onChange={(next) => setQuiet({ businessHoursHighOnly: next })}
            label="영업 시간엔 알림 줄이기"
          />
        </Line>
        <Line label="수면 시간" hint="높음만 소리로">
          {/* 2g 의 '01:00 – 07:00' 한 덩어리처럼 붙여 둔다. Line 의 칸 간격(12px)을 쓰면 벌어져 보인다. */}
          <span className="flex items-center gap-0.5">
            <TimeInput label="수면 시작" value={quiet.sleepStart} onCommit={(sleepStart) => setQuiet({ sleepStart })} />
            <span>–</span>
            <TimeInput label="수면 끝" value={quiet.sleepEnd} onCommit={(sleepEnd) => setQuiet({ sleepEnd })} />
          </span>
        </Line>
        <Line label="테스트 알림 보내기" last>
          {testState === 'sent' && <span>보냈습니다</span>}
          <Button
            variant="secondary"
            className="px-4 py-2 text-body-sm"
            loading={testState === 'sending'}
            onClick={() => void sendTest()}
          >
            지금 보내기
          </Button>
        </Line>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------ 매장 운영 시간 */

const HoursSection = () => {
  const store = useConnectedStore()
  const { refreshStore } = useSession()
  const [error, setError] = useState<string | null>(null)

  const save = async (patch: { opensAt?: string; closesAt?: string }) => {
    setError(null)
    try {
      await updateStore(store.id, patch)
      await refreshStore()
    } catch (saveError) {
      setError(messageOf(saveError, '운영 시간을 저장하지 못했습니다.'))
    }
  }

  return (
    <>
      {error && <Notice tone="bad">{error}</Notice>}
      <Card title="매장 운영 시간" aside="변경은 즉시 저장됩니다">
        <Line label="여는 시간">
          <TimeInput label="여는 시간" value={store.opensAt?.slice(0, 5) ?? null} onCommit={(opensAt) => void save({ opensAt })} />
        </Line>
        <Line label="닫는 시간" hint="자정을 넘겨도 됩니다" last>
          <TimeInput label="닫는 시간" value={store.closesAt?.slice(0, 5) ?? null} onCommit={(closesAt) => void save({ closesAt })} />
        </Line>
      </Card>
      <p className="px-1 text-caption text-gray-600">
        '영업 시간엔 알림 줄이기'가 이 시간을 씁니다 — 사장님이 매장에 있는 동안에는 '높음'만 알립니다.
      </p>
    </>
  )
}

/* ------------------------------------------------------------ 모바일 앱 연결 */

const MobileSection = () => (
  <Card title="모바일 앱 연결">
    <div className="flex flex-col gap-3 px-6 pb-5 pt-2 text-body-sm font-normal leading-normal text-gray-700">
      {/* 2a 로그인 카드의 문구를 그대로 쓴다. QR 페어링(요구사항 1.5)은 아직 없다. */}
      <p>모바일 앱과 같은 계정을 쓰면 푸시 알림이 자동으로 연결됩니다.</p>
      <p className="text-gray-600">
        모바일 앱에서 이 PC에 로그인한 휴대폰 번호로 로그인하세요. 알림 설정은 PC와 모바일이 같은 값을 씁니다.
      </p>
    </div>
  </Card>
)

/* --------------------------------------------------------------- 카메라 관리 */

const CamerasSection = () => {
  const store = useConnectedStore()
  const { config, updateConfig } = useSession()
  const cameras = useResource(() => listCameras(store.id), [store.id])
  const [error, setError] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const rename = async (cameraId: string, name: string) => {
    setError(null)
    try {
      const updated = await updateCamera(cameraId, { name })
      cameras.mutate((list) => list.map((camera) => (camera.id === cameraId ? updated : camera)))
      // PC 쪽 이름도 맞춘다 — 조각 meta 의 camera.name 이 이걸 쓴다.
      await updateConfig({
        cameras: config.cameras.map((camera) => (camera.id === updated.agentCameraId ? { ...camera, name } : camera)),
      })
    } catch (renameError) {
      setError(messageOf(renameError, '이름을 바꾸지 못했습니다.'))
    }
  }

  const retag = async (cameraId: string, locationTag: LocationTag) => {
    setError(null)
    try {
      const updated = await updateCamera(cameraId, { locationTag })
      cameras.mutate((list) => list.map((camera) => (camera.id === cameraId ? updated : camera)))
    } catch (tagError) {
      setError(messageOf(tagError, '위치 태그를 바꾸지 못했습니다.'))
    }
  }

  const remove = async (cameraId: string, agentCameraId: string) => {
    setError(null)
    try {
      await deleteCamera(cameraId)
      cameras.mutate((list) => list.filter((camera) => camera.id !== cameraId))
      // 이 PC 의 감시 목록에서도 빼고 다시 건다. 지난 이벤트 기록은 서버에 남는다(soft delete).
      const next = config.cameras.filter((camera) => camera.id !== agentCameraId)
      if (next.length === 0) await api.stop()
      else await api.start(next)
      await updateConfig({ cameras: next })
    } catch (removeError) {
      setError(messageOf(removeError, '카메라를 삭제하지 못했습니다.'))
    } finally {
      setConfirmingId(null)
    }
  }

  const list = cameras.data ?? []

  return (
    <>
      {error && <Notice tone="bad">{error}</Notice>}
      <Card
        title={`카메라 관리 (${list.length}/8)`}
        aside={
          <Link to="/cameras/add" className="font-semibold text-brand-sub">
            + 카메라 추가
          </Link>
        }
      >
        {!cameras.data && (
          <div className="flex justify-center py-8 text-gray-600">
            <Spinner />
          </div>
        )}
        {list.map((camera, index) => (
          <div
            key={camera.id}
            className={cn(
              'grid grid-cols-[1fr_160px_auto] items-center gap-3 px-6 py-2.5',
              index < list.length - 1 && 'border-b border-gray-200',
            )}
          >
            <Input
              aria-label={`${camera.name} 이름`}
              defaultValue={camera.name}
              key={camera.name}
              onBlur={(event) => {
                const name = event.target.value.trim()
                if (name && name !== camera.name) void rename(camera.id, name)
              }}
            />
            <select
              aria-label={`${camera.name} 위치 태그`}
              value={camera.locationTag ?? ''}
              onChange={(event) => void retag(camera.id, event.target.value as LocationTag)}
              className={cn(
                'h-input rounded-card bg-surface px-3 text-[15px] outline-none',
                'shadow-[inset_0_0_0_1px_var(--gray-500)] focus:shadow-[inset_0_0_0_1px_var(--blue-600)]',
              )}
            >
              <option value="" disabled>
                위치 태그
              </option>
              {LOCATION_ORDER.map((tag) => (
                <option key={tag} value={tag}>
                  {LOCATION_LABEL[tag]}
                </option>
              ))}
            </select>
            {confirmingId === camera.id ? (
              <span className="flex gap-2">
                <Button variant="secondary" onClick={() => setConfirmingId(null)}>
                  취소
                </Button>
                <Button variant="danger" onClick={() => void remove(camera.id, camera.agentCameraId)}>
                  삭제
                </Button>
              </span>
            ) : (
              <Button variant="danger-outline" onClick={() => setConfirmingId(camera.id)}>
                삭제
              </Button>
            )}
          </div>
        ))}
        {cameras.data && list.length === 0 && (
          <p className="px-6 pb-5 text-body-sm font-normal text-gray-600">등록된 카메라가 없습니다.</p>
        )}
      </Card>
      <p className="px-1 text-caption text-gray-600">
        삭제해도 지난 위험 기록은 남습니다. 이 PC의 감시 목록에서만 빠집니다.
      </p>
    </>
  )
}

/* ------------------------------------------------------------ 저장 공간 · 인터넷 */

const StorageSection = () => {
  const { config, status, updateConfig } = useSession()
  const spool = status.cameras.reduce((sum, camera) => sum + camera.spoolBytes, 0)
  const pending = status.cameras.reduce((sum, camera) => sum + camera.pendingCount, 0)
  const evicted = status.cameras.some((camera) => camera.spoolEvicted)

  return (
    <>
      {evicted && (
        <Notice tone="warn">
          인터넷이 오래 끊겨 보관 공간이 찼습니다. 가장 오래된 영상부터 지웠습니다.
        </Notice>
      )}
      <Card title="저장 공간 · 인터넷">
        <Line label="이 PC에 보관 중" hint="인터넷이 끊기면 여기 쌓였다가 다시 올라갑니다">
          {formatBytes(spool)} / {formatBytes(config.spoolLimitBytes)} · 대기 {pending}조각
        </Line>
        <Line label="오늘 서버로 보낸 양">{formatBytes(status.bytesUploadedToday)}</Line>
        <Line label="PC 재부팅 시 자동 시작">
          <Toggle
            checked={config.autoStart}
            onChange={(autoStart) => void updateConfig({ autoStart })}
            label="PC 재부팅 시 자동 시작"
          />
        </Line>
        <Line label="보관 폴더" last>
          <Button variant="secondary" className="px-4 py-2 text-body-sm" onClick={() => void api.openSpoolFolder()}>
            폴더 열기
          </Button>
        </Line>
      </Card>
    </>
  )
}

/* ---------------------------------------------------------------- 매장 정보 */

const StoreSection = () => {
  const store = useConnectedStore()
  const { refreshStore } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = async (patch: { name?: string; address?: string }) => {
    setError(null)
    setSaved(false)
    try {
      await updateStore(store.id, patch)
      await refreshStore()
      setSaved(true)
    } catch (saveError) {
      setError(messageOf(saveError, '매장 정보를 저장하지 못했습니다.'))
    }
  }

  return (
    <>
      {error && <Notice tone="bad">{error}</Notice>}
      <Card title="매장 정보" aside={saved ? '저장했습니다' : '변경은 즉시 저장됩니다'}>
        <div className="flex flex-col gap-4 px-6 pb-5 pt-2">
          <Input
            label="매장 이름"
            defaultValue={store.name}
            key={`name-${store.name}`}
            onBlur={(event) => {
              const name = event.target.value.trim()
              if (name && name !== store.name) void save({ name })
            }}
          />
          <Input
            label="주소"
            placeholder="예: 서울 강남구 테헤란로 123 1층"
            defaultValue={store.address ?? ''}
            key={`address-${store.address ?? ''}`}
            hint="112 신고 안내문에 들어갑니다. 경찰이 찾아올 수 있게 층·호수까지 적어 주세요."
            onBlur={(event) => {
              const address = event.target.value.trim()
              if (address !== (store.address ?? '')) void save({ address })
            }}
          />
        </div>
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ 화면 */

const NAV: readonly { id: Section; label: (cameraCount: number) => string }[] = [
  { id: 'alerts', label: () => '알림' },
  { id: 'hours', label: () => '매장 운영 시간' },
  { id: 'mobile', label: () => '모바일 앱 연결' },
  { id: 'cameras', label: (count) => `카메라 관리 (${count}/8)` },
  { id: 'storage', label: () => '저장 공간 · 인터넷' },
  { id: 'store', label: () => '매장 정보 (주소 — 신고용)' },
]

export const Settings = () => {
  const store = useConnectedStore()
  const { config } = useSession()
  const [params, setParams] = useSearchParams()
  const section = (NAV.find((item) => item.id === params.get('section'))?.id ?? 'alerts') as Section

  // 주소가 비어 있으면 112 안내문이 쓸모없다. 매장 정보로 처음 들어온 사람에게 알린다.
  const [nudge, setNudge] = useState(false)
  useEffect(() => setNudge(!store.address), [store.address])

  return (
    <div className="grid h-full min-h-[760px] grid-cols-[260px_1fr] gap-6 px-page pb-8 pt-7">
      <nav className="flex flex-col gap-1 text-body font-semibold">
        <h1 className="mb-3.5 text-h1">설정</h1>
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setParams({ section: item.id })}
            className={cn(
              'flex items-center justify-between rounded-card px-4 py-3 text-left transition',
              item.id === section ? 'bg-blue-100 text-brand-sub' : 'text-gray-700 hover:bg-gray-100',
            )}
          >
            {item.label(config.cameras.length)}
            {item.id === 'store' && nudge && <span className="size-2 rounded-full bg-risk-high" aria-label="주소 없음" />}
          </button>
        ))}
        <Link
          to="/settings/advanced"
          className="mt-auto rounded-card px-4 py-3 text-body-sm text-gray-600 hover:bg-gray-100"
        >
          고급 (서버 주소 · 토큰 · 기기 ID)
        </Link>
      </nav>

      <div className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        {section === 'alerts' && <AlertsSection storeId={store.id} />}
        {section === 'hours' && <HoursSection />}
        {section === 'mobile' && <MobileSection />}
        {section === 'cameras' && <CamerasSection />}
        {section === 'storage' && <StorageSection />}
        {section === 'store' && <StoreSection />}
      </div>
    </div>
  )
}
