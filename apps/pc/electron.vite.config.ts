import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

/**
 * 배포본에 박아 넣는 서버 주소. 사장님이 '설정 ▸ 고급'을 몰라도 첫 실행에서
 * 바로 로그인할 수 있어야 한다. 빌드하는 셸의 환경변수에서 읽는다:
 *   SCENE_STEALER_API_URL=https://api... SCENE_STEALER_SUPABASE_URL=... npm run dist
 * 비어 있으면 첫 실행 때 고급 설정에서 입력한다 (개발용).
 */
const buildDefaults = {
  backendBaseUrl: process.env.SCENE_STEALER_API_URL ?? '',
  supabaseUrl: process.env.SCENE_STEALER_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SCENE_STEALER_SUPABASE_ANON_KEY ?? '',
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    define: { __SCENE_STEALER_BUILD_DEFAULTS__: JSON.stringify(buildDefaults) },
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } } },
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    plugins: [react()],
    resolve: { alias: { '@shared': resolve(__dirname, 'src/shared') } },
    build: { rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } } },
  },
})
