import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { Platform } from 'react-native'
import { createApiClient, createMockApi, type SceneStealerApi } from '@scene-stealer/api'
import { config, usingMockApi } from './config'
import { useSession } from './session'

const ApiContext = createContext<SceneStealerApi | null>(null)

/**
 * 가짜 서버가 틀 영상. 데모 빌드는 EXPO_PUBLIC_CLIP_URL 로 같이 구운 파일을 준다.
 * 없으면 웹은 이 앱이 싣고 있는 public/clips/sample.mp4 를 쓴다 — 가짜 서버의 기본 주소(구글 예제 영상)는 403 으로 막혔다.
 */
const mockClipUrl = (): string | undefined =>
  config.clipUrl || (Platform.OS === 'web' ? `${config.webBaseUrl}/clips/sample.mp4` : undefined)

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const { session, accessToken, renew } = useSession()

  const api = useMemo<SceneStealerApi>(
    () =>
      usingMockApi
        ? createMockApi(mockClipUrl() ? { clipUrl: mockClipUrl() } : {})
        : createApiClient({
            baseUrl: config.apiUrl,
            // 실서버 시연은 만료가 가까우면 데모 계정으로 다시 로그인한 토큰을 준다.
            getToken: config.live ? accessToken : async () => session?.accessToken ?? null,
            // 그래도 서버가 거절하면(다른 서버에서 받은 토큰 · 서버에서 지워진 세션) 한 번 더 로그인한다.
            renewToken: config.live ? renew : undefined,
          }),
    [session?.accessToken, accessToken, renew],
  )

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
}

export const useApi = (): SceneStealerApi => {
  const api = useContext(ApiContext)
  if (!api) throw new Error('ApiProvider 안에서만 쓸 수 있습니다')
  return api
}
