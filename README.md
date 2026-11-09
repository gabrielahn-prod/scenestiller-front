# 씬스틸러 (Scene Stealer)

무인매장 CCTV 이상행동 감시 서비스의 **클라이언트 모노레포**. npm workspaces + Turborepo.
백엔드는 [scene-stealer-back](https://github.com/SceneStealer1/scene-stealer-back) 이다.

## 지금 무엇을 하고 있나 


대회 제출용 **웹 데모**를 만들고 있다. 규정상 APK·exe 를 직접 내려받게 할 수 없고
스토어 출시도 기간 안에 불가능해서, "핵심 기능을 웹에서 체험할 수 있는 데모" 를 URL 로 낸다.

제출 주소 **`/wanted-test`** 와 사이트 루트는 CCTV 시연 화면(`/wanted-test/pc/`)으로 바로 이동한다.
현재 기본 배포는 **백엔드 없이 동작하는 샘플 모드**다. 로그인 없이 샘플 CCTV, 위험 기록,
영상 재생, 확인·오탐 처리와 설정 화면을 볼 수 있다. PC 상단 **위험 알림 시연** 버튼으로 경고 팝업을 띄운다.
모바일 화면은 `/wanted-test/m/` 이다. 데이터 변경은 시연용이며 실제 AI 분석·업로드·원격 푸시는 실행하지 않는다.

실서버를 다시 연결할 때만 `DEMO_LIVE_MODE=1` 과 기존 `LIVE_*` 환경변수로 빌드한다.
로컬에서는 `npm run wanted -- --live` 를 사용한다. `.env.local` 에 `LIVE_*` 가 있어도 기본 시연은 서버에 접속하지 않는다.

**이 두 문서부터 읽으면 된다.**

| | |
|---|---|
| [`docs/demo-target-architecture.md`](docs/demo-target-architecture.md) | **가야 할 곳** — 목표 흐름, 지금과의 차이, 남은 일, 미해결 문제 |
| [`docs/demo-submission.md`](docs/demo-submission.md) | 제출 절차와 사람이 해야 하는 일 |

## 구성

| 경로 | 무엇 |
|---|---|
| [`apps/pc`](apps/pc/README.md) | 매장 PC 앱 `cctv-agent` (Electron) — 카메라 영상 수집·업로드, 사장님 화면 |
| [`apps/mobile`](apps/mobile/README.md) | 사장님 모바일 앱 (Expo) — 매장 밖에서 받는 위험 알림 |
| [`apps/demo-web`](apps/demo-web/README.md) | 심사위원용 웹 데모. 위 둘을 한 주소에 합쳐 올린다 |
| [`apps/demo-push`](apps/demo-push/README.md) | 웹 푸시 발송 (Cloudflare Worker). 데모의 알림만 담당 |
| `packages/api` | 백엔드 API 타입과 클라이언트, 그리고 가짜 서버 |
| `packages/tokens` | 피그마에서 뽑은 디자인 토큰 (PC·모바일 공용) |
| [`docs/api-contract.md`](docs/api-contract.md) | 백엔드 API 계약 (백엔드 레포와 같은 사본) |
| `public/demo-video/` | `/wanted-test` 에서 CCTV 대신 쓰는 시연 영상 (빌드가 30초 조각으로 자른다) |
| `design/` | 디자인 원본 (`.dc.html` 인라인 스타일이 정확한 값) |
| `handoff/` | 디자인 넘겨받을 때 받은 요구사항·프롬프트 |

## 시작

Node 22 · npm 10. 설치는 저장소 루트에서 한 번만 한다 (`node_modules` 는 루트 하나).

```bash
npm install
```

## 명령

루트에서 실행한다.

| 명령 | 설명 |
|---|---|
| `npm run build` | 모든 워크스페이스 빌드 (Turborepo, 결과 캐시) |
| `npm run typecheck` | 타입 검사 (Turborepo) |
| `npm run test:unit` | 단위 테스트 (Turborepo, 결과 캐시) |
| `npm run test:e2e` | E2E (캐시 안 함) |
| `npm run dev` | PC 앱 개발 모드 |
| `npm run wanted` | 심사위원이 보는 `/wanted-test` 를 이 컴퓨터에서 — 백엔드 없이 매장 PC·사장님 휴대폰 화면을 둘 다 연다. `-- --live` 면 진짜 백엔드로 (`.env.local` 필요) |
| `npm run ui` | PC 앱 화면만 브라우저로 (`localhost:5174`, 가짜 API) |
| `npm run fake-camera` | 가짜 CCTV 카메라. `-- --file <영상>` 으로 가진 영상을 물린다 |
| `npm run dist` | PC 앱 설치 파일 |
| `npm run build -w @scene-stealer/demo-web` | 웹 데모 전체 굽기 (`apps/demo-web/dist`) |
| `npm run start -w scene-stealer-mobile` | 모바일 앱 개발 서버 (QR) |

`dev`·`ui`·`fake-camera`·`dist` 는 `npm run <명령> -w cctv-agent` 로 PC 앱에 넘긴다. 인자는
`--` 뒤에 붙인다 (예: `npm run dev -- --remoteDebuggingPort 9339`). 한 워크스페이스만 Turborepo 로
돌리려면 `npx turbo run build --filter=cctv-agent`.

빌드 때 앱에 박는 환경변수(`SCENE_STEALER_API_URL` 등)는 [`turbo.json`](turbo.json) 의 `env` 에
적어 둔다. 적지 않은 변수는 Turborepo 가 빌드에 넘기지 않고, 캐시 키에도 들어가지 않는다.
