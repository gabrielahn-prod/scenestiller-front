/**
 * 실행 환경.
 *
 * 백엔드·Supabase 프로젝트가 아직 없으므로 주소가 비어 있으면 **가짜 모드**로 돈다.
 * 주소를 넣는 순간 같은 화면이 진짜 서버를 보게 된다 — 화면 코드는 바뀌지 않는다.
 */
const trim = (value: string | undefined): string => (value ?? '').trim()

/**
 * 실서버 시연 빌드인가 (`/wanted-test` → 휴대폰이면 `/wanted-test/m/`). 데모 계정으로 바로 들어가 진짜 서버를 본다.
 *
 * 웹 데모 빌드(apps/demo-web/scripts/build-all.mjs)가 `/wanted-test/m/` 로 구울 때만 EXPO_PUBLIC_LIVE_MODE=1 을
 * 넣는다. 주소(예전의 `?live=1`)나 브라우저 기억으로는 켜지지 않는다 — 데모 계정은 주소에 /wanted-test 가
 * 있을 때만 붙어야 한다. 이 빌드는 모든 화면 주소가 /wanted-test/m/… 라 새로고침·알림 탭에도 그대로다.
 */
const live = trim(process.env.EXPO_PUBLIC_LIVE_MODE) === '1'

export const config = {
  /** 실서버 시연 중인지. 이때는 아래 주소들이 LIVE_* 값이다. */
  live,
  apiUrl: live ? trim(process.env.EXPO_PUBLIC_LIVE_API_URL) : trim(process.env.EXPO_PUBLIC_API_URL),
  supabaseUrl: live ? trim(process.env.EXPO_PUBLIC_LIVE_SUPABASE_URL) : trim(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: live
    ? trim(process.env.EXPO_PUBLIC_LIVE_SUPABASE_ANON_KEY)
    : trim(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),

  /** 실서버 시연의 데모 계정. 빌드 때 박히는 공개 값이라 데모 전용 계정만 쓴다. */
  liveEmail: trim(process.env.EXPO_PUBLIC_LIVE_EMAIL),
  livePassword: trim(process.env.EXPO_PUBLIC_LIVE_PASSWORD),
  /** 비우면 데모 계정의 첫 매장. PC 화면과 같은 매장을 봐야 한다. */
  liveStoreId: trim(process.env.EXPO_PUBLIC_LIVE_STORE_ID),

  /** 웹 데모용. 비어 있으면 푸시 대신 페이지가 열려 있을 때만 뜨는 로컬 알림으로 내려앉는다. */
  pushEndpoint: trim(process.env.EXPO_PUBLIC_PUSH_ENDPOINT).replace(/\/+$/, ''),
  vapidPublicKey: trim(process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY),

  /**
   * 앱이 올라간 경로. 서비스워커와 아이콘 주소가 이걸 앞에 달아야 한다.
   * 기본값은 루트('') — 하위 경로에 올릴 때만 빌드가 채워 준다.
   */
  webBaseUrl: trim(process.env.EXPO_PUBLIC_WEB_BASE_URL).replace(/\/+$/, ''),

  /** 데모 모드 — 심사위원용 페이지. 로그인을 건너뛰고 가짜 서버로 시나리오를 돌린다. 실서버 시연과는 따로다. */
  demo: !live && trim(process.env.EXPO_PUBLIC_DEMO) === '1',

  /** 테스트셋 영상이 들어올 자리. 비우면 가짜 서버의 기본 샘플을 쓴다. */
  clipUrl: trim(process.env.EXPO_PUBLIC_CLIP_URL),
} as const

/** 실서버 시연인데 빌드에 빠진 설정 (Vercel 환경변수 이름). */
export const liveMissing: readonly string[] = live
  ? ([
      ['LIVE_API_URL', config.apiUrl],
      ['LIVE_SUPABASE_URL', config.supabaseUrl],
      ['LIVE_SUPABASE_ANON_KEY', config.supabaseAnonKey],
      ['LIVE_EMAIL', config.liveEmail],
      ['LIVE_PASSWORD', config.livePassword],
    ] as const)
      .filter(([, value]) => !value)
      .map(([name]) => name)
  : []

// 실서버 시연에서는 설정이 빠졌더라도 가짜 서버로 떨어지지 않는다 — 비밀 주소에서 가짜 데이터가
// 진짜처럼 보이면 안 된다. 요청은 실패하고, 화면 위 안내가 무엇이 빠졌는지 알린다.
export const usingMockApi = !live && config.apiUrl === ''
export const usingMockAuth = !live && (config.supabaseUrl === '' || config.supabaseAnonKey === '')
