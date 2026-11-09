# 제출 체크리스트

대회 규정 정리와, 제출까지 사장님이 직접 하셔야 하는 일.

## 규정이 정한 것

> 검증 절차를 거치지 않은 설치 파일(APK, exe 등)을 직접 다운로드하도록 하는 방식은 허용되지 않습니다.
> … 스토어 출시가 어려운 경우에는 서비스의 핵심 기능을 웹에서 체험할 수 있는 데모 버전을 제작해
> 해당 URL 을 서비스 링크로 제출해 주세요.

스토어 출시는 기간 안에 불가능하다.

| 경로 | 왜 안 되나 |
|---|---|
| 구글 플레이 | 신규 개인 개발자 계정은 **테스터 12명 × 14일 비공개 테스트**를 마쳐야 정식 출시가 된다 |
| 앱스토어 | 연 $99 + 심사. 9/21 까지 승인이 난다는 보장이 없다 |
| Microsoft Store | 심사 기간이 있고, 우리 데스크톱 앱은 mac·win 양쪽이라 스토어 하나로 안 덮인다 |

그래서 **웹 데모 URL** 을 제출한다. 앱을 포기하는 게 아니라, 실제 제품(데스크톱 앱 + 모바일 앱)은
그대로 두고 심사위원이 브라우저에서 체험할 창구를 따로 만든 것이다.

## 제출할 링크

Vercel 에 배포한 주소. 이 한 주소 안에 다 있다.

```
/wanted-test   실서버 시연 — 데모 계정 · 시연 영상 · 실제 서버 AI 판정 (제출용 주소)
/              → /wanted-test 로 넘어간다 (2026-09-18, vercel.json redirects)
/index.html    가짜 서버로 도는 예전 데모 (서버 없이도 끝까지 돈다). 링크는 걸려 있지 않다
/wanted-test/m/   실서버 시연의 사장님 앱 — /wanted-test 의 '모바일 뷰 보기'
/wanted-test/pc/  실서버 시연의 매장 PC 화면 — /wanted-test 의 'PC 뷰 보기'
/pc/  /m/         가짜 서버 데모의 PC 화면 · 사장님 앱 (데모 계정이 실리지 않는다)
```

루트로 들어와도 실서버 시연(데모 계정 로그인)이 열리므로, `/wanted-test` 는 더 이상 숨은 주소가 아니다.
데모 계정은 주소에 `/wanted-test` 가 있을 때만 붙는다 — `/pc/` · `/m/` 에는 데모 계정 값이 들어 있지 않다.

자세한 구조와 빌드 방법은 [`apps/demo-web/README.md`](../apps/demo-web/README.md),
실서버 시연이 어떻게 도는지는 [`demo-target-architecture.md`](demo-target-architecture.md).

## 사장님이 하실 일

### 1. Vercel 프로젝트 만들기 (필수 · 3분)

Vercel 에서 이 저장소를 Import 한다. **Root Directory 를 비워 두는 것**만 지키면 된다 —
`apps/pc` 같은 하위 폴더로 잡으면 PC 앱만 나오고 데모 셸과 모바일 앱이 빠진다.

| 항목 | 값 |
|---|---|
| Root Directory | (비움) |
| Framework Preset | Other |
| Build Command · Output Directory | 저장소 루트 `vercel.json` 이 지정한다 — 손대지 않아도 된다 |
| 환경변수 | 없어도 된다 |

`main` 에 올라갈 때마다 자동으로 다시 굽는다.

### 2. 잠금화면 알림 켜기 (선택 · 20분)

**안 해도 데모는 돌아간다.** 대신 심사위원이 폰 화면을 켜 둔 동안에만 알림이 보인다.
켜면 폰을 주머니에 넣었다 꺼내는 동선까지 체험된다. Firebase 는 필요 없다 — 웹 푸시는 VAPID 만 쓴다.

[`apps/demo-push/README.md`](../apps/demo-push/README.md) 를 따라 Cloudflare Worker 를 올린 뒤,
Vercel 프로젝트 **Settings → Environment Variables** 에 두 개를 넣는다.

| 이름 | 값 |
|---|---|
| `DEMO_PUSH_ENDPOINT` | `https://<워커주소>.workers.dev` |
| `DEMO_VAPID_PUBLIC_KEY` | `npm run vapid -w @scene-stealer/demo-push` 가 찍어 주는 공개키 |

### 3. 실서버 시연(/wanted-test) 켜기

백엔드가 배포된 뒤에 한다. 백엔드 쪽 선행 작업(도메인 · HTTPS, CORS 는 PR 에 들어감)은
[`demo-target-architecture.md`](demo-target-architecture.md) '남은 일' 에 있다.

**① 시연 영상.** `public/demo-video/` 에 넣고 푸시한다. 빌드가 30초 조각으로 자른다
([`public/demo-video/README.md`](../public/demo-video/README.md)).

**② 도메인 — 정해져 있고 코드에 기본값으로 들어 있다.** 백엔드는 같은 최상위 도메인의 https
페이지만 받는다 (CORS, 계약 1.6).

| | 주소 | 상태 (2026-09-18) |
|---|---|---|
| 웹 데모 | `https://app.scene-stealer.site` | Vercel 에 연결됨 |
| 백엔드 | `https://api.scene-stealer.site` | PR 버전 배포됨 (2026-09-18). 업로드까지 된다. **AI 워커 수정 배포 필요** — 지금은 모든 영상이 5% 에서 실패 ([`demo-target-architecture.md`](demo-target-architecture.md) '남은 일' 8) |
| 제출 링크 | `https://app.scene-stealer.site/wanted-test` | |

프론트의 API 주소(`LIVE_API_URL`)와 백엔드의 CORS 도메인(`CORS_ALLOWED_DOMAIN`)은 이 값이 기본이라 따로
넣지 않아도 된다. `*.vercel.app` 주소로 연 `/wanted-test` 는 CORS 에 막힌다.

**③ 데모 데이터.** 새 Supabase 프로젝트에 스키마를 적용한 뒤

1. Supabase 대시보드 → Authentication → Users → Add user — 이메일·비밀번호, **Auto Confirm** 켬
2. 그 계정으로 매장을 만든다 (`POST /stores`). 영업시간(`opensAt`·`closesAt`)은 비워 둔다
3. 그 매장에 PC 를 등록해 기기 토큰을 받는다 (`POST /stores/<매장>/devices`) — 평문은 이때 한 번만 나온다

카메라 등록과 조각 길이(30초) 맞춤은 `/wanted-test` 가 들어올 때마다 알아서 한다.

**④ Vercel 환경변수.** Settings → Environment Variables 에 넣고 다시 배포한다.

| 이름 | 값 |
|---|---|
| `LIVE_SUPABASE_URL` | `https://<프로젝트>.supabase.co` — 백엔드가 쓰는 것과 같은 프로젝트 |
| `LIVE_SUPABASE_ANON_KEY` | Supabase anon 공개키 |
| `LIVE_EMAIL` · `LIVE_PASSWORD` | ③-1 의 데모 계정 |
| `LIVE_DEVICE_TOKEN` | ③-3 의 기기 토큰 |
| `LIVE_STORE_ID` | (선택) 매장이 여럿이면 쓸 매장 id. 비우면 첫 매장 |
| `LIVE_API_URL` | (선택) 기본값 `https://api.scene-stealer.site`. 다른 서버를 볼 때만 |

> ⚠️ 이 값들은 **번들에 박혀 공개된다.** 주소를 아는 사람은 누구나 데모 계정으로 들어온다.
> 데모 전용 계정·매장만 쓰고, 다른 데이터가 있는 계정은 절대 넣지 않는다.

빠진 값이 있으면 `/wanted-test` 가 무엇이 빠졌는지 화면에 띄운다. `/` 데모는 영향이 없다.

### 4. `/` 데모의 테스트셋 영상 갈아끼우기 (선택)

`/` 가짜 서버 데모는 자리만 채운 무지 영상을 튼다.

```bash
cp <받은영상>.mp4 apps/mobile/public/clips/sample.mp4
git commit -am "chore: 데모 영상 교체" && git push
```

푸시하면 Vercel 이 다시 굽는다.

가짜 카메라에 먹여 **진짜 RTSP 로 잘라 보려면**:

```bash
npm run fake-camera -w cctv-agent -- --file <받은영상>.mp4
```

에이전트 입장에서는 진짜 CCTV 와 구분되지 않는다.

## 심사위원 동선 — `/wanted-test`

화면에는 실제 앱만 보인다 — 시연용 설명 · 진행 표시 · QR 은 없다.

1. 노트북에서 링크를 연다 → 데모 계정으로 로그인된 매장 PC 앱이 창을 가득 채우고, 시연 영상이 카메라가 되어 바로 돈다
2. 휴대폰에서 **같은 링크**를 연다 → 사장님 앱이 같은 계정으로 열린다. 화면을 처음 누를 때 브라우저가
   알림 권한을 묻는다 — 허용하고 페이지를 열어 둔다
3. 26초 영상이 끝나면 조각이 올라가고, 서버 AI 가 '높음'으로 판정하면(분석에 수십 초~1분 남짓) PC 에 경고가
   뜨고, 휴대폰 화면에도 뜬다(알림 포함). 판정 구간은 복면 쓴 사람이 CCTV 를 가린 직후(3.8~5.3초)다.
   잠금화면 푸시는 쓰지 않는다 — 휴대폰 화면이 꺼져 있으면 켰을 때 목록에 있다
4. 휴대폰에서 **확인했어요** → PC 의 경고가 같이 내려간다

조각 업로드 · 서버 분석이 어디까지 왔는지는 화면에 띄우지 않는다 (실제 앱과 같다). 확인하려면
Supabase `videos` 테이블의 `status` · `progress` · `error_message` 를 본다.

## 예전 가짜 서버 데모 동선 — `/index.html`

1. 노트북에서 링크를 연다 → 매장 PC 감시 화면이 그대로 뜬다 (로그인 없음)
2. QR 을 휴대폰으로 찍는다 → 사장님 앱이 열리고 알림을 허용한다
3. **데모 시작** → 카메라 5대가 붙어 영상이 흐르고, 30초마다 조각이 올라간다
4. 기다리면 영상 속 이상행동 시각에 **저절로** 경고가 울린다 (버튼으로 당길 수도 있다) → PC 에 경고가 뜨고 같은 순간 휴대폰에 알림이 간다
5. 알림을 탭 → 그 클립이 재생되는 상세 화면 → **확인했어요** 로 처리

## 아직 확인 못 한 것

- **실기기에서 서비스워커가 등록되는지.** 스크립트 동작(푸시 수신·알림 탭 라우팅)은
  테스트로 확인했지만, 등록 자체는 내장 브라우저가 막아 검증하지 못했다.
  배포 후 안드로이드 폰에서 `/m/`(실서버 시연은 `/wanted-test/m/`)을 열고 알림을 허용해 보면 10초 안에 판별된다.
- **Cloudflare Worker 실제 배포.** 암호화는 RFC 8291 공식 벡터로 검증했지만
  실제 푸시 서비스에 쏴 본 적은 없다.
- **`/wanted-test` 를 실제 백엔드로 끝까지.** 계약 모양대로 응답하는 로컬 가짜 서버로는 처음부터 끝까지
  확인했다(로그인 → 조각 업로드 → 경고 → 폰 확인 → PC 경고 닫힘). 실제 서버로는 조각 업로드와 AI 워커 인계까지
  확인했고(2026-09-19), AI 판정은 서버와 같은 파이프라인을 로컬에서 돌려 확인했다. AI 워커 수정이 배포되면
  실제 서버에서 경고까지 한 번 본다.
