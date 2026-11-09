# 데모가 최종적으로 가야 할 곳

2026-09-18 결정. 심사위원이 웹에서 체험하되, **흐름은 실제 서비스 그대로** 돌린다.
프론트 쪽은 구현이 끝났고, 백엔드는 CORS 까지 PR 에 들어갔다. 남은 것은 배포 설정이다.

## 목표 흐름

```
비밀 주소 /wanted-test 로 접속
   ↓
데모 계정으로 자동 로그인 (PC 화면 · 모바일 둘 다)
   ↓
public/demo-video 의 시연 영상이 CCTV 대신 카메라가 된다
   ↓
브라우저가 매장 PC 수집기 역할 — 30초 조각을 실제 서버로 업로드
   ↓
백엔드 AI 가 분석
   ↓
AI 가 위험으로 판정하면 → PC 경고(실시간 채널) + 열어 둔 모바일 페이지에 경고 · 휴대폰 알림
```

핵심은 **AI 판정이 진짜여야 한다**는 것이다. `/wanted-test` 에서는 화면이 아무것도 지어내지 않는다.
경고는 서버 AI 가 판정한 것만 뜬다. 루트 `/` 는 `/wanted-test` 로 넘어간다 — 예전 가짜 서버 데모는
`/index.html` 로만 남아 있다.

**데모 계정은 주소에 `/wanted-test` 가 있을 때만 붙는다** (2026-09-19). PC·휴대폰 앱을 두 벌씩 굽는다 —
실서버용은 `/wanted-test/pc/` · `/wanted-test/m/` 에 두고 데모 계정 값(LIVE_*)은 이 빌드에만 넣는다.
`/pc/` · `/m/` 은 가짜 서버 데모 빌드라 어떤 주소로 열어도(예전의 `?live=1`) 데모 계정에 닿지 않는다.
시연 영상도 `/wanted-test/demo-video/` 에 있다 (`scripts/build-all.mjs`).

`/wanted-test` 는 로고와 버튼 둘(`PC 뷰 보기` · `모바일 뷰 보기`)뿐인 링크 맵이다 (2026-09-20).
그 버튼이 여는 화면은 실제 앱 그대로다 — 시연용 설명 · 진행 표시 · QR 을 덧붙이지 않는다.
휴대폰 알림 권한은 첫 탭에 브라우저 기본 창으로만 묻는다.

## 왜 브라우저가 수집기인가

예전 문서의 가장 큰 구멍이 "브라우저는 RTSP 를 못 연다" 였다. 카메라 입력을 영상 파일로 바꾸면
RTSP 가 필요 없다. 에이전트가 할 "자르기"를 빌드 때 미리 해 두고, 브라우저는 재생 시각에 맞춰
그 조각을 올리기만 한다. 서버 입장에서는 매장 PC 가 올린 조각과 구별되지 않는다.

- 서버에 가짜 카메라·수집기를 상시 띄울 필요가 없다 (프로세스는 백엔드 스택뿐)
- 업로드·분석은 심사위원이 페이지를 열어 둔 동안만 일어난다
- 영상은 한 번만 올린다 (반복하면 같은 사건으로 알림이 계속 가고 서버 분석이 쌓인다). 영상이 끝나도 카메라는
  '감시 중'으로 남고 화면은 마지막 장면에 머문다. 다시 보려면 PC 의 '일시 중지' → '감시 다시 시작' 또는 새로고침

## 어떻게 돌아가나

| 조각 | 어디 | 하는 일 |
|---|---|---|
| 영상 자르기 | `apps/demo-web/scripts/demo-video.mjs` | `public/demo-video/*.mp4` → 480p · 원본 fps(최대 30) · 30초 H.264 조각 + 목록(manifest). 빌드 때 돈다 |
| 셸 | `apps/demo-web/wanted-test/` · `src/live.ts` | 링크 맵 — 로고 + `PC 뷰 보기`(`/wanted-test/pc/`) · `모바일 뷰 보기`(`/wanted-test/m/`). 앱을 안에 띄우지 않는다 |
| PC 화면 | `apps/pc/src/renderer/lib/live/` | `live-api.ts` — 데모 계정 로그인 · 매장 찾기 · 카메라 등록 · 하트비트 · 실시간 채널. `collector.ts` — 조각 업로드 |
| 모바일 | `apps/mobile/src/lib/config.ts` 외 | 실서버 빌드(`/wanted-test/m/`)는 데모 계정 자동 로그인, 페이지가 열려 있는 동안 10초마다 새로 읽고 새 경고는 휴대폰 알림으로 |
| 설정 | `apps/demo-web/scripts/build-all.mjs` | `LIVE_*` 환경변수를 앱마다 넘긴다. 절차는 [`demo-submission.md`](demo-submission.md) |

서버 호출·실시간 채널·하트비트는 **매장 PC 앱의 메인 프로세스 모듈을 그대로** 쓴다 (전부 fetch 만 써서
브라우저에서도 돈다). 조각 요청 모양과 재시도 정책도 에이전트와 같다 (`apps/pc/src/shared/upload-policy.ts`).
PC 앱 CSP 는 웹 데모 빌드에서만 `LIVE_API_URL` · `LIVE_SUPABASE_URL` 두 출처를 연다 — Electron 빌드는 그대로다.

## 확인한 것 / 못 한 것

| | |
|---|---|
| ✅ 로컬 가짜 백엔드로 전체 흐름 | 로그인 → 카메라 등록 → 매장 조각 길이 30초로 맞춤 → 30초마다 조각 업로드(meta 가 계약 그대로) → 위험 이벤트 → PC 경고 → 폰에서 '확인했어요' → PC 경고가 닫힘 |
| ✅ 단위 테스트 | 수집기(업로드 시점·meta·재시도·인증 실패·다시 시작), 데모 계정 로그인 |
| ✅ 실제 백엔드 — 업로드까지 (2026-09-19) | `app.scene-stealer.site/wanted-test` → 데모 계정 로그인 · 매장 · 카메라 등록 · CORS · 기기 토큰 조각 업로드 · AI 워커 인계 |
| ❌ 실제 AI 워커 | 모든 영상이 진행률 5% 에서 `failed`. 원인을 찾아 고쳤다 — 배포 대기 (아래 '남은 일' 8) |
| ✅ AI 판정 (로컬) | 서버와 같은 파이프라인 · 같은 조각으로 시연 영상이 매번 '높음'(1.86~1.93배) — [`public/demo-video/README.md`](../public/demo-video/README.md) |
| — 잠금화면 푸시 | **쓰지 않기로 했다** (2026-09-18). 폰은 페이지를 열어 둔 동안 새 경고를 목록과 휴대폰 알림으로 받는다 |
| ❌ 아이폰 | 알림은 홈 화면에 추가한 앱에서만 뜬다. 웹앱 정보(manifest)는 넣었지만 실기기로 확인 못 했다 |

## 남은 일 — 백엔드 (`SceneStealer1/scene-stealer-back`)

PR: https://github.com/SceneStealer1/scene-stealer-back/pull/1

1. **PR 머지 → `api.scene-stealer.site` 다시 배포 — ✅ 됨** (2026-09-18, `d12f9b6`). 팀원 main 과 겹치던
   `stores`·`devices`·`cameras` 는 PR 쪽 계약(`docs/api-contract.md`)으로 합쳤다.
2. **도메인 + HTTPS — ✅ 됨.** 웹 `https://app.scene-stealer.site`(Vercel), API `https://api.scene-stealer.site`.
   둘 다 코드에 기본값으로 들어 있다 (`build-all.mjs` 의 `LIVE_API_URL`, 백엔드 `CORS_ALLOWED_DOMAIN`).
3. **CORS — ✅ PR 에 넣었다** (`80e842a`, `5c9fd4e`). `scene-stealer.site` 와 그 하위 도메인의 https 페이지만
   허용한다 (backend · ingest-worker 같은 규칙, 계약 1.6). `*.vercel.app` 주소에서는 `/wanted-test` 가 막힌다.
4. **웹 푸시 — 하지 않기로 했다** (2026-09-18). 백엔드 `push.py`(레거시 FCM)·`/push/devices` 는 손대지 않는다.
5. **새 Supabase 프로젝트 + 스키마.** 팀원 스키마가 들어간 프로젝트에 적용하면 `create table if not exists`
   때문에 겹치는 테이블이 팀원 모양으로 남는다.
6. **데모 데이터.** 계정(이메일·비밀번호), 매장(영업시간 비움 — 채우면 낮에는 '높음'만 푸시), 기기 토큰.
   카메라는 브라우저가 알아서 등록한다.
7. **`INTERNAL_API_TOKEN`** 을 ingest·backend 양쪽에 — 없으면 카메라 상태가 실시간으로 안 간다.
8. **AI 워커 수정 배포** — 브랜치 `Piiziy/scene-stealer-back:fix/ai-worker-torchvision-cpu` 를 PR 로 올려
   머지하고 서버에서 `./build-deploy.sh`.
   - `ed86f11` torchvision 을 CPU 빌드로. PyPI 판(CUDA 빌드)이 CPU torch 와 섞여, 첫 프레임에서
     `operator torchvision::nms does not exist` 로 **모든 영상이 5% 에서 실패**했다. WSL 에서 서버와 같은
     설치 순서로 재현하고, 고친 Dockerfile 순서로 끝까지 도는 것까지 확인했다. 포즈 모델 가중치도 이미지에 넣는다.
   - `8935166` 가려진 keypoint 를 좌표로 쓰지 않게. ultralytics 가 가려진 점을 (0,0) 으로 채우는데 그대로
     정규화에 들어가 잡음이 되던 문제 — 이게 고쳐져야 시연 영상이 '높음'이 된다.
9. **배포 후 확인** — `/wanted-test` 를 한 번 열어 두고 Supabase `videos` 의 `status` 가 `done`,
   `anomaly_events` · `events` 에 행이 생기는지 본다. 영상이 끝나고 분석이 끝나면 PC 에 경고가 떠야 한다.

## 따져 볼 것

**AI 가 시연 영상을 잡는가 — 잡는 영상으로 골랐다.** AI 는 조각마다 작은 모델을 새로 학습해 **그 조각 안에서**
튀는 동작을 표시한다 (평균 + 2.5 표준편차). 영상 후보 11개로 돌려 본 결과 (2026-09-19)

- '높음'(기준의 1.5배)은 드물다. 튀는 묶음이 몇 개만 있어도 평균·표준편차가 같이 올라, 대부분 1.0~1.4배에 머문다.
  사람이 넘어지는 영상(CAUCAFall)도 '높음'은 안 나왔다. PC 경고창은 '높음'에만 뜬다
- fps 를 15 로 낮추면 더 안 잡힌다 → 시연 영상은 원본 fps 로 올린다
- 학습 시드가 없어 결과가 흔들렸는데, 가려진 keypoint 수정 뒤로는 같은 영상이면 거의 같게 나온다
- 프레임마다 포즈를 뽑는다. 26초 · 25fps 조각이 데스크톱 CPU 로 약 30초 — 서버는 이보다 느릴 수 있다
  (워커 하나, 동시 처리 불가)

→ 영상을 바꿀 때는 [`public/demo-video/README.md`](../public/demo-video/README.md) 의 방법으로 먼저 돌려 본다.

**여러 심사위원이 동시에 들어오면** 같은 계정·매장을 쓰므로 서로의 경고와 푸시가 섞인다.
들어올 때마다 새 계정을 만드는 방식은 백엔드 작업이 더 든다.

**테스트 영상은 공개된다.** 정적 파일이라 비밀 주소를 몰라도 받을 수 있다.

## 현재 배포

Vercel · `main` 푸시마다 자동. 루트 `vercel.json` 이 빌드 명령과 출력 폴더를 갖고 있고,
Import 할 때 Root Directory 만 비워 두면 된다. 같은 저장소에 Vercel 프로젝트가 여럿 붙어 있으니 하나만 남긴다.
