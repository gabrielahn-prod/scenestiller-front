/**
 * app.json 을 그대로 쓰되, 배포마다 달라지는 값만 환경변수로 덧붙인다.
 *
 * - EXPO_WEB_BASE_URL: 앱이 올라가는 경로. GitHub Pages 는 '/cctv-agent-electron/m',
 *   Vercel 루트 배포는 '' 이다. 정적 자산 주소가 여기에 매달려 있어서 틀리면 앱이 통째로 404 난다.
 * - EAS_PROJECT_ID: 실기기에서 Expo 푸시 토큰을 받으려면 필요하다 (`eas init` 이 만들어 준다).
 */
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    baseUrl: process.env.EXPO_WEB_BASE_URL ?? '',
  },
  extra: {
    ...config.extra,
    eas: {
      ...config.extra?.eas,
      ...(process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : {}),
    },
  },
})
