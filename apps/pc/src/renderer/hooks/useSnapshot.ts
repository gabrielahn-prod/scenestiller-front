import { useEffect, useState } from 'react'
import { api } from '../lib/api'

export interface SnapshotState {
  readonly dataUrl: string | null
  readonly error: string | null
  readonly loading: boolean
}

/**
 * RTSP 미리보기.
 *
 * 브라우저와 Electron 렌더러는 RTSP 를 재생할 수 없다. 그래서 영상 스트리밍이 아니라
 * 정지 화면을 주기적으로 갈아끼운다. "이 카메라가 계산대가 맞는가"를 확인하는
 * 용도로는 충분하고, 훨씬 싸다.
 */
export const useSnapshot = (rtspUri: string | null, intervalMs = 2000): SnapshotState => {
  const [state, setState] = useState<SnapshotState>({ dataUrl: null, error: null, loading: false })

  useEffect(() => {
    if (!rtspUri) {
      setState({ dataUrl: null, error: null, loading: false })
      return
    }

    const control = { cancelled: false, inFlight: false }
    setState((previous) => ({ ...previous, loading: true }))

    const capture = async (): Promise<void> => {
      if (control.inFlight || control.cancelled) return
      control.inFlight = true
      const result = await api.snapshot(rtspUri)
      control.inFlight = false
      if (control.cancelled) return
      setState(
        result.ok
          ? { dataUrl: result.dataUrl, error: null, loading: false }
          : { dataUrl: null, error: result.message, loading: false },
      )
    }

    void capture()
    const timer = setInterval(() => void capture(), intervalMs)
    return () => {
      control.cancelled = true
      clearInterval(timer)
    }
  }, [rtspUri, intervalMs])

  return state
}
