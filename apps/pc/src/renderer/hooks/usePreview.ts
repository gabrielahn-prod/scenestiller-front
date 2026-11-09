import { useEffect, useState } from 'react'
import type { PreviewQuality } from '../../shared/ipc'
import { api } from '../lib/api'

export interface PreviewState {
  readonly url: string | null
  readonly error: string | null
}

export interface PreviewHookOptions {
  /**
   * 동시에 여러 카메라를 띄울 때의 구분자 (2c 격자). 같은 키끼리만 서로를
   * 갈아끼운다 — 키 없이 두 곳에서 부르면 서로의 스트림을 끈다.
   */
  readonly key?: string
  readonly quality?: PreviewQuality
}

/**
 * 실시간 미리보기 스트림.
 *
 * 메인 프로세스가 ffmpeg 로 MJPEG 를 만들어 로컬 HTTP 로 내보내고, 여기서는
 * 그 URL 만 받아 <img src> 에 꽂는다. 브라우저가 multipart/x-mixed-replace 를
 * 그대로 재생하므로 렌더러에 디코딩 코드가 필요 없다.
 * 서버를 거치지 않는다 — PC 로컬 RTSP 다 (요구사항 3.4).
 */
export const usePreview = (rtspUri: string | null, options: PreviewHookOptions = {}): PreviewState => {
  const [state, setState] = useState<PreviewState>({ url: null, error: null })
  const { key, quality } = options

  useEffect(() => {
    if (!rtspUri) {
      setState({ url: null, error: null })
      return
    }

    const control = { cancelled: false }
    setState({ url: null, error: null })
    void api.previewStart(rtspUri, { key, quality }).then((result) => {
      if (control.cancelled) return
      setState(result.ok ? { url: result.url, error: null } : { url: null, error: result.message })
    })

    return () => {
      control.cancelled = true
      // 키 없는 호출은 기본 스트림 하나만 쓰던 예전 동작이다. 전부 끄면 격자까지 꺼진다.
      void api.previewStop(key ?? 'default')
    }
  }, [rtspUri, key, quality])

  return state
}
