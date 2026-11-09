/**
 * 매장 실시간 채널 (요구사항 4.2 — 계약 6절).
 *
 * 새 위험 이벤트 → 2d 팝업 + 2c 피드 + 내비 배지
 * 상태 변경     → 모든 화면 동기 (PC 에서 바꾸든 모바일에서 바꾸든)
 * 카메라 상태   → 타일 갱신
 *
 * SSE 는 재생을 보장하지 않는다. 끊겼다 다시 붙으면 resyncToken 이 바뀌고,
 * 화면들은 그걸 보고 목록을 다시 읽는다.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { StreamConnectionState } from '../../shared/ipc'
import type { EventListItem, ServerStreamMessage } from '../../shared/server-types'
import { api } from '../lib/api'
import { playAlarm } from '../lib/alarm'
import { POPUP_ALERTS_KEY, usePreference } from '../hooks/usePreference'
import { getUnconfirmedCount } from '../lib/server-api'
import { useSession } from './session'

type Listener = (message: ServerStreamMessage) => void

interface StreamValue {
  readonly connection: StreamConnectionState
  readonly unconfirmedCount: number
  /** 지금 떠 있어야 하는 2d 팝업. 여러 건이 오면 하나씩 보여준다. */
  readonly alert: EventListItem | null
  readonly dismissAlert: () => void
  /** 끊겼다 다시 붙을 때마다 바뀐다. 목록 화면은 이걸 의존성에 넣어 다시 읽는다. */
  readonly resyncToken: number
  readonly subscribe: (listener: Listener) => () => void
}

const StreamContext = createContext<StreamValue | null>(null)

export const useStream = (): StreamValue => {
  const value = useContext(StreamContext)
  if (!value) throw new Error('StreamProvider 밖에서 useStream 을 불렀습니다')
  return value
}

/** 특정 메시지만 골라 듣는다. 핸들러가 바뀌어도 구독을 다시 걸지 않는다. */
export const useStreamMessages = (handler: Listener): void => {
  const { subscribe } = useStream()
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  useEffect(() => subscribe((message) => handlerRef.current(message)), [subscribe])
}

/**
 * 팝업으로 띄울 이벤트인가.
 *
 * AI 가 위험 신호로 잡은 것은 위험도와 상관없이 띄운다 (디자인 2d — '위험이 생기면 팝업이 덮는다').
 * 높음만 띄우던 때는 서버가 낮음·보통으로 판정하는 동안 화면에서 아무 일도 일어나지 않아,
 * 사람이 앞에 있어도 감시가 도는지 알 수 없었다. 창이 뜨는 게 성가시면 설정의
 * 'PC 팝업 + 소리'를 끈다 — 그때는 피드와 배지만 조용히 갱신된다.
 */
const shouldPopUp = (event: EventListItem): boolean => event.state === 'unconfirmed'

export const StreamProvider = ({ children }: { children: ReactNode }) => {
  const { store } = useSession()
  const storeId = store?.id ?? null

  const [connection, setConnection] = useState<StreamConnectionState>('idle')
  const [unconfirmedCount, setUnconfirmedCount] = useState(store?.unconfirmedCount ?? 0)
  const [alerts, setAlerts] = useState<readonly EventListItem[]>([])
  const [resyncToken, setResyncToken] = useState(0)
  const listeners = useRef(new Set<Listener>())
  const wasDisconnected = useRef(false)
  // 2g 'PC 팝업 + 소리'. 끄면 피드와 배지만 갱신된다.
  const [popupsEnabled] = usePreference(POPUP_ALERTS_KEY, true)
  const popupsRef = useRef(popupsEnabled)
  useEffect(() => {
    popupsRef.current = popupsEnabled
  }, [popupsEnabled])

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener)
    return () => {
      listeners.current.delete(listener)
    }
  }, [])

  const recountUnconfirmed = useCallback(async () => {
    if (!storeId) return
    try {
      setUnconfirmedCount(await getUnconfirmedCount(storeId))
    } catch {
      // 다음 이벤트나 재연결 때 다시 센다.
    }
  }, [storeId])

  useEffect(() => {
    setUnconfirmedCount(store?.unconfirmedCount ?? 0)
  }, [store?.unconfirmedCount])

  useEffect(() => {
    if (!storeId) return
    const offState = api.onServerStreamState((next) => {
      setConnection(next)
      if (next === 'reconnecting' || next === 'unauthorized') wasDisconnected.current = true
      if (next === 'open' && wasDisconnected.current) {
        // 끊긴 동안의 이벤트는 SSE 로 다시 오지 않는다. 화면들에게 다시 읽으라고 알린다.
        wasDisconnected.current = false
        setResyncToken((token) => token + 1)
        void recountUnconfirmed()
      }
    })
    const offMessage = api.onServerStream((message) => {
      listeners.current.forEach((listener) => listener(message))

      if (message.type === 'event.created') {
        void recountUnconfirmed()
        if (popupsRef.current && shouldPopUp(message.data)) {
          setAlerts((queue) => [...queue, message.data])
          void playAlarm()
        }
      }
      if (message.type === 'event.updated') {
        void recountUnconfirmed()
        // 모바일에서 먼저 확인했으면 PC 팝업도 내린다 — 양쪽 동기 (요구사항 4.6).
        if (message.data.state !== 'unconfirmed') {
          setAlerts((queue) => queue.filter((queued) => queued.id !== message.data.id))
        }
      }
    })
    void api.serverStreamStart(storeId)

    return () => {
      offState()
      offMessage()
      void api.serverStreamStop()
    }
  }, [storeId, recountUnconfirmed])

  const alert = alerts[0] ?? null

  // 팝업이 떠 있는 동안만 창을 최상위로 붙잡는다.
  useEffect(() => {
    void api.attention(alert !== null)
  }, [alert])

  const dismissAlert = useCallback(() => {
    setAlerts((queue) => queue.slice(1))
  }, [])

  const value = useMemo<StreamValue>(
    () => ({ connection, unconfirmedCount, alert, dismissAlert, resyncToken, subscribe }),
    [connection, unconfirmedCount, alert, dismissAlert, resyncToken, subscribe],
  )

  return <StreamContext.Provider value={value}>{children}</StreamContext.Provider>
}
