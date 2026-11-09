import type { AgentApi } from '../../shared/ipc'
import { inertDemoHook } from './demo'
import { isLiveDemo } from './live/config'
import { createLiveApi } from './live/live-api'
import { createMockApi } from './mock-api'

declare global {
  interface Window {
    api?: AgentApi
  }
}

/**
 * Electron 안에서는 preload 가 심어 준 진짜 API 를, 브라우저에서는 가짜 API 를 쓴다.
 * 덕분에 화면 작업을 Electron 없이 `npm run ui` 로 할 수 있다.
 *
 * 예외는 실서버 데모 빌드(/wanted-test/pc/, /wanted-test 가 연다) — 브라우저지만 진짜 백엔드를 본다.
 */
export const api: AgentApi = window.api ?? (isLiveDemo ? createLiveApi() : createMockApi())

export const isMock = !window.api && !isLiveDemo

// 진짜 앱에도 데모 훅의 껍데기를 심어 둔다 — 바깥 데모 페이지에서 쓰던 코드가
// 앱 안에서 돌더라도 window.__sceneStealer 가 없어서 터지는 일은 없어야 한다.
// 실서버 데모도 같다 — 화면이 위험을 지어내는 길은 막는다.
if (window.api || isLiveDemo) window.__sceneStealer = inertDemoHook
