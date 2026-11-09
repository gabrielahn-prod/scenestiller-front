export interface SseEvent {
  readonly event: string
  readonly data: string
}

const LINE_BREAK = /\r\n|\n|\r/

/**
 * Server-Sent Events 스트림 파서.
 *
 * 브라우저의 EventSource 를 쓰지 않는 이유: Authorization 헤더를 붙일 수 없다.
 * 백엔드의 SSE 는 사용자 JWT 로 매장 권한을 확인하므로(docs/api-contract.md 6절)
 * fetch 로 스트림을 열고 본문을 여기서 직접 잘라야 한다.
 *
 * 네트워크는 청크를 아무 데서나 자른다 — 줄 중간, JSON 중간, 심지어 CRLF 의
 * \r 과 \n 사이도. 그래서 줄 끝을 확신할 수 없는 꼬리는 다음 청크까지 들고 있는다.
 * UTF-8 경계는 호출자가 TextDecoder({ stream: true }) 로 먼저 맞춰서 넘긴다.
 */
export const createSseParser = (onEvent: (event: SseEvent) => void): ((chunk: string) => void) => {
  const state = { buffer: '', event: '', data: [] as readonly string[] }

  const dispatch = (): void => {
    // 스펙: data 버퍼가 비어 있으면 디스패치하지 않는다.
    if (state.data.length > 0) {
      onEvent({ event: state.event || 'message', data: state.data.join('\n') })
    }
    state.event = ''
    state.data = []
  }

  const handleLine = (line: string): void => {
    if (line === '') return dispatch()
    if (line.startsWith(':')) return // 주석 (keep-alive 용도로 흔히 쓴다)

    const colon = line.indexOf(':')
    const field = colon === -1 ? line : line.slice(0, colon)
    const raw = colon === -1 ? '' : line.slice(colon + 1)
    // 콜론 뒤 공백은 딱 하나만 뗀다.
    const value = raw.startsWith(' ') ? raw.slice(1) : raw

    if (field === 'event') state.event = value
    else if (field === 'data') state.data = [...state.data, value]
    // id·retry 는 쓰지 않는다 — 재연결 후 놓친 구간은 목록 조회로 복구한다 (계약 6절).
  }

  return (chunk) => {
    state.buffer += chunk
    for (;;) {
      const match = LINE_BREAK.exec(state.buffer)
      if (!match) return
      // 버퍼 끝의 \r 은 다음 청크의 \n 과 짝일 수 있다. 확정될 때까지 기다린다.
      const endsWithLoneCr = match[0] === '\r' && match.index === state.buffer.length - 1
      if (endsWithLoneCr) return

      const line = state.buffer.slice(0, match.index)
      state.buffer = state.buffer.slice(match.index + match[0].length)
      handleLine(line)
    }
  }
}
