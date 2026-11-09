#!/usr/bin/env node
/**
 * 심사위원용 웹 데모 한 덩어리로 굽기.
 *
 *   dist/                          가짜 서버 데모 셸 (/index.html)
 *   dist/pc/  dist/m/              가짜 서버 데모의 매장 PC 화면 · 사장님 앱 — 데모 계정이 실리지 않는다
 *   dist/wanted-test/              시연 화면 선택 — 기본은 백엔드 없는 샘플 모드
 *   dist/wanted-test/pc/           실서버 시연의 매장 PC 화면 (apps/pc 렌더러, 브라우저용)
 *   dist/wanted-test/m/            실서버 시연의 사장님 앱 (apps/mobile Expo 웹)
 *   dist/wanted-test/demo-video/   시연 영상과 30초 조각 — 레포루트/public/demo-video 원본으로 만든다
 *
 * 모두 같은 출처에 올라가야 셸이 iframe 안의 PC 앱을 직접 만질 수 있다.
 *
 * PC·모바일 앱은 두 벌씩 굽는다. 실서버 설정(LIVE_* — 데모 계정)은 /wanted-test/ 아래 빌드에만 넣고
 * DEMO_LIVE_MODE=1 일 때만 실서버로 돈다. 그래서 데모 계정은 주소에 /wanted-test 가 있을 때만 붙는다 —
 * /pc/ · /m/ 은 무엇을 붙여 열어도(예전의 ?live=1) 데모 계정에 닿지 않는다.
 */
import { execFileSync } from 'node:child_process'
import { cpSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv } from 'vite'
import { buildDemoVideos } from './demo-video.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const demoWeb = resolve(here, '..')
const repo = resolve(demoWeb, '../..')
const dist = resolve(demoWeb, 'dist')
// 기본 배포는 백엔드 없이 바로 열리는 시연 화면이다. 실서버는 명시적으로 켠다.
const liveMode = process.env.DEMO_LIVE_MODE === '1'
const localLiveEnv = liveMode ? loadEnv('production', repo, 'LIVE_') : {}

/**
 * 앱이 올라갈 경로. 기본은 도메인 루트다.
 * GitHub Pages 처럼 저장소 하위 경로에 올릴 때만 DEMO_BASE 로 알려 준다.
 */
const base = process.env.DEMO_BASE ?? '/'
const pushEndpoint = process.env.DEMO_PUSH_ENDPOINT ?? ''
const vapidKey = process.env.DEMO_VAPID_PUBLIC_KEY ?? ''

/**
 * 실서버 시연(/wanted-test) 설정. Vercel 프로젝트 환경변수로 넣는다 (docs/demo-submission.md).
 * Vercel 배포에는 필수다. 누락되면 빌드를 중단해 작동하지 않는 데모가 배포되지 않게 한다.
 * 전부 번들에 박혀 공개되는 값이다. 데모 전용 계정·매장·기기 토큰만 넣는다.
 */
const LIVE_KEYS = [
  'LIVE_API_URL',
  'LIVE_SUPABASE_URL',
  'LIVE_SUPABASE_ANON_KEY',
  'LIVE_EMAIL',
  'LIVE_PASSWORD',
  'LIVE_DEVICE_TOKEN',
  'LIVE_STORE_ID',
]
/**
 * 같은 출처의 프록시를 사용한다(vercel.json). Vercel 기본 주소와 사용자 도메인에서
 * 로그인·API·조각 업로드가 같은 방식으로 동작한다. 다른 서버를 볼 때 LIVE_API_URL 로 바꾼다.
 */
const LIVE_DEFAULTS = { LIVE_API_URL: '/live-api' }
const live = Object.fromEntries(
  LIVE_KEYS.map((key) => [key, (process.env[key] ?? localLiveEnv[key] ?? '').trim() || (LIVE_DEFAULTS[key] ?? '')]),
)
/** 앱마다 번들러가 받아 주는 접두사가 다르다 (Vite: VITE_, Expo: EXPO_PUBLIC_). */
const liveEnv = (prefix, keys = LIVE_KEYS) => Object.fromEntries(keys.map((key) => [`${prefix}${key}`, live[key]]))

/**
 * 워크스페이스에서 보이는 패키지의 CLI 를 node 로 직접 부른다.
 * `npx` 는 윈도에서 npx.cmd 라 execFile 로 부를 수 없다 (셸을 거치면 공백 든 경로가 깨진다).
 */
const runBin = (cwd, pkg, args, options = {}) => {
  const manifestPath = createRequire(resolve(cwd, 'package.json')).resolve(`${pkg}/package.json`)
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const entry = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[pkg]
  if (!entry) throw new Error(`${pkg} 의 실행 파일을 찾지 못했습니다`)
  console.log(`\n$ ${pkg} ${args.join(' ')}`)
  execFileSync(process.execPath, [resolve(dirname(manifestPath), entry), ...args], { stdio: 'inherit', cwd, ...options })
}

console.log(`베이스 경로: ${base}`)
console.log(`푸시 엔드포인트: ${pushEndpoint || '(없음 — 휴대폰은 로컬 알림으로 동작)'}`)
// 값은 찍지 않는다 — 빌드 로그는 공유되는 경우가 많다.
const missingLive = LIVE_KEYS.filter((key) => key !== 'LIVE_STORE_ID' && !live[key])
console.log(`시연 모드: ${liveMode ? '실제 백엔드' : '샘플 데이터 (백엔드 연결 없음)'}`)
console.log(`실서버 시연 설정: ${missingLive.length === 0 ? '있음' : `빠짐 → ${missingLive.join(', ')}`}`)
if (liveMode && missingLive.length > 0) {
  throw new Error(`라이브 시연 환경변수가 없습니다: ${missingLive.join(', ')}. Vercel 프로젝트 설정을 복원한 뒤 다시 배포해 주세요.`)
}

rmSync(dist, { recursive: true, force: true })
mkdirSync(dist, { recursive: true })

// 0. 시연 영상을 30초 조각으로. 셸 빌드(3)가 .generated/ 를 dist 로 복사한다.
const demoVideos = buildDemoVideos()

/** 실서버 설정을 비운 값. 가짜 서버 데모 빌드에 데모 계정이 섞여 들어가지 않게 명시해서 지운다. */
const blankEnv = (prefix, keys = LIVE_KEYS) => Object.fromEntries(keys.map((key) => [`${prefix}${key}`, '']))

// 1. 매장 PC 화면 — 가짜 서버 데모(/pc/)와 실서버 시연(/wanted-test/pc/) 두 벌.
// apps/pc 안에서 돌린다 — tailwind.config.js 의 content 경로가 상대경로라
// 레포 루트에서 돌리면 클래스를 하나도 못 찾고 `bg-page` 가 없다며 죽는다.
const buildPc = (outDir, basePath, env) =>
  runBin(resolve(repo, 'apps/pc'), 'vite', [
    'build',
    '--config', 'vite.ui.config.ts',
    '--base', basePath,
    '--outDir', outDir,
    '--emptyOutDir',
  ], { env: { ...process.env, ...env } })

buildPc(resolve(dist, 'pc'), `${base}pc/`, { ...blankEnv('VITE_'), VITE_LIVE_MODE: '', VITE_DEMO_MODE: '' })
buildPc(resolve(dist, 'wanted-test/pc'), `${base}wanted-test/pc/`, liveMode
  ? { ...liveEnv('VITE_'), VITE_LIVE_MODE: '1', VITE_DEMO_MODE: '' }
  : { ...blankEnv('VITE_'), VITE_LIVE_MODE: '', VITE_DEMO_MODE: '1' })

// 2. 모바일 앱. Expo 는 출력 경로를 인자로 받고, 베이스 경로는 app.json 의 experiments.baseUrl 이 정한다.
// --clear: EXPO_PUBLIC_* 는 번들에 글자 그대로 박히는데, Metro 캐시(임시 폴더)는 값이 바뀐 걸 모른다.
// 비우지 않으면 로컬에서 LIVE_* 를 바꿔 구워도 예전 값이 남는다. (Vercel 은 매번 새 컨테이너라 상관없다.)
// 모바일도 두 벌 — 가짜 서버 데모(/m/)와 실서버 시연(/wanted-test/m/). 실서버 쪽은 모든 화면 주소가
// /wanted-test/m/… 라, 새로고침하거나 알림을 눌러 다시 열려도 주소에 /wanted-test 가 남는다.
// 모바일은 업로드를 하지 않으므로 기기 토큰은 넘기지 않는다.
const MOBILE_LIVE_KEYS = ['LIVE_API_URL', 'LIVE_SUPABASE_URL', 'LIVE_SUPABASE_ANON_KEY', 'LIVE_EMAIL', 'LIVE_PASSWORD', 'LIVE_STORE_ID']
const mobileIcon = resolve(repo, 'apps/mobile/assets/images/icon.png')

const buildMobile = (outDir, basePath, env) => {
  runBin(resolve(repo, 'apps/mobile'), 'expo', ['export', '-p', 'web', '--clear', '--output-dir', outDir], {
    env: {
      ...process.env,
      // 앱이 올라갈 경로. 정적 자산 주소(EXPO_WEB_BASE_URL)와 런타임 주소(EXPO_PUBLIC_*)가 같아야 한다.
      EXPO_WEB_BASE_URL: basePath,
      EXPO_PUBLIC_WEB_BASE_URL: basePath,
      ...env,
    },
  })
  // 홈 화면에 추가할 때 쓰는 아이콘. 아이폰은 홈 화면에 추가한 웹앱만 웹 푸시를 받는다 (manifest 는 public/ 에 있다).
  if (existsSync(mobileIcon) && !existsSync(resolve(outDir, 'icon.png'))) cpSync(mobileIcon, resolve(outDir, 'icon.png'))
  // 라우터가 브라우저에서 도는 SPA 다. 정적 호스팅은 /m/events/ev-1 을 모르니 404 도 같은 문서를 주게 한다.
  const index = resolve(outDir, 'index.html')
  if (existsSync(index)) cpSync(index, resolve(outDir, '404.html'))
}

const mobileOut = resolve(dist, 'm')
buildMobile(mobileOut, `${base}m`.replace(/\/+$/, ''), {
  EXPO_PUBLIC_DEMO: '1',
  EXPO_PUBLIC_LIVE_MODE: '',
  EXPO_PUBLIC_PUSH_ENDPOINT: pushEndpoint,
  EXPO_PUBLIC_VAPID_PUBLIC_KEY: vapidKey,
  // 같이 구운 영상을 가리킨다. 테스트셋이 들어오면 apps/mobile/public/clips/ 의 파일만 갈아끼우면 된다.
  EXPO_PUBLIC_CLIP_URL: process.env.DEMO_CLIP_URL ?? `${base}m/clips/sample.mp4`,
  ...blankEnv('EXPO_PUBLIC_', MOBILE_LIVE_KEYS),
})
const liveMobileOut = resolve(dist, 'wanted-test/m')
buildMobile(liveMobileOut, `${base}wanted-test/m`, liveMode ? {
  EXPO_PUBLIC_DEMO: '',
  EXPO_PUBLIC_LIVE_MODE: '1',
  EXPO_PUBLIC_PUSH_ENDPOINT: '',
  EXPO_PUBLIC_VAPID_PUBLIC_KEY: '',
  EXPO_PUBLIC_CLIP_URL: '',
  ...liveEnv('EXPO_PUBLIC_', MOBILE_LIVE_KEYS),
} : {
  ...blankEnv('EXPO_PUBLIC_', MOBILE_LIVE_KEYS),
  EXPO_PUBLIC_API_URL: '',
  EXPO_PUBLIC_SUPABASE_URL: '',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: '',
  EXPO_PUBLIC_DEMO: '1',
  EXPO_PUBLIC_LIVE_MODE: '',
  EXPO_PUBLIC_PUSH_ENDPOINT: '',
  EXPO_PUBLIC_VAPID_PUBLIC_KEY: '',
  EXPO_PUBLIC_CLIP_URL: `${base}wanted-test/clips/sample.mp4`,
})

// PC 앱과 모바일 앱이 같은 영상을 튼다. 두 번 굽지 않게 셸 옆에 한 벌만 둔다.
const clipsSrc = resolve(repo, 'apps/mobile/public/clips')
if (existsSync(clipsSrc)) {
  cpSync(clipsSrc, resolve(dist, 'clips'), { recursive: true })
  cpSync(clipsSrc, resolve(dist, 'wanted-test/clips'), { recursive: true })
}

// 샘플 모드도 저장소에 있는 실제 CCTV 시연 영상을 재생한다.
const sampleVideo = demoVideos.videos.find((video) => video.name === '계산대') ?? demoVideos.videos[0]
if (sampleVideo) {
  const source = resolve(demoWeb, '.generated/wanted-test/demo-video', sampleVideo.file)
  cpSync(source, resolve(dist, 'clips/sample.mp4'))
  cpSync(source, resolve(dist, 'wanted-test/clips/sample.mp4'))
}

// 카톡·슬랙 링크 미리보기용 로고. index.html 들의 og:image 가 도메인 루트의 이 파일을 가리킨다.
const ogImageSrc = resolve(demoWeb, 'assets/og-image.jpg')
if (existsSync(ogImageSrc)) cpSync(ogImageSrc, resolve(dist, 'og-image.jpg'))

// 3. 데모 셸.
runBin(demoWeb, 'vite', ['build'], {
  env: { ...process.env, DEMO_BASE: base, VITE_PUSH_ENDPOINT: pushEndpoint },
})

// GitHub Pages 는 기본적으로 Jekyll 을 태우는데, Jekyll 은 `_` 로 시작하는 폴더를 지운다.
// Expo 는 번들을 `_expo/` 에 넣는다 — 이 파일이 없으면 앱이 통째로 404 가 된다.
writeFileSync(resolve(dist, '.nojekyll'), '')

// 셸도 같은 이유로 404 대비를 해 둔다.
const shellIndex = resolve(dist, 'index.html')
if (existsSync(shellIndex)) cpSync(shellIndex, resolve(dist, '404.html'))

const size = (path) => (existsSync(path) ? `${(readFileSync(path).length / 1024).toFixed(0)}KB` : '없음')
console.log(`\n완료 → ${dist}`)
console.log(`  index.html              ${size(shellIndex)}`)
console.log(`  pc/index.html           ${size(resolve(dist, 'pc/index.html'))}`)
console.log(`  m/index.html            ${size(resolve(mobileOut, 'index.html'))}`)
console.log(`  wanted-test/index.html  ${size(resolve(dist, 'wanted-test/index.html'))}`)
console.log(`  wanted-test/pc/index.html  ${size(resolve(dist, 'wanted-test/pc/index.html'))}`)
console.log(`  wanted-test/m/index.html   ${size(resolve(liveMobileOut, 'index.html'))}`)
console.log(`  wanted-test/demo-video/manifest.json ${size(resolve(dist, 'wanted-test/demo-video/manifest.json'))}`)
