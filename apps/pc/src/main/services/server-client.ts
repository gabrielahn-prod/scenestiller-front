import type { ServerRequest, ServerResult } from '../../shared/ipc'
import type { ServerSession } from './server-session'

/**
 * 렌더러의 백엔드 호출을 대신 보내는 프록시 (docs/api-contract.md).
 *
 * 렌더러가 직접 fetch 하지 않는 이유는 server-session.ts 첫 주석과 같다.
 * 대신 이 프록시가 사용자 JWT 를 들고 있으므로, 렌더러가 뚫렸을 때 이걸 통해
 * 다른 호스트로 토큰을 흘리지 못하게 목적지를 설정된 백엔드로만 묶는다.
 */

export interface ServerClientDeps {
  readonly getBaseUrl: () => string
  readonly session: Pick<ServerSession, 'accessToken' | 'invalidate'>
  readonly fetch: typeof fetch
}

export interface ServerClient {
  request(request: ServerRequest): Promise<ServerResult>
}

const fail = (status: number, error: string, data?: unknown): ServerResult =>
  data === undefined ? { ok: false, status, error } : { ok: false, status, error, data }

/** 설정된 백엔드와 같은 출처일 때만 URL 을 만든다. */
const resolveUrl = (baseUrl: string, path: string): URL | null => {
  // '/stores' 는 되고 '//evil', '@evil', 'https://evil', 'stores' 는 안 된다.
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('@')) return null
  // 워커 전용 경로. nginx 도 404 로 막지만 여기서 먼저 막는다.
  if (path === '/internal' || path.startsWith('/internal/')) return null
  try {
    const base = new URL(baseUrl)
    const url = new URL(`${base.pathname.replace(/\/$/, '')}${path}`, base)
    return url.origin === base.origin ? url : null
  } catch {
    return null
  }
}

export const createServerClient = (deps: ServerClientDeps): ServerClient => {
  const send = async (url: URL, request: ServerRequest, token: string): Promise<Response> =>
    deps.fetch(url.toString(), {
      method: request.method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        ...(request.body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    })

  const toResult = async (response: Response): Promise<ServerResult> => {
    if (response.status === 204) return { ok: true, status: 204, data: null }
    const data: unknown = await response.json().catch(() => null)
    if (response.ok) return { ok: true, status: response.status, data }
    // 계약 1.3 — 에러는 {"error": "..."} 모양이다. 나머지 필드도 같이 넘긴다
    // (409 의 existingDevice 같은 정보를 화면이 쓴다).
    const message = (data as { error?: unknown } | null)?.error
    return fail(
      response.status,
      typeof message === 'string' ? message : `요청에 실패했습니다 (${response.status})`,
      data ?? undefined,
    )
  }

  return {
    request: async (request) => {
      const baseUrl = deps.getBaseUrl()
      if (!baseUrl) return fail(0, '서버 주소가 설정되지 않았습니다. 설정 ▸ 고급에서 입력해 주세요.')

      const url = resolveUrl(baseUrl, request.path)
      if (!url) return fail(400, '허용되지 않는 요청 경로입니다.')

      const token = await deps.session.accessToken()
      if (!token) return fail(401, '로그인이 필요합니다.')

      try {
        const first = await send(url, request, token)
        if (first.status !== 401) return toResult(first)

        // 서버 시계와 어긋나 만료 판정이 달랐을 수 있다. 한 번만 갱신해서 다시 보낸다.
        const renewed = await deps.session.invalidate()
        if (!renewed) return fail(401, '로그인이 만료되었습니다. 다시 로그인해 주세요.')
        return toResult(await send(url, request, renewed))
      } catch {
        return fail(0, '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.')
      }
    },
  }
}
