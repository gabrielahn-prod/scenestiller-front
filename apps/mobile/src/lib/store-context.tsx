import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Store } from '@scene-stealer/api'
import { useApi } from './api'
import { config } from './config'
import { useSession } from './session'

interface StoreContextValue {
  readonly stores: readonly Store[]
  readonly selected: Store | null
  readonly loading: boolean
  select(storeId: string): void
  /** silent — 당겨서 새로고침 표시(loading)를 켜지 않는다. 배경에서 도는 새로고침용. */
  refresh(options?: { silent?: boolean }): Promise<void>
}

const StoreContext = createContext<StoreContextValue | null>(null)

/** 매장은 앱 전체가 공유한다 — 홈 상단 칩에서 바꾸면 기록·설정도 따라간다. */
export const StoreProvider = ({ children }: { children: ReactNode }) => {
  const api = useApi()
  const { session } = useSession()
  const [stores, setStores] = useState<readonly Store[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!session) return
    if (!options.silent) setLoading(true)
    try {
      const next = await api.listStores()
      // 바뀐 게 없으면 예전 객체를 그대로 둔다. 새 객체를 넣으면 selected 를 보는 화면들이 괜히 다시 읽는다.
      setStores((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next))
      // 실서버 시연은 노트북의 PC 화면과 같은 매장을 봐야 한다.
      const preferred = config.live && next.some((store) => store.id === config.liveStoreId) ? config.liveStoreId : null
      setSelectedId((current) => current ?? preferred ?? next[0]?.id ?? null)
    } catch {
      // 조용한 새로고침이 실패하면 지금 값을 둔다. 첫 불러오기 실패는 화면이 빈 상태로 알린다.
    } finally {
      if (!options.silent) setLoading(false)
    }
  }, [api, session])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // 실서버 시연 — 매장 칩의 빨간 점(PC 꺼짐) · 설정의 매장 줄이 지금 상태를 따라가게 다시 읽는다. 홈이 목록을 다시 읽는 간격(10초)과 같다.
  useEffect(() => {
    if (!config.live || !session) return
    const timer = setInterval(() => void refresh({ silent: true }), 10_000)
    return () => clearInterval(timer)
  }, [refresh, session])

  const value = useMemo<StoreContextValue>(
    () => ({
      stores,
      selected: stores.find((s) => s.id === selectedId) ?? null,
      loading,
      select: setSelectedId,
      refresh,
    }),
    [stores, selectedId, loading, refresh],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStores = (): StoreContextValue => {
  const value = useContext(StoreContext)
  if (!value) throw new Error('StoreProvider 안에서만 쓸 수 있습니다')
  return value
}
