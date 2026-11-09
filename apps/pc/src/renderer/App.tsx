/**
 * 앱 셸 + 라우팅.
 *
 * 예전 흐름(서버 설정 → 카메라 선택 → 대시보드)을 디자인의 2a → 2b → 2c 로 바꿨다.
 * 서버 주소·토큰 입력은 사장님이 볼 일이 없어서 설정 ▸ 고급(/settings/advanced)으로
 * 옮겼고, 로그인 전에도 들어갈 수 있다 — 서버 주소가 없으면 로그인 자체를 못 한다.
 *
 * 2d 위험 팝업은 라우트가 아니다. 어느 화면 위에서든 뜬다.
 */
import type { ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { SessionProvider, useSession } from './app/session'
import { StreamProvider, useStream } from './app/stream'
import { Spinner } from './components/ui'
import { TopNav } from './components/TopNav'
import { cn } from './lib/cn'
import { AddCamera } from './screens/cameras/AddCamera'
import { ComponentGallery } from './screens/dev/ComponentGallery'
import { EventDetailScreen } from './screens/events/EventDetail'
import { EventList } from './screens/events/EventList'
import { Live } from './screens/live/Live'
import { Onboarding } from './screens/onboarding/Onboarding'
import { RiskAlertModal } from './screens/alert/RiskAlertModal'
import { Advanced } from './screens/settings/Advanced'
import { Settings } from './screens/settings/Settings'

const FullScreenSpinner = () => (
  <div className="flex h-full items-center justify-center bg-page text-gray-600">
    <Spinner />
  </div>
)

/** 010-1234-5678 → 010-****-5678. 로그인이 휴대폰 번호뿐이라 이름이 없다. */
const maskPhone = (phone: string): string => {
  const local = phone.replace(/^\+82/, '0').replace(/\D/g, '')
  return local.length === 11 ? `${local.slice(0, 3)}-****-${local.slice(7)}` : phone
}

const ConnectionBanner = () => {
  const { connection } = useStream()
  if (connection !== 'reconnecting' && connection !== 'unauthorized') return null
  return (
    <div
      role="alert"
      className={cn(
        'flex shrink-0 items-center gap-2 px-page py-2.5 text-body-sm font-semibold',
        'bg-error-50 text-error-main',
      )}
    >
      <span className="size-2 animate-pulse rounded-full bg-risk-high" />
      {connection === 'unauthorized'
        ? '서버 연결 끊김 — 로그인이 만료되었습니다. 다시 로그인해 주세요.'
        : '서버 연결 끊김 — 다시 연결하는 중입니다. 그동안의 위험 신호는 연결되면 불러옵니다.'}
    </div>
  )
}

const Shell = () => {
  const { store, session, signOut } = useSession()
  const { unconfirmedCount, alert } = useStream()

  return (
    <div className="flex h-full flex-col bg-page">
      <TopNav
        storeName={store?.name ?? null}
        unconfirmedCount={unconfirmedCount}
        userLabel={session.signedIn ? maskPhone(session.phone) : null}
        onSignOut={() => void signOut()}
      />
      <ConnectionBanner />
      <main className="min-h-0 flex-1 overflow-auto">
        <Outlet />
      </main>
      {alert && <RiskAlertModal event={alert} />}
    </div>
  )
}

/** 로그인 + 매장 연결이 끝나야 들어갈 수 있는 화면들. */
const RequireStore = ({ children }: { children: ReactNode }) => {
  const { session, store, storeResolved } = useSession()
  const location = useLocation()

  if (!session.signedIn) return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />
  if (!storeResolved) return <FullScreenSpinner />
  if (!store) return <Navigate to="/onboarding?step=store" replace />
  return <StreamProvider>{children}</StreamProvider>
}

export const App = () => (
  <SessionProvider fallback={<FullScreenSpinner />}>
    <Routes>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/settings/advanced" element={<Advanced />} />
      <Route path="/dev/components" element={<ComponentGallery />} />
      <Route
        element={
          <RequireStore>
            <Shell />
          </RequireStore>
        }
      >
        <Route path="/live" element={<Live />} />
        <Route path="/events" element={<EventList />} />
        <Route path="/events/:eventId" element={<EventDetailScreen />} />
        <Route path="/cameras/add" element={<AddCamera />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/live" replace />} />
    </Routes>
  </SessionProvider>
)
