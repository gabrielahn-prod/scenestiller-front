/**
 * 상단 내비게이션 — design/씬스틸러 PC 앱.dc.html 2c 의 .nav 그대로.
 * PC 앱은 사이드바 대신 이걸 쓴다 (디자인시스템 4장). 높이 76.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import iconUser from '../assets/icon-user-dark.svg'
// 로고 마크 — 남색 S 에 오른쪽 위 모서리 · 왼쪽 삼각형만 로고 노랑(#F9A403, 디자인시스템 1장).
import logoMark from '../assets/logo-mark-color.svg'
import { cn } from '../lib/cn'

interface TopNavProps {
  readonly storeName: string | null
  readonly unconfirmedCount: number
  readonly userLabel: string | null
  readonly onSignOut: () => void
}

const MENU: readonly { to: string; label: string; badge?: boolean }[] = [
  { to: '/live', label: '실시간' },
  { to: '/events', label: '위험 기록', badge: true },
  // 디자인에서 '카메라'가 켜진 화면은 2b(카메라 추가)뿐이다. 카메라 목록 관리는
  // 2g 설정의 '카메라 관리' 칸에 있다.
  { to: '/cameras/add', label: '카메라' },
  { to: '/settings', label: '설정' },
]

export const Logo = ({ className }: { className?: string }) => (
  <span className={cn('flex items-center gap-2.5', className)}>
    <img src={logoMark} alt="" className="h-[27px] w-[30px]" />
    <span className="font-logo text-[22px] font-bold leading-none text-brand-main">Scene Stealer</span>
  </span>
)

export const TopNav = ({ storeName, unconfirmedCount, userLabel, onSignOut }: TopNavProps) => {
  const navigate = useNavigate()
  const [storeMenuOpen, setStoreMenuOpen] = useState(false)
  const storeMenuRef = useRef<HTMLDivElement>(null)

  // 펼친 매장 메뉴는 바깥을 누르거나 Esc 로 닫힌다. 안 닫히면 아래 화면의 버튼('하나 크게' 등)을 가린 채 남는다.
  useEffect(() => {
    if (!storeMenuOpen) return
    const onPointerDown = (event: PointerEvent): void => {
      if (!storeMenuRef.current?.contains(event.target as Node)) setStoreMenuOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setStoreMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [storeMenuOpen])

  return (
    <header
      className={cn(
        'flex h-nav shrink-0 items-center justify-between px-page py-5',
        'border-b border-gray-200 bg-surface',
      )}
    >
      <div className="flex items-center gap-12">
        <Link to="/live" aria-label="실시간 화면으로 이동">
          <Logo />
        </Link>
        <nav className="flex gap-9 text-[18px] font-semibold text-gray-900">
          {MENU.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-1.5 transition-colors',
                  isActive ? 'text-brand-sub' : 'hover:text-brand-sub',
                )
              }
            >
              {item.label}
              {item.badge && unconfirmedCount > 0 && (
                <span className="rounded-chip bg-risk-high px-[7px] py-px text-[12px] text-white">
                  {unconfirmedCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-6">
        {storeName && (
          <div ref={storeMenuRef} className="relative">
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={storeMenuOpen}
              onClick={() => setStoreMenuOpen((open) => !open)}
              className={cn(
                'inline-flex items-center whitespace-nowrap rounded-chip px-[22px] py-2',
                'bg-blue-100 text-body font-semibold text-brand-sub',
                'hover:bg-blue-200',
              )}
            >
              {storeName} ▾
            </button>
            {storeMenuOpen && (
              // 디자인에 펼친 상태가 없다. 카드·모달 토큰(r12, modal 그림자)으로 만든다.
              <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded-card bg-surface p-2 shadow-modal">
                <p className="px-3 py-2 text-caption text-gray-600">PC 한 대는 매장 하나를 감시합니다.</p>
                <button
                  type="button"
                  onClick={() => {
                    setStoreMenuOpen(false)
                    navigate('/onboarding?step=store')
                  }}
                  className="w-full rounded-small px-3 py-2 text-left text-body-sm font-semibold hover:bg-gray-100"
                >
                  이 PC의 매장 바꾸기
                </button>
              </div>
            )}
          </div>
        )}
        {userLabel && (
          <span className="flex items-center gap-1.5 text-[18px] font-semibold">
            <img src={iconUser} alt="" className="h-[22px] w-[18px]" />
            {userLabel}
          </span>
        )}
        <button type="button" onClick={onSignOut} className="text-[18px] font-semibold hover:text-brand-sub">
          로그아웃
        </button>
      </div>
    </header>
  )
}
