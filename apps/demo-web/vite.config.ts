import { extname, resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'

/**
 * 배포(vercel.json)의 rewrite 를 `vite preview` 에도 똑같이 건다 — `npm run wanted` 가 이걸로 띄운다.
 * 두 앱은 주소를 브라우저에서 갈아 끼우는 SPA 라, /wanted-test/m/events/ev-1 을 새로 고치면 정적
 * 서버는 그런 파일이 없다고 한다. 그 앱의 index.html 을 대신 준다 — 확장자가 있는 주소(번들·영상)는 그대로.
 *
 * 슬래시 없는 /wanted-test 도 여기서 잡는다. 안 그러면 vite 의 SPA 되돌리기가 맨 위 index.html —
 * 가짜 서버 데모 셸 — 을 줘서, 심사위원이 받은 주소 그대로 열면 엉뚱한 데모가 뜬다.
 * 긴 주소를 먼저 본다 (/wanted-test/m 이 /wanted-test 보다 앞).
 */
const previewRewrites = (): Plugin => ({
  name: 'demo-web-preview-rewrites',
  configurePreviewServer: (server) => {
    const apps = ['/wanted-test/m', '/wanted-test/pc', '/wanted-test', '/m', '/pc']
    server.middlewares.use((req, _res, next) => {
      const [path = '/', query] = (req.url ?? '/').split('?')
      const app = extname(path) ? undefined : apps.find((prefix) => path === prefix || path.startsWith(`${prefix}/`))
      if (app) req.url = `${app}/index.html${query ? `?${query}` : ''}`
      next()
    })
  },
})

// 기본은 도메인 루트. 하위 경로에 올릴 때만 DEMO_BASE 로 알려 준다.
export default defineConfig(() => ({
  plugins: [previewRewrites()],
  // 개발 중에는 루트에서 띄운다 — 아래 프록시 경로(/pc, /m)와 맞아야 하기 때문이다.
  base: process.env.DEMO_BASE ?? '/',
  // scripts/demo-video.mjs 가 자른 시연 영상(.generated/demo-video/)을 /demo-video/ 로 내보낸다.
  // 개발 서버는 그대로 서빙하고(구간 요청 지원 — 영상 탐색에 필요), 빌드는 dist 로 복사한다.
  publicDir: resolve(__dirname, '.generated'),
  server: {
    port: 5180,
    // 배포본에서는 PC 앱과 모바일 앱이 같은 출처의 하위 폴더에 있다. 셸이 iframe 안을
    // 직접 만져야 하므로 개발 중에도 같은 출처로 보여야 한다 — 그래서 각자의 dev 서버로 프록시한다.
    //   npm run ui -w cctv-agent                 → 5174 (PC 앱)
    //   npm run web -w scene-stealer-mobile      → 8081 (모바일 앱)
    // /wanted-test/pc · /wanted-test/m 은 실서버 시연 빌드 자리다. 개발 중에 그쪽을 보려면 두 dev 서버를
    // VITE_LIVE_MODE=1 · EXPO_PUBLIC_LIVE_MODE=1 과 LIVE_* 값으로 띄운다 (배포 빌드는 build-all.mjs 가 나눠 굽는다).
    proxy: {
      '/wanted-test/pc': {
        target: 'http://localhost:5174',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wanted-test\/pc/, ''),
      },
      '/wanted-test/m': {
        target: 'http://localhost:8081',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/wanted-test\/m/, ''),
      },
      '/pc': { target: 'http://localhost:5174', changeOrigin: true, rewrite: (path) => path.replace(/^\/pc/, '') },
      '/m': { target: 'http://localhost:8081', changeOrigin: true, rewrite: (path) => path.replace(/^\/m/, '') },
    },
  },
  // `vite preview` 는 굽힌 dist 를 그대로 보여 줘야 한다. 비워 두지 않으면 위 개발용 프록시를
  // 물려받아 /pc · /m 을 떠 있지도 않은 개발 서버로 보낸다 (500).
  //
  // 예외가 하나. `npm run wanted -- --live` 는 로컬에서 진짜 백엔드를 본다. 브라우저가 직접 부르면
  // CORS 에 막히므로(백엔드는 https://*.scene-stealer.site 만 받는다) 이 서버가 대신 불러다 준다 —
  // 브라우저에게는 같은 출처다. 그때만 WANTED_LIVE_API 에 진짜 백엔드 주소가 들어온다.
  preview: {
    proxy: process.env.WANTED_LIVE_API
      ? {
          '/live-api': {
            target: process.env.WANTED_LIVE_API,
            changeOrigin: true,
            rewrite: (path) => path.replace(/^\/live-api/, ''),
            // 실시간 채널(SSE)은 끊기지 않고 흘러야 한다. 가운데서 묶어 두면 경고가 늦게 뜬다.
            configure: (proxy) => {
              proxy.on('proxyRes', (proxyRes) => {
                if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
                  proxyRes.headers['cache-control'] = 'no-cache, no-transform'
                }
              })
            },
          },
        }
      : {},
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: {
        // `/`            가짜 서버로 도는 데모
        main: resolve(__dirname, 'index.html'),
        // `/wanted-test` 실서버 시연 (대회 제출용 비공개 주소)
        wantedTest: resolve(__dirname, 'wanted-test/index.html'),
      },
    },
  },
}))
