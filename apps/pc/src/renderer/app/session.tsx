/**
 * 이 PC 의 세션 — 누가 로그인했고, 이 PC 가 어느 매장을 감시하는가.
 *
 * "PC 한 대는 매장 하나를 감시합니다" (2a). 그 매장은 기기 등록 때 정해져
 * AgentConfig.storeId 에 남는다. 화면들은 그 매장만 본다 — 여러 매장을 오가며
 * 보는 건 모바일 앱의 몫이다.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { SessionSummary } from '../../shared/ipc'
import type { StoreDto } from '../../shared/server-types'
import type { AgentConfig, AgentStatus } from '../../shared/types'
import { api } from '../lib/api'
import { listStores } from '../lib/server-api'

interface SessionValue {
  readonly session: SessionSummary
  readonly config: AgentConfig
  readonly status: AgentStatus
  /** 이 PC 가 감시하는 매장. 로그인 전이거나 아직 연결 전이면 null. */
  readonly store: StoreDto | null
  /**
   * 매장 조회가 끝났는지. 로그인 직후 조회가 끝나기 전에 store 가 null 이라고
   * 온보딩으로 튕겨내면 안 된다.
   */
  readonly storeResolved: boolean
  readonly updateConfig: (patch: Partial<AgentConfig>) => Promise<AgentConfig>
  readonly refreshStore: () => Promise<void>
  readonly setSession: (next: SessionSummary) => void
  readonly signOut: () => Promise<void>
}

const SessionContext = createContext<SessionValue | null>(null)

export const useSession = (): SessionValue => {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider 밖에서 useSession 을 불렀습니다')
  return value
}

/** 로그인했고 매장까지 연결된 상태에서만 쓰는 화면용. */
export const useConnectedStore = (): StoreDto => {
  const { store } = useSession()
  if (!store) throw new Error('매장이 연결되지 않은 상태에서 매장 화면을 그렸습니다')
  return store
}

interface Loaded {
  readonly session: SessionSummary
  readonly config: AgentConfig
  readonly status: AgentStatus
}

export const SessionProvider = ({
  children,
  fallback,
}: {
  children: ReactNode
  fallback: ReactNode
}) => {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [store, setStore] = useState<StoreDto | null>(null)
  const [storeResolved, setStoreResolved] = useState(false)

  useEffect(() => {
    void (async () => {
      const [session, config, status] = await Promise.all([
        api.authGetSession(),
        api.getConfig(),
        api.getStatus(),
      ])
      setLoaded({ session, config, status })
    })()
    return api.onStatus((status) => setLoaded((previous) => (previous ? { ...previous, status } : previous)))
  }, [])

  // loaded 통째로 의존하면 안 된다 — 에이전트 상태가 바뀔 때마다(수 초마다) 새 객체가
  // 돼서 GET /stores 를 계속 두드린다. 매장 조회에 실제로 영향을 주는 값만 본다.
  const isLoaded = loaded !== null
  const signedIn = loaded?.session.signedIn ?? false
  const storeId = loaded?.config.storeId ?? ''

  const refreshStore = useCallback(async () => {
    if (!isLoaded) return
    if (!signedIn || !storeId) {
      setStore(null)
      setStoreResolved(true)
      return
    }
    try {
      const stores = await listStores()
      setStore(stores.find((candidate) => candidate.id === storeId) ?? null)
    } catch {
      // 서버가 잠깐 안 닿는다. 이전 매장 정보를 그대로 둔다 — 화면을 비우면
      // 사장님은 매장 연결이 풀린 줄 안다. 연결 배너가 따로 알린다.
    } finally {
      setStoreResolved(true)
    }
  }, [isLoaded, signedIn, storeId])

  useEffect(() => {
    void refreshStore()
  }, [refreshStore])

  const updateConfig = useCallback(async (patch: Partial<AgentConfig>) => {
    const next = await api.setConfig(patch)
    setLoaded((previous) => (previous ? { ...previous, config: next } : previous))
    return next
  }, [])

  const setSession = useCallback((session: SessionSummary) => {
    setLoaded((previous) => (previous ? { ...previous, session } : previous))
  }, [])

  const signOut = useCallback(async () => {
    // 감시는 멈추지 않는다 — 조각 업로드는 기기 토큰으로 돈다. 화면만 닫힌다.
    await api.authSignOut()
    setStore(null)
    setLoaded((previous) => (previous ? { ...previous, session: { signedIn: false } } : previous))
  }, [])

  const value = useMemo<SessionValue | null>(
    () =>
      loaded
        ? { ...loaded, store, storeResolved, updateConfig, refreshStore, setSession, signOut }
        : null,
    [loaded, store, storeResolved, updateConfig, refreshStore, setSession, signOut],
  )

  if (!value) return <>{fallback}</>
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}
