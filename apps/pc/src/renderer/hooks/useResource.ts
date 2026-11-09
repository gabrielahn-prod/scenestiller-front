import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { ServerError } from '../lib/server-api'

export interface Resource<T> {
  readonly data: T | null
  readonly error: string | null
  readonly loading: boolean
  /** 다시 불러온다. 이미 데이터가 있으면 화면을 비우지 않고 뒤에서 갱신한다. */
  readonly reload: () => Promise<void>
  /** SSE 로 받은 변경을 서버 왕복 없이 반영할 때. */
  readonly mutate: (updater: (previous: T) => T) => void
}

const toMessage = (error: unknown): string =>
  error instanceof ServerError || error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.'

/**
 * 서버에서 읽어 오는 값 하나.
 *
 * 늦게 도착한 옛 응답이 새 응답을 덮어쓰지 않게 요청마다 번호를 매긴다 —
 * 날짜를 빠르게 넘기면(2e ◂ ▸) 응답 순서가 뒤바뀌어 엉뚱한 날의 기록이 뜬다.
 */
export const useResource = <T>(load: () => Promise<T>, deps: DependencyList): Resource<T> => {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  })
  const latest = useRef(0)
  const loadRef = useRef(load)

  // 렌더 중에 ref 를 쓰지 않는다 (동시 렌더링에서 버려질 렌더가 값을 바꾼다).
  // 아래 불러오기 effect 보다 먼저 선언돼 있어서 항상 최신 load 를 본다.
  useEffect(() => {
    loadRef.current = load
  })

  const reload = useCallback(async () => {
    latest.current += 1
    const request = latest.current
    setState((previous) => ({ ...previous, loading: true, error: null }))
    try {
      const data = await loadRef.current()
      if (request === latest.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (request === latest.current) {
        setState((previous) => ({ ...previous, error: toMessage(error), loading: false }))
      }
    }
  }, [])

  useEffect(() => {
    void reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  const mutate = useCallback((updater: (previous: T) => T) => {
    setState((previous) => (previous.data === null ? previous : { ...previous, data: updater(previous.data) }))
  }, [])

  return { ...state, reload, mutate }
}
