import { describe, expect, it } from 'vitest'
import { createSseParser, type SseEvent } from '../../src/main/lib/sse-parser'

const collect = () => {
  const events: SseEvent[] = []
  const push = createSseParser((event) => events.push(event))
  return { events, push }
}

describe('createSseParser', () => {
  it('빈 줄에서 이벤트 하나를 내보낸다', () => {
    const { events, push } = collect()
    push('event: event.created\ndata: {"id":"e1"}\n\n')
    expect(events).toEqual([{ event: 'event.created', data: '{"id":"e1"}' }])
  })

  it('빈 줄이 오기 전에는 내보내지 않는다', () => {
    const { events, push } = collect()
    push('event: ping\ndata: {}\n')
    expect(events).toEqual([])
  })

  it('줄 중간에서 잘린 청크를 이어 붙인다', () => {
    // 네트워크는 청크를 아무 데서나 자른다. 줄 단위로 온다고 가정하면
    // 이벤트 이름이 'eve' 로 잘리거나 JSON 이 반쪽만 온다.
    const { events, push } = collect()
    push('eve')
    push('nt: camera.state\nda')
    push('ta: {"state":"conn')
    push('ected"}\n')
    push('\n')
    expect(events).toEqual([{ event: 'camera.state', data: '{"state":"connected"}' }])
  })

  it('한 청크에 여러 이벤트가 오면 전부 내보낸다', () => {
    const { events, push } = collect()
    push('event: ping\ndata: {}\n\nevent: ready\ndata: {"storeId":"s1"}\n\n')
    expect(events.map((e) => e.event)).toEqual(['ping', 'ready'])
  })

  it('data 줄이 여러 개면 개행으로 잇는다', () => {
    const { events, push } = collect()
    push('data: 첫째\ndata: 둘째\n\n')
    expect(events).toEqual([{ event: 'message', data: '첫째\n둘째' }])
  })

  it('event 필드가 없으면 message 로 본다', () => {
    const { events, push } = collect()
    push('data: hello\n\n')
    expect(events[0]?.event).toBe('message')
  })

  it('콜론으로 시작하는 주석 줄은 무시한다', () => {
    const { events, push } = collect()
    push(': keep-alive\n\n')
    push(': 주석\nevent: ping\ndata: {}\n\n')
    expect(events).toEqual([{ event: 'ping', data: '{}' }])
  })

  it('CRLF 줄바꿈도 받는다', () => {
    const { events, push } = collect()
    push('event: ping\r\ndata: {}\r\n\r\n')
    expect(events).toEqual([{ event: 'ping', data: '{}' }])
  })

  it('CRLF 가 청크 경계에서 \\r 과 \\n 으로 갈라져도 빈 줄을 하나로 센다', () => {
    const { events, push } = collect()
    push('event: ping\r\ndata: {}\r')
    push('\n\r\n')
    expect(events).toEqual([{ event: 'ping', data: '{}' }])
  })

  it('콜론 뒤 공백은 딱 하나만 뗀다', () => {
    const { events, push } = collect()
    push('data:  두칸\n\n')
    expect(events[0]?.data).toBe(' 두칸')
  })

  it('data 가 없는 이벤트는 내보내지 않는다', () => {
    // 스펙상 data 버퍼가 비어 있으면 디스패치하지 않는다.
    const { events, push } = collect()
    push('event: orphan\n\n')
    expect(events).toEqual([])
  })

  it('한 이벤트를 내보낸 뒤 event 이름을 초기화한다', () => {
    const { events, push } = collect()
    push('event: event.created\ndata: 1\n\ndata: 2\n\n')
    expect(events).toEqual([
      { event: 'event.created', data: '1' },
      { event: 'message', data: '2' },
    ])
  })

  it('한글이 섞여도 그대로 넘긴다', () => {
    const { events, push } = collect()
    push('event: event.created\ndata: {"cameraName":"계산대 앞 · 진열대 A"}\n\n')
    expect(JSON.parse(events[0]?.data ?? '{}').cameraName).toBe('계산대 앞 · 진열대 A')
  })
})
