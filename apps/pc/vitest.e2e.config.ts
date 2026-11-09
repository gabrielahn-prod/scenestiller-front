import { defineConfig } from 'vitest/config'

/**
 * E2E 전용 설정.
 *
 * 파일 병렬 실행을 끈다. E2E 파일마다 가짜 카메라와 ffmpeg 를 여러 개 띄우는데,
 * 두 파일이 동시에 돌면 서로 CPU 와 UDP 3702(WS-Discovery)를 두고 다퉈
 * 로직과 무관한 타임아웃이 난다.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    fileParallelism: false,
    testTimeout: 180_000,
    hookTimeout: 120_000,
  },
})
