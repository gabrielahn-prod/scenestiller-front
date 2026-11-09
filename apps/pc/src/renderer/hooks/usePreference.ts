import { useCallback, useEffect, useState } from 'react'

/**
 * 이 PC 에만 해당하는 화면 설정 (예: 2g 'PC 팝업 + 소리'). 서버에 올릴 값이 아니다 —
 * 모바일 알림 설정과 별개로, 이 계산대 PC 가 팝업을 띄울지의 문제다.
 *
 * 저장소를 못 쓰는 환경이면 기본값으로 동작한다.
 */
const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

const EVENT = 'scene-stealer:preference'

export const usePreference = <T>(key: string, fallback: T): readonly [T, (next: T) => void] => {
  const [value, setValue] = useState<T>(() => read(key, fallback))

  // 같은 창의 다른 컴포넌트(설정 화면 ↔ 스트림)가 바로 따라오게 한다.
  useEffect(() => {
    const onChange = (event: Event) => {
      if ((event as CustomEvent<string>).detail === key) setValue(read(key, fallback))
    }
    window.addEventListener(EVENT, onChange)
    return () => window.removeEventListener(EVENT, onChange)
  }, [key, fallback])

  const update = useCallback(
    (next: T) => {
      setValue(next)
      try {
        localStorage.setItem(key, JSON.stringify(next))
      } catch {
        // 저장을 못 해도 이번 실행 동안은 유지된다.
      }
      window.dispatchEvent(new CustomEvent(EVENT, { detail: key }))
    },
    [key],
  )

  return [value, update] as const
}

export const POPUP_ALERTS_KEY = 'scene-stealer:popup-alerts'
