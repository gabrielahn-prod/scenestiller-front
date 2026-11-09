import { $, appUrl } from './shell'

/**
 * 실서버 시연 셸 (`/wanted-test`) — 어느 화면을 볼지 고르는 링크 맵.
 *
 * 로고와 버튼 두 개(PC 뷰 · 모바일 뷰)뿐이다. 앱을 안에 띄우지 않는다 — 각 주소에서 앱이 직접 뜨고,
 * 데모 계정 로그인도 시연 영상 업로드도 그 앱이 한다. 시작하지 못하면 앱이 제 화면으로 이유를 말한다.
 *
 * 데모 계정은 주소에 /wanted-test 가 있을 때만 붙는다. 두 앱의 실서버 빌드는 이 아래에만 있고,
 * /pc/ · /m/ 은 데모 계정이 실리지 않은 가짜 서버 데모다 (scripts/build-all.mjs).
 */

/** 워드마크 글꼴(Prompt 700) — 모바일 빌드에 같이 실린다. 없으면 아래 시스템 글꼴로 떨어진다. */
const installWordmarkFont = (): void => {
  const style = document.createElement('style')
  style.textContent =
    `@font-face { font-family: Prompt; font-weight: 700; font-display: swap; ` +
    `src: url('${appUrl('wanted-test/m/fonts/prompt/prompt-latin-700-normal.woff2')}') format('woff2'); }`
  document.head.append(style)
}

const main = (): void => {
  installWordmarkFont()
  // 배포 경로가 도메인 루트가 아닐 수도 있다 (DEMO_BASE). HTML 의 기본 주소를 그 경로로 다시 적는다.
  $<HTMLAnchorElement>('to-pc').href = appUrl('wanted-test/pc/')
  $<HTMLAnchorElement>('to-m').href = appUrl('wanted-test/m/')
}

main()
