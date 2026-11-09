/**
 * 실서버 데모 (`/wanted-test` 셸이 이 앱의 실서버 빌드 `/wanted-test/pc/` 를 연다).
 *
 * `?demo=1` 데모는 브라우저 안의 가짜 서버를 본다. 이쪽은 **진짜 백엔드**를 본다 —
 * 데모 계정으로 로그인하고, 테스트 영상을 CCTV 대신 물려 조각을 실제로 올린다.
 * 서버의 AI 가 판정한 것만 경고가 된다. 화면이 지어내는 것은 없다.
 *
 * 계정·토큰은 빌드 때 박힌다 (build-all.mjs 가 LIVE_* 환경변수를 넘긴다). 번들을 열면
 * 보이는 값이라 데모 전용 계정·매장에만 써야 한다.
 *
 * Electron 안(window.api 가 있는 곳)에서는 절대 켜지지 않는다.
 */

const read = (value: string | undefined): string => (value ?? '').trim()

export interface LiveConfig {
  /** 백엔드 주소 (nginx). /v1/segments 와 API 가 같은 출처에 있다. */
  readonly apiUrl: string
  readonly supabaseUrl: string
  readonly supabaseAnonKey: string
  readonly email: string
  readonly password: string
  /** 데모 매장에 등록해 둔 PC 의 기기 토큰. 조각 업로드·하트비트에 쓴다. */
  readonly deviceToken: string
  /** 비우면 데모 계정의 첫 매장을 쓴다. */
  readonly storeId: string
}

// import.meta.env.VITE_* 를 하나씩 그대로 적는다 — Vite 는 이 모양만 빌드 때 값으로 바꿔 넣는다.
export const liveConfig: LiveConfig = {
  apiUrl: read(import.meta.env.VITE_LIVE_API_URL).replace(/\/+$/, ''),
  supabaseUrl: read(import.meta.env.VITE_LIVE_SUPABASE_URL).replace(/\/+$/, ''),
  supabaseAnonKey: read(import.meta.env.VITE_LIVE_SUPABASE_ANON_KEY),
  email: read(import.meta.env.VITE_LIVE_EMAIL),
  password: read(import.meta.env.VITE_LIVE_PASSWORD),
  deviceToken: read(import.meta.env.VITE_LIVE_DEVICE_TOKEN),
  storeId: read(import.meta.env.VITE_LIVE_STORE_ID),
}

const REQUIRED: readonly (readonly [keyof LiveConfig, string])[] = [
  ['apiUrl', 'LIVE_API_URL'],
  ['supabaseUrl', 'LIVE_SUPABASE_URL'],
  ['supabaseAnonKey', 'LIVE_SUPABASE_ANON_KEY'],
  ['email', 'LIVE_EMAIL'],
  ['password', 'LIVE_PASSWORD'],
  ['deviceToken', 'LIVE_DEVICE_TOKEN'],
]

/** 빠진 환경변수 이름. 비어 있으면 실서버 데모를 돌릴 수 있다. */
export const missingLiveConfig = (config: LiveConfig = liveConfig): string[] =>
  REQUIRED.filter(([key]) => !config[key]).map(([, name]) => name)

/**
 * 실서버 데모 빌드인가. 웹 데모 빌드(build-all.mjs)가 `/wanted-test/pc/` 로 구울 때만 VITE_LIVE_MODE=1 을 넣는다.
 * 주소(예전의 `?live=1`)로는 켜지지 않는다 — 데모 계정은 주소에 /wanted-test 가 있을 때만 붙어야 하고,
 * `/pc/` 빌드에는 데모 계정 값도 싣지 않는다.
 */
export const isLiveDemo = typeof window !== 'undefined' && !window.api && import.meta.env.VITE_LIVE_MODE === '1'
