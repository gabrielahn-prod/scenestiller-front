// Electron 없이 브라우저에서 렌더러만 띄우는 개발용 설정.
// window.api 가 없으면 renderer/lib/mock-api.ts 가 대신 붙는다.
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 실서버 시연(/wanted-test/pc/ 빌드)은 브라우저가 직접 백엔드와 Supabase 를 부른다.
 * 렌더러 CSP 는 default-src 'self' 라 그대로면 막힌다 — 웹 데모 빌드가 LIVE 주소를 넘겼을 때만
 * 그 두 출처를 connect-src 로 연다. Electron 빌드(electron.vite.config.ts)는 이 설정을 쓰지 않으므로
 * 앱의 CSP 는 그대로다.
 */
const liveOrigins = [process.env.VITE_LIVE_API_URL, process.env.VITE_LIVE_SUPABASE_URL].flatMap((url) => {
  try {
    return url ? [new URL(url).origin] : []
  } catch {
    return []
  }
})

const allowLiveConnect = (): Plugin => ({
  name: 'allow-live-connect',
  transformIndexHtml: (html) =>
    liveOrigins.length === 0
      ? html
      : html.replace("default-src 'self';", `default-src 'self'; connect-src 'self' ${[...new Set(liveOrigins)].join(' ')};`),
})

export default defineConfig({
  root: resolve(__dirname, 'src/renderer'),
  plugins: [react(), allowLiveConnect()],
  resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
  server: { port: 5174 },
})
