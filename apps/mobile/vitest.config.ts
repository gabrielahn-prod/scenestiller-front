import { defineConfig } from 'vitest/config'

/**
 * 네이티브가 필요 없는 순수 로직만 여기서 돌린다.
 * 화면(.tsx)은 Expo 런타임이 있어야 하므로 실제 기기/웹에서 확인한다.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
  },
})
