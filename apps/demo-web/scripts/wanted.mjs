#!/usr/bin/env node
/**
 * `npm run wanted` — 심사위원이 보는 `/wanted-test` 흐름을 이 컴퓨터에서 그대로 돌린다.
 *
 * 데모를 가짜 백엔드용 값으로 굽고(필요할 때만), 가짜 백엔드(:8787)와 웹(:4173)을 띄우고,
 * 매장 PC 화면과 사장님 휴대폰 화면을 둘 다 연다. Ctrl+C 로 둘 다 내린다.
 *
 * 기본은 가짜 백엔드다. 브라우저는 진짜 백엔드를 직접 부르지 못한다 — CORS 가
 * `https://*.scene-stealer.site` 페이지만 받는다 (scene-stealer-back backend/app/cors.py,
 * ingest-worker/src/cors.ts). 그래서 계약과 같은 모양으로 답하는 [`stub-backend.mjs`](stub-backend.mjs) 를 쓴다.
 *
 * `--live` 는 진짜 백엔드를 본다. 앱에는 이 미리보기 서버의 경로(/live-api)를 API 주소로 주고 서버가
 * 대신 넘긴다 (vite.config.ts 의 preview.proxy) — 브라우저에게는 같은 출처라 CORS 를 타지 않는다.
 * 데모 계정 값은 저장소에 없다. `.env.local` 에 넣어 두면 읽는다 (git 에 올라가지 않는다).
 *
 * 어느 쪽이든 이 dist 는 배포하지 않는다 — Vercel 은 저장소를 새로 굽는다.
 *
 *   npm run wanted                 바뀐 게 있을 때만 굽고 띄운다 (가짜 백엔드)
 *   npm run wanted -- --live       진짜 백엔드로 (.env.local 의 LIVE_* 가 필요하다)
 *   npm run wanted -- --build      무조건 다시 굽는다
 *   npm run wanted -- --no-build   굽지 않고 있는 dist 로 띄운다
 *   npm run wanted -- --no-open    창을 열지 않는다 (주소만 찍는다)
 */
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { connect } from 'node:net'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const demoWeb = resolve(here, '..')
const repo = resolve(demoWeb, '../..')
const dist = resolve(demoWeb, 'dist')
/** 무엇을 어떤 값으로 구웠는지. 다음에 다시 구울지 여기 적힌 것과 비교해 정한다. */
const stampPath = resolve(dist, '.wanted-build.json')

const WEB_PORT = 4173
const API_PORT = 8787
const WEB = `http://localhost:${WEB_PORT}`

/** 가짜 백엔드가 아는 계정·매장·기기 토큰. stub-backend.mjs 위쪽에 같은 값이 박혀 있다. */
const STUB_LIVE = {
  LIVE_API_URL: `http://localhost:${API_PORT}`,
  LIVE_SUPABASE_URL: `http://localhost:${API_PORT}`,
  LIVE_SUPABASE_ANON_KEY: 'local',
  LIVE_EMAIL: 'demo@scene.test',
  LIVE_PASSWORD: 'pw',
  LIVE_DEVICE_TOKEN: 'ss_dev_demo',
  LIVE_STORE_ID: 'store-demo',
}

/** --live 에서 채워야 하는 값. LIVE_API_URL · LIVE_STORE_ID 는 기본값이 있다. */
const LIVE_REQUIRED = ['LIVE_SUPABASE_URL', 'LIVE_SUPABASE_ANON_KEY', 'LIVE_EMAIL', 'LIVE_PASSWORD', 'LIVE_DEVICE_TOKEN']
const LIVE_API_DEFAULT = 'https://api.scene-stealer.site'
/** 값을 두는 곳. git 에 올라가지 않는다 (.gitignore 의 .env.*). */
const ENV_FILE = resolve(repo, '.env.local')

/** KEY=값 한 줄씩. 따옴표로 감싼 값도 받는다. */
const readEnvFile = () => {
  if (!existsSync(ENV_FILE)) return {}
  const entries = readFileSync(ENV_FILE, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=')
      if (at < 0) return null
      const value = line.slice(at + 1).trim()
      return [line.slice(0, at).trim(), value.replace(/^["']|["']$/g, '')]
    })
  return Object.fromEntries(entries.filter(Boolean))
}

/**
 * 진짜 백엔드를 볼 때 앱에 넣을 값.
 *
 * 브라우저는 백엔드를 직접 부르지 못한다 — 백엔드 CORS 가 https://*.scene-stealer.site 만 받아서
 * localhost 페이지는 거절당한다. 그래서 앱에는 이 미리보기 서버의 경로(/live-api)를 API 주소로 주고,
 * 서버가 대신 진짜 백엔드로 넘긴다 (vite.config.ts 의 preview.proxy). 브라우저에게는 같은 출처다.
 * 로그인(Supabase)은 어느 출처든 받아 주므로 그대로 진짜 주소로 간다.
 */
const liveConfig = () => {
  const file = readEnvFile()
  const read = (key) => (process.env[key] ?? file[key] ?? '').trim()
  const missing = LIVE_REQUIRED.filter((key) => !read(key))
  if (missing.length > 0) {
    throw new Error(
      `진짜 백엔드로 붙으려면 값이 더 필요합니다: ${missing.join(', ')}\n` +
        `Vercel 프로젝트 Settings → Environment Variables 의 같은 이름 값을 ${ENV_FILE} 에 한 줄씩 넣어 주세요 (git 에 올라가지 않습니다):\n` +
        `  LIVE_SUPABASE_URL=...\n  LIVE_SUPABASE_ANON_KEY=...\n  LIVE_EMAIL=...\n  LIVE_PASSWORD=...\n  LIVE_DEVICE_TOKEN=...\n  LIVE_STORE_ID=...(매장이 하나면 비워도 됩니다)`,
    )
  }
  const apiUrl = read('LIVE_API_URL') || LIVE_API_DEFAULT
  return {
    apiUrl,
    env: {
      LIVE_API_URL: `${WEB}/live-api`,
      LIVE_SUPABASE_URL: read('LIVE_SUPABASE_URL'),
      LIVE_SUPABASE_ANON_KEY: read('LIVE_SUPABASE_ANON_KEY'),
      LIVE_EMAIL: read('LIVE_EMAIL'),
      LIVE_PASSWORD: read('LIVE_PASSWORD'),
      LIVE_DEVICE_TOKEN: read('LIVE_DEVICE_TOKEN'),
      LIVE_STORE_ID: read('LIVE_STORE_ID'),
    },
  }
}

/** 이 안의 파일이 구운 시각보다 새로우면 다시 굽는다. 없는 경로는 건너뛴다. */
const SOURCES = [
  'apps/pc/src',
  'apps/pc/vite.ui.config.ts',
  'apps/pc/tailwind.config.js',
  'apps/mobile/src',
  'apps/mobile/public',
  'apps/mobile/app.json',
  'apps/demo-web/src',
  'apps/demo-web/index.html',
  'apps/demo-web/wanted-test',
  'apps/demo-web/vite.config.ts',
  // 굽는 데 쓰이는 스크립트만. 이 파일(wanted.mjs)·가짜 백엔드는 결과물에 들어가지 않는다.
  'apps/demo-web/scripts/build-all.mjs',
  'apps/demo-web/scripts/demo-video.mjs',
  'packages',
  'public/demo-video',
]
const SKIP = new Set(['node_modules', 'dist', '.expo', '.generated', '.turbo', '.git'])

const flags = new Set(process.argv.slice(2))
const wants = (name) => flags.has(`--${name}`)

const sleep = (ms) => new Promise((done) => setTimeout(done, ms))

/** 이 경로 아래에서 가장 최근에 바뀐 시각 (epoch ms). */
const newestMtime = (path) => {
  let stats
  try {
    stats = statSync(path)
  } catch {
    return 0
  }
  if (!stats.isDirectory()) return stats.mtimeMs
  let newest = stats.mtimeMs
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue
    newest = Math.max(newest, newestMtime(resolve(path, entry.name)))
  }
  return newest
}

/** 다시 구워야 하는 이유. 안 구워도 되면 null. */
const buildReason = (key, newest) => {
  if (!existsSync(resolve(dist, 'wanted-test/pc/index.html'))) return '구운 것이 없습니다'
  let stamp = null
  try {
    stamp = JSON.parse(readFileSync(stampPath, 'utf8'))
  } catch {
    return '이 스크립트로 구운 것이 아닙니다'
  }
  if (stamp.key !== key) return '지난번과 다른 설정(백엔드·계정)으로 구워져 있습니다'
  if ((stamp.newest ?? 0) < newest) return '그 뒤로 소스가 바뀌었습니다'
  return null
}

const runToEnd = (file, args, env) =>
  new Promise((done, fail) => {
    const child = spawn(process.execPath, [file, ...args], {
      cwd: repo,
      env: { ...process.env, ...env },
      stdio: 'inherit',
    })
    child.on('error', fail)
    child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`빌드가 ${code} 로 끝났습니다`))))
  })

const children = []
let stopping = false

const shutdown = (code) => {
  if (stopping) return
  stopping = true
  for (const child of children) {
    try {
      child.kill()
    } catch {
      // 이미 죽었다.
    }
  }
  setTimeout(() => process.exit(code), 300)
}

/** 서버 하나를 띄우고 출력 앞에 이름을 붙인다. 둘이 같이 찍혀도 어느 쪽인지 보이게. */
const startServer = (label, file, args, options = {}) => {
  const child = spawn(process.execPath, [file, ...args], {
    cwd: options.cwd ?? repo,
    env: { ...process.env, ...options.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const prefix = (stream) => {
    let rest = ''
    stream.setEncoding('utf8')
    stream.on('data', (chunk) => {
      const lines = (rest + chunk).split(/\r?\n/)
      rest = lines.pop() ?? ''
      for (const line of lines) if (line.trim()) console.log(`${label} ${line}`)
    })
  }
  prefix(child.stdout)
  prefix(child.stderr)
  child.on('exit', (code) => {
    if (stopping) return
    console.error(`\n${label} 가 멈췄습니다 (코드 ${code}). 전부 내립니다.`)
    shutdown(1)
  })
  children.push(child)
  return child
}

const knocks = (host, port) =>
  new Promise((done) => {
    const socket = connect({ host, port })
    const finish = (ok) => {
      socket.destroy()
      done(ok)
    }
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
    socket.setTimeout(400, () => finish(false))
  })

/**
 * 그 포트에 누가 답하나. 이미 떠 있으면 그걸 그대로 쓴다.
 * 두 주소를 다 두드린다 — 윈도에서 localhost 는 ::1 로 먼저 풀려서, vite 가 거기에만 붙어 있으면
 * 127.0.0.1 만 보고는 '안 떴다'고 잘못 판단한다.
 */
const responds = async (port) => (await Promise.all([knocks('127.0.0.1', port), knocks('::1', port)])).some(Boolean)

const waitFor = async (port, label) => {
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await responds(port)) return
    await sleep(200)
  }
  throw new Error(`${label} 가 30초 안에 뜨지 않았습니다`)
}

/** 기본 브라우저로 연다. */
const openInBrowser = (url) => {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]]
  const child = spawn(command, args, { detached: true, stdio: 'ignore' })
  child.on('error', () => console.log(`브라우저를 열지 못했습니다 — 직접 열어 주세요: ${url}`))
  child.unref()
}

const main = async () => {
  const live = wants('live') ? liveConfig() : null
  const buildEnv = live ? live.env : STUB_LIVE
  // 값 자체는 남기지 않는다 (진짜 계정이 섞인다). 같은 설정인지만 알면 된다.
  const key = createHash('sha256').update(JSON.stringify(buildEnv)).digest('hex').slice(0, 16)
  const newest = Math.max(...SOURCES.map((path) => newestMtime(resolve(repo, path))))
  const reason = wants('build') ? '다시 구우라고 하셨습니다' : buildReason(key, newest)

  console.log(
    live
      ? `진짜 백엔드를 봅니다 — ${live.apiUrl}. 브라우저는 CORS 에 막히므로 이 서버가 /live-api 로 대신 넘깁니다.`
      : '가짜 백엔드로 돕니다. 진짜 백엔드를 보려면 --live.',
  )

  if (reason && wants('no-build')) {
    console.log(`굽지 않고 있는 것으로 띄웁니다 (${reason})`)
  } else if (reason) {
    console.log(`굽습니다 — ${reason}. 처음이면 몇 분 걸립니다.`)
    await runToEnd(resolve(here, 'build-all.mjs'), [], buildEnv)
    writeFileSync(stampPath, JSON.stringify({ key, newest, builtAt: new Date().toISOString() }, null, 2))
  } else {
    console.log('구운 것이 최신입니다 — 그대로 띄웁니다. (다시 구우려면 --build)')
  }

  if (live) {
    // 가짜 백엔드는 띄우지 않는다.
  } else if (await responds(API_PORT)) {
    console.log(`가짜 백엔드 :${API_PORT} 는 이미 떠 있어 그대로 씁니다.`)
  } else {
    startServer('[백엔드]', resolve(here, 'stub-backend.mjs'), [], { env: { PORT: String(API_PORT) } })
    await waitFor(API_PORT, '가짜 백엔드')
  }

  if (await responds(WEB_PORT)) {
    // 예전 실행이 남아 있으면 그 서버는 예전 dist·예전 설정을 준다 — 엉뚱한 화면을 보며 고치게 된다.
    // 지금 구운 것과 같은 것을 주는지 보고, 다르면 여기서 멈춘다.
    const served = await fetch(`${WEB}/wanted-test`).then(
      (response) => (response.ok ? response.text() : ''),
      () => '',
    )
    const sameBuild = served.trim() === readFileSync(resolve(dist, 'wanted-test/index.html'), 'utf8').trim()
    // --live 는 넘겨주는 길까지 살아 있어야 한다. 가짜 백엔드로 띄워 둔 서버에는 그 길이 없다.
    const proxied = !live || (await fetch(`${WEB}/live-api/healthz`).then((response) => response.ok, () => false))
    if (!sameBuild || !proxied) {
      throw new Error(
        `:${WEB_PORT} 를 다른 서버가 쓰고 있습니다 — ${sameBuild ? '진짜 백엔드로 넘겨주지 않습니다' : '지금 구운 /wanted-test 를 주지 않습니다'}.\n` +
          '그 서버를 끄고 다시 실행해 주세요.',
      )
    }
    console.log(`웹 :${WEB_PORT} 는 이미 떠 있어 그대로 씁니다.`)
  } else {
    // vite 실행 파일을 node 로 직접 부른다 — 윈도의 vite.cmd 는 execFile 로 부를 수 없다.
    const manifestPath = createRequire(resolve(demoWeb, 'package.json')).resolve('vite/package.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const viteBin = resolve(dirname(manifestPath), typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.vite)
    startServer('[웹]', viteBin, ['preview', '--port', String(WEB_PORT), '--strictPort'], {
      cwd: demoWeb,
      env: { WANTED_LIVE_API: live?.apiUrl ?? '' },
    })
    await waitFor(WEB_PORT, '웹')
  }

  const pc = `${WEB}/wanted-test`
  const phone = `${WEB}/wanted-test/m/`
  console.log('')
  console.log(`  매장 PC 화면    ${pc}`)
  console.log(`  사장님 휴대폰   ${phone}`)
  console.log(
    live
      ? `  백엔드          ${live.apiUrl}  (진짜입니다 — 조각도 판정도 진짜 데모 매장에 남습니다)`
      : `  가짜 백엔드     http://localhost:${API_PORT}  (첫 조각에서 위험 이벤트를 만듭니다)`,
  )
  console.log('')
  console.log('  PC 화면이 시연 영상을 카메라 삼아 30초 조각을 올립니다. 잠시 뒤 PC 에 경고가 뜨고,')
  console.log("  휴대폰 화면에도 같은 경고가 옵니다. 휴대폰에서 '확인했어요' 를 누르면 PC 경고가 닫힙니다.")
  if (live) console.log('  경고는 서버 AI 가 판정한 것만 뜹니다 — 분석이 실패하면 아무 경고도 뜨지 않습니다.')
  console.log('')

  if (wants('no-open')) {
    console.log('창은 열지 않았습니다 (--no-open).')
  } else {
    openInBrowser(pc)
    // 두 창이 같은 순간에 뜨면 브라우저가 하나를 삼킨다.
    await sleep(700)
    openInBrowser(phone)
    console.log('두 창을 열었습니다.')
  }
  // 띄운 서버가 없으면 붙들고 있을 것도 없다 — 창만 열고 끝낸다.
  console.log(children.length === 0 ? '서버는 이미 떠 있던 것을 씁니다 — 이 명령은 여기서 끝납니다.' : 'Ctrl+C 로 내립니다.')
}

process.on('SIGINT', () => {
  console.log('\n내립니다…')
  shutdown(0)
})
process.on('SIGTERM', () => shutdown(0))

main().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  shutdown(1)
})
