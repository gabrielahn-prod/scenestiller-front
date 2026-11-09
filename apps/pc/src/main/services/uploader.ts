import { openAsBlob } from 'node:fs'
import type { SegmentMeta } from '../../shared/types'
import { classifyStatus, segmentsEndpoint, type UploadResult } from '../../shared/upload-policy'

// 브라우저 데모의 수집기도 같은 정책을 쓰므로 판정은 shared 에 있다.
export { classifyStatus, segmentsEndpoint }
export type { FatalCause, UploadResult } from '../../shared/upload-policy'

export interface UploadArgs {
  readonly baseUrl: string
  readonly token: string
  readonly meta: SegmentMeta
  readonly filePath: string
  readonly fetchImpl?: typeof fetch
}

export const uploadSegment = async (args: UploadArgs): Promise<UploadResult> => {
  // openAsBlob 은 잘못된 경로에 대해 동기적으로 던지기도 하므로 try/catch 로 감싼다.
  const video = await (async () => {
    try {
      return await openAsBlob(args.filePath, { type: 'video/mp4' })
    } catch {
      return null
    }
  })()
  if (!video) {
    return { kind: 'fatal', reason: `조각 파일이 없습니다: ${args.filePath}`, cause: 'missing-file' }
  }

  const form = new FormData()
  form.append('meta', new Blob([JSON.stringify(args.meta)], { type: 'application/json' }))
  form.append('video', video, `${args.meta.segmentId}.mp4`)

  try {
    const response = await (args.fetchImpl ?? fetch)(segmentsEndpoint(args.baseUrl), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${args.token}`,
        'idempotency-key': args.meta.segmentId,
      },
      body: form,
    })
    return classifyStatus(response.status)
  } catch (error) {
    // 네트워크에 닿지 못한 경우. 인터넷이 끊긴 상황이 여기로 온다.
    return { kind: 'retry', reason: error instanceof Error ? error.message : '네트워크 오류' }
  }
}
