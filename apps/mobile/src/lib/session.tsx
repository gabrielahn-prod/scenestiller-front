import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'
import { createMockAuth, createSupabaseAuth, signInWithPassword, type AuthBackend } from './auth'
import { config, liveMissing, usingMockAuth } from './config'
import type { Session } from './session-types'

// 실서버 시연의 세션은 따로 둔다 — 가짜 데모가 남긴 세션('demo' 토큰)을 진짜 서버에 들고 가면 안 된다.
const KEY = config.live ? 'scene-stealer.live-session' : 'scene-stealer.session'

/** 만료 직전 토큰으로 요청하면 서버에 닿을 때는 이미 만료다. */
const REFRESH_SKEW_MS = 60_000

/** 데모 모드 전용 가짜 세션. 가짜 서버가 토큰을 보지 않으므로 값은 아무거나 된다. */
const DEMO_SESSION: Session = {
  accessToken: 'demo',
  refreshToken: null,
  expiresAt: null,
  userId: 'demo-owner',
  phone: '010-0000-0000',
}

/** 웹에는 SecureStore 가 없다. 개발용 미리보기라 localStorage 로 떨어뜨린다. */
const storage = {
  get: async (): Promise<string | null> =>
    Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) ?? null : SecureStore.getItemAsync(KEY),
  set: async (value: string): Promise<void> => {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, value)
    else await SecureStore.setItemAsync(KEY, value)
  },
  clear: async (): Promise<void> => {
    if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY)
    else await SecureStore.deleteItemAsync(KEY)
  },
}

const fresh = (session: Session | null): session is Session =>
  session !== null && (session.expiresAt === null || session.expiresAt - Date.now() > REFRESH_SKEW_MS)

const signInLive = (): Promise<Session> =>
  signInWithPassword(config.supabaseUrl, config.supabaseAnonKey, config.liveEmail, config.livePassword)

interface SessionContextValue {
  readonly session: Session | null
  readonly loading: boolean
  readonly auth: AuthBackend
  /** 실서버 시연에서 데모 계정 로그인이 실패한 이유. 그 외에는 null. */
  readonly liveError: string | null
  signIn(session: Session): Promise<void>
  signOut(): Promise<void>
  /**
   * 지금 쓸 수 있는 액세스 토큰. 실서버 시연에서는 만료가 가까우면 데모 계정으로 다시 로그인한다 —
   * 심사위원이 한 시간 뒤에 알림을 눌러도 화면이 401 로 비지 않게.
   */
  accessToken(): Promise<string | null>
  /**
   * 서버가 토큰을 거절했을 때(401) 데모 계정으로 다시 로그인한다 — 실서버 시연에서만 뜻이 있다.
   * 만료 시각만 보고는 알 수 없는 토큰이 있다 (다른 서버에서 받았거나 서버에서 지워진 세션).
   */
  renew(): Promise<string | null>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export const SessionProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [liveError, setLiveError] = useState<string | null>(null)
  const current = useRef<Session | null>(null)
  const renewing = useRef<Promise<Session | null> | null>(null)

  const auth = useMemo<AuthBackend>(
    () => (usingMockAuth ? createMockAuth() : createSupabaseAuth(config.supabaseUrl, config.supabaseAnonKey)),
    [],
  )

  const adopt = useCallback(async (next: Session | null) => {
    current.current = next
    setSession(next)
    if (next) await storage.set(JSON.stringify(next)).catch(() => undefined)
    else await storage.clear().catch(() => undefined)
  }, [])

  /** 데모 계정 로그인은 한 번에 하나만. 화면 여러 곳이 동시에 토큰을 달라고 해도 요청은 하나다. */
  const renewLive = useCallback((): Promise<Session | null> => {
    if (renewing.current) return renewing.current
    renewing.current = signInLive()
      .then(async (next) => {
        setLiveError(null)
        await adopt(next)
        return next
      })
      .catch((error: unknown) => {
        setLiveError(error instanceof Error ? error.message : '데모 계정으로 로그인하지 못했습니다')
        return null
      })
      .finally(() => {
        renewing.current = null
      })
    return renewing.current
  }, [adopt])

  useEffect(() => {
    void (async () => {
      const raw = await storage.get().catch(() => null)
      const stored = raw ? (JSON.parse(raw) as Session) : null

      if (config.live) {
        // 심사위원에게 로그인을 시키지 않는다 — 비밀 주소로 들어온 것 자체가 데모 계정 로그인이다.
        if (liveMissing.length > 0) {
          setLiveError(`실서버 설정이 이 배포에 없습니다: ${liveMissing.join(', ')}`)
        } else if (fresh(stored)) {
          await adopt(stored)
        } else {
          await renewLive()
        }
        setLoading(false)
        return
      }

      // 데모 페이지에서는 심사위원에게 로그인을 시키지 않는다. 볼 것은 로그인 화면이 아니다.
      const next = stored ?? (config.demo ? DEMO_SESSION : null)
      current.current = next
      setSession(next)
      setLoading(false)
    })()
  }, [adopt, renewLive])

  const signIn = useCallback(async (next: Session) => {
    await adopt(next)
  }, [adopt])

  const signOut = useCallback(async () => {
    await adopt(null)
  }, [adopt])

  const accessToken = useCallback(async (): Promise<string | null> => {
    const now = current.current
    if (!config.live || fresh(now)) return now?.accessToken ?? null
    return (await renewLive())?.accessToken ?? null
  }, [renewLive])

  const renew = useCallback(
    async (): Promise<string | null> => (config.live ? ((await renewLive())?.accessToken ?? null) : null),
    [renewLive],
  )

  const value = useMemo(
    () => ({ session, loading, auth, liveError, signIn, signOut, accessToken, renew }),
    [session, loading, auth, liveError, signIn, signOut, accessToken, renew],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export const useSession = (): SessionContextValue => {
  const value = useContext(SessionContext)
  if (!value) throw new Error('SessionProvider 안에서만 쓸 수 있습니다')
  return value
}
