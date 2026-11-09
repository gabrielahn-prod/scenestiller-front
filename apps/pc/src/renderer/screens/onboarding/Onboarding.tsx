/**
 * 2a 첫 실행 — 로그인 · 매장 연결.
 * 값: design/씬스틸러 PC 앱.dc.html 의 2a 인라인 스타일.
 *
 * 디자인과 다르게 한 것:
 *  - QR 페어링 줄을 뺐다. 요구사항 1.5 가 이번 백엔드 범위 밖이라(docs/api-contract.md
 *    3.4) 찍어도 아무 일이 안 일어나는 QR 을 보여주는 게 더 해롭다.
 *  - 다른 PC 가 연결된 매장을 고르면 경고를 한 줄 더 띄운다. 요구사항 1.4 가 '교체
 *    확인'을 요구하고, 교체하면 그 PC 의 감시가 멈춘다.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import type { StoreDto } from '../../../shared/server-types'
import { AGENT_VERSION } from '../../../shared/types'
import { useSession } from '../../app/session'
import { Logo } from '../../components/TopNav'
import { Button, Input, Notice, Spinner } from '../../components/ui'
import { api } from '../../lib/api'
import { cn } from '../../lib/cn'
import { createStore, listStores, registerDevice, ServerError } from '../../lib/server-api'

/** 010-1234-5678 모양으로 맞춘다. 숫자만 남기고 11자리까지. */
const formatPhone = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`
}

const Panel = ({
  inactive,
  children,
}: {
  inactive?: boolean
  children: ReactNode
}) => (
  <section
    aria-disabled={inactive}
    className={cn(
      'flex flex-col gap-5 rounded-card bg-surface p-10 shadow-card transition-opacity',
      // 아직 차례가 아닌 칸. 2b 위저드가 비활성 패널에 쓰는 opacity .55 를 그대로 쓴다.
      inactive && 'pointer-events-none opacity-[.55]',
    )}
  >
    {children}
  </section>
)

const PanelTitle = ({ title, sub }: { title: string; sub: string }) => (
  <div>
    <h2 className="text-h2">{title}</h2>
    <p className="mt-1.5 text-body-sm font-normal text-gray-600">{sub}</p>
  </div>
)

/* -------------------------------------------------------------- 로그인 칸 */

const LoginPanel = ({ onSignedIn }: { onSignedIn: () => void }) => {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [error, setError] = useState<{ field: 'phone' | 'code'; message: string } | null>(null)
  const { setSession } = useSession()

  const sendCode = async () => {
    setSending(true)
    setError(null)
    const result = await api.authSendOtp(phone)
    setSending(false)
    if (!result.ok) return setError({ field: 'phone', message: result.message })
    setSent(true)
  }

  const verify = async () => {
    setVerifying(true)
    setError(null)
    const result = await api.authVerifyOtp(phone, code)
    setVerifying(false)
    if (!result.ok) return setError({ field: 'code', message: result.message })
    setSession(result.value)
    onSignedIn()
  }

  const phoneReady = phone.replace(/\D/g, '').length === 11

  return (
    <Panel>
      <PanelTitle
        title="사장님 계정으로 로그인"
        sub="모바일 앱과 같은 계정을 쓰면 푸시 알림이 자동으로 연결됩니다."
      />
      <Input
        label="휴대폰 번호"
        inputMode="numeric"
        autoFocus
        placeholder="010-1234-5678"
        value={phone}
        onChange={(event) => setPhone(formatPhone(event.target.value))}
        error={error?.field === 'phone' ? error.message : null}
      />
      <Input
        label="인증번호"
        inputMode="numeric"
        maxLength={6}
        placeholder="6자리"
        value={code}
        disabled={!sent}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && code.length === 6) void verify()
        }}
        error={error?.field === 'code' ? error.message : null}
        hint={sent ? '인증번호를 보냈습니다. 문자를 확인해 주세요.' : undefined}
        adornment={
          <button
            type="button"
            onClick={() => void sendCode()}
            disabled={!phoneReady || sending}
            className="whitespace-nowrap text-body-sm font-semibold text-brand-sub disabled:text-gray-500"
          >
            {sending ? <Spinner className="size-4" /> : sent ? '다시 받기' : '인증번호 받기'}
          </button>
        }
      />
      <Button
        variant="primary"
        className="mt-2"
        loading={verifying}
        disabled={!sent || code.length !== 6}
        onClick={() => void verify()}
      >
        로그인
      </Button>
      <p className="text-center text-caption text-gray-600">
        개발자용 서버 주소·토큰 입력은{' '}
        <Link to="/settings/advanced" className="underline hover:text-brand-sub">
          설정 ▸ 고급
        </Link>
        에 있습니다
      </p>
    </Panel>
  )
}

/* ---------------------------------------------------------------- 매장 칸 */

const storeMeta = (store: StoreDto, thisDeviceId: string): { text: string; replaces: boolean } => {
  const other = store.device && store.device.deviceId !== thisDeviceId
  if (other) return { text: '다른 PC가 연결돼 있음 — 선택하면 교체', replaces: true }
  const pc = store.device ? '이 PC가 연결됨' : '연결된 PC 없음'
  return { text: `카메라 ${store.cameraCount}대 등록 · ${pc}`, replaces: false }
}

const StorePanel = ({ active }: { active: boolean }) => {
  const navigate = useNavigate()
  const { config, updateConfig, refreshStore } = useSession()
  const [stores, setStores] = useState<readonly StoreDto[] | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(config.storeId || null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) return
    void (async () => {
      try {
        const loaded = await listStores()
        setStores(loaded)
        // 매장이 하나뿐이면 고를 게 없다.
        setSelectedId((current) => current ?? (loaded.length === 1 ? (loaded[0]?.id ?? null) : null))
      } catch (loadError) {
        setError(loadError instanceof ServerError ? loadError.message : '매장 목록을 불러오지 못했습니다.')
      }
    })()
  }, [active])

  const selected = stores?.find((store) => store.id === selectedId) ?? null
  const replacing = selected ? storeMeta(selected, config.deviceId).replaces : false

  const addStore = async () => {
    if (!newName.trim()) return
    setBusy(true)
    setError(null)
    try {
      const store = await createStore({ name: newName.trim() })
      setStores((current) => [...(current ?? []), store])
      setSelectedId(store.id)
      setCreating(false)
      setNewName('')
    } catch (createError) {
      setError(createError instanceof ServerError ? createError.message : '매장을 만들지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const connect = async () => {
    if (!selected) return
    setBusy(true)
    setError(null)
    try {
      const registration = await registerDevice(selected.id, {
        deviceId: config.deviceId,
        label: `${selected.name} PC`,
        agentVersion: AGENT_VERSION,
        replaceExisting: replacing,
      })
      // 기기 토큰은 여기서 한 번만 온다. 조각 업로드·하트비트가 이걸로 돈다.
      await updateConfig({ storeId: selected.id, deviceToken: registration.deviceToken })
      await refreshStore()
      navigate(config.cameras.length > 0 ? '/live' : '/cameras/add', { replace: true })
    } catch (connectError) {
      setError(connectError instanceof ServerError ? connectError.message : '이 PC를 매장에 연결하지 못했습니다.')
      setBusy(false)
    }
  }

  return (
    <Panel inactive={!active}>
      <PanelTitle title="이 PC가 있는 매장" sub="PC 한 대는 매장 하나를 감시합니다." />

      <div className="flex flex-col gap-2.5">
        {active && stores === null && !error && (
          <div className="flex justify-center py-6 text-gray-600">
            <Spinner />
          </div>
        )}
        {stores?.map((store) => {
          const meta = storeMeta(store, config.deviceId)
          const isSelected = store.id === selectedId
          return (
            <button
              key={store.id}
              type="button"
              onClick={() => setSelectedId(store.id)}
              className={cn(
                'flex items-center justify-between rounded-card px-[18px] py-4 text-left transition',
                isSelected
                  ? 'bg-blue-100 shadow-[inset_0_0_0_1.5px_var(--sub)]'
                  : 'bg-surface shadow-[inset_0_0_0_1px_var(--gray-300)] hover:bg-gray-50',
              )}
            >
              <div>
                <div className="text-body font-semibold">{store.name}</div>
                <div
                  className={cn(
                    'mt-0.5 text-caption',
                    meta.replaces ? 'text-risk-medium-text' : 'text-gray-600',
                  )}
                >
                  {meta.text}
                </div>
              </div>
              {isSelected && (
                <span className="inline-flex size-[22px] items-center justify-center rounded-full bg-brand-sub text-caption text-white">
                  ✓
                </span>
              )}
            </button>
          )
        })}

        {creating ? (
          <div className="flex items-end gap-2">
            <Input
              className="flex-1"
              label="새 매장 이름"
              placeholder="예: 강남 1호점"
              autoFocus
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void addStore()
              }}
            />
            <Button variant="action" className="h-input" loading={busy} onClick={() => void addStore()}>
              만들기
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className={cn(
              'rounded-card border-[1.5px] border-dashed border-gray-500 px-[18px] py-4',
              'text-center text-[15px] font-medium text-gray-600',
              'hover:border-brand-sub hover:text-brand-sub',
            )}
          >
            + 새 매장 만들기
          </button>
        )}
      </div>

      {replacing && selected?.device && (
        <Notice tone="warn">
          {selected.device.label ?? '다른 PC'}의 연결이 끊기고, 앞으로 이 PC가 {selected.name}을 감시합니다.
        </Notice>
      )}
      {error && <Notice tone="bad">{error}</Notice>}

      <Button
        variant="action"
        className="mt-auto self-end px-6 py-3 text-body"
        disabled={!selected}
        loading={busy && !creating}
        onClick={() => void connect()}
      >
        다음: 카메라 추가 →
      </Button>
    </Panel>
  )
}

/* ------------------------------------------------------------------ 화면 */

export const Onboarding = () => {
  const { session } = useSession()
  const [params] = useSearchParams()
  const [signedIn, setSignedIn] = useState(session.signedIn)

  useEffect(() => setSignedIn(session.signedIn), [session.signedIn])

  return (
    <div className="flex h-full flex-col bg-page">
      <header className="flex h-nav shrink-0 items-center justify-between border-b border-gray-200 bg-surface px-page py-5">
        <Logo />
        <span className="text-body-sm font-normal text-gray-600">매장 PC 수집기 v{AGENT_VERSION.split('.').slice(0, 2).join('.')}</span>
      </header>
      <div
        className="flex min-h-0 flex-1 items-center justify-center overflow-auto py-10"
        style={{
          // 2a 배경 그대로. 팔레트 토큰으로는 이 그라디언트를 표현할 수 없어 값을 옮긴다.
          background: 'linear-gradient(180deg,#F7F8F9 0%,rgba(156,201,249,.28) 55%,#F7F8F9 100%)',
        }}
      >
        <div className="grid grid-cols-[460px_460px] gap-6">
          {signedIn ? (
            <Panel inactive>
              <PanelTitle
                title="사장님 계정으로 로그인"
                sub="모바일 앱과 같은 계정을 쓰면 푸시 알림이 자동으로 연결됩니다."
              />
              <Notice tone="info">
                {params.get('step') === 'store'
                  ? '로그인되어 있습니다.'
                  : '로그인되었습니다. 오른쪽에서 매장을 골라 주세요.'}
              </Notice>
            </Panel>
          ) : (
            <LoginPanel onSignedIn={() => setSignedIn(true)} />
          )}
          <StorePanel active={signedIn} />
        </div>
      </div>
    </div>
  )
}
