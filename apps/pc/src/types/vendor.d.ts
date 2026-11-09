/**
 * 타입 선언이 없는 벤더 패키지들.
 * onvif 는 콜백 기반 CommonJS 라이브러리라 우리 서비스 계층 뒤에 숨겨두고,
 * 여기서는 최소한의 형태만 선언한다.
 */
declare module 'onvif' {
  export const Discovery: {
    probe(
      options: { timeout?: number; resolve?: boolean },
      callback: (error: Error | null, found: unknown[]) => void,
    ): void
  }
  export const Cam: new (
    options: {
      hostname: string
      port?: number
      path?: string
      username?: string
      password?: string
      timeout?: number
    },
    callback: (error: Error | null) => void,
  ) => unknown
}

declare module 'ffprobe-static' {
  const ffprobe: { path: string }
  export default ffprobe
}

/**
 * electron.vite.config.ts 의 main.define 이 빌드 때 채운다. vitest 에서는
 * 정의되지 않으므로 쓰는 쪽에서 typeof 로 확인한다.
 */
declare const __SCENE_STEALER_BUILD_DEFAULTS__:
  | {
      readonly backendBaseUrl: string
      readonly supabaseUrl: string
      readonly supabaseAnonKey: string
    }
  | undefined

/**
 * 웹 데모 빌드(apps/demo-web/scripts/build-all.mjs)가 넣는 값. 실서버 데모(/wanted-test)만 쓴다.
 * Electron 빌드와 `npm run ui` 에서는 비어 있다.
 */
interface ImportMetaEnv {
  /** '1' 이면 실서버 데모 빌드(/wanted-test/pc/). 그 외에는 비어 있다. */
  readonly VITE_LIVE_MODE?: string
  readonly VITE_LIVE_API_URL?: string
  readonly VITE_LIVE_SUPABASE_URL?: string
  readonly VITE_LIVE_SUPABASE_ANON_KEY?: string
  readonly VITE_LIVE_EMAIL?: string
  readonly VITE_LIVE_PASSWORD?: string
  readonly VITE_LIVE_DEVICE_TOKEN?: string
  readonly VITE_LIVE_STORE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/** Vite 가 정적 자산을 번들하고 URL 문자열을 돌려준다. */
declare module '*.svg' {
  const url: string
  export default url
}
