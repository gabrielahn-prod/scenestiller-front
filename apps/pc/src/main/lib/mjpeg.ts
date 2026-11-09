/**
 * ffmpeg 가 stdout 으로 흘려보내는 MJPEG 바이트열을 JPEG 프레임 단위로 자른다.
 *
 * MJPEG 는 JPEG 를 그냥 이어붙인 형식이라 경계 표시가 따로 없다.
 * SOI(FFD8) 로 시작해 EOI(FFD9) 로 끝나는 구간을 직접 찾아야 하고,
 * 프레임이 TCP 덩어리 경계에 걸쳐 오는 것이 정상이므로 이어붙이며 처리한다.
 */

const SOI_0 = 0xff
const SOI_1 = 0xd8
const EOI_1 = 0xd9

const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024

export interface JpegSplitterOptions {
  /** EOI 가 끝내 오지 않는 깨진 스트림에서 메모리가 무한히 자라는 것을 막는다. */
  readonly maxBufferBytes?: number
}

export const createJpegSplitter = (
  onFrame: (frame: Buffer) => void,
  options: JpegSplitterOptions = {},
): ((chunk: Buffer) => void) => {
  const maxBufferBytes = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER
  const state = { buffer: Buffer.alloc(0) }

  return (chunk: Buffer): void => {
    state.buffer = Buffer.concat([state.buffer, chunk])

    for (;;) {
      const start = state.buffer.indexOf(Buffer.from([SOI_0, SOI_1]))
      if (start === -1) {
        // 아직 프레임 시작을 못 찾았다. 마지막 바이트만 남겨 경계에 걸친 FFD8 을 살린다.
        state.buffer = state.buffer.subarray(Math.max(0, state.buffer.length - 1))
        return
      }
      if (start > 0) state.buffer = state.buffer.subarray(start)

      const end = state.buffer.indexOf(Buffer.from([SOI_0, EOI_1]), 2)
      if (end === -1) {
        if (state.buffer.length > maxBufferBytes) state.buffer = Buffer.alloc(0)
        return
      }

      onFrame(state.buffer.subarray(0, end + 2))
      state.buffer = state.buffer.subarray(end + 2)
    }
  }
}
