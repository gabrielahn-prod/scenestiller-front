# CCTV 수집기 (cctv-agent)

무인매장 CCTV 이상행동 감지 시스템의 **영상 수집 모듈**.
매장 PC에 설치되어 ONVIF로 **카메라 여러 대**를 찾고, 각각의 RTSP 스트림을
일정 시간 단위 mp4 조각으로 잘라 백엔드로 올린다.

전체 시스템에서의 위치:

```
[CCTV] → [수집 에이전트] → [백엔드] → [AI(LLM) 서버] → 위험도
              ↑ 이 저장소            └ 임계 초과 → 프론트 표시 + 앱 푸시알림
```

## 설계 원칙

**에이전트는 오직 RTSP로만 영상을 받는다.** 웹캠을 직접 읽는 지름길이 없다.
개발·테스트도 `웹캠/영상파일 → 가짜 카메라(RTSP 서버) → 에이전트` 경로를 그대로 거친다.
그래서 RTSP 주소를 실제 CCTV로 바꾸는 것만으로 코드 수정 없이 동작한다.

## 빠른 시작

이 앱은 모노레포의 `apps/pc` 워크스페이스다 (패키지 이름 `cctv-agent`). 설치는 **저장소 루트**에서 한다.

```bash
npm install
```

아래 명령은 저장소 루트에서도, `apps/pc` 안에서도 똑같이 동작한다. 터미널 두 개로 나눠 띄운다.

```bash
npm run fake-camera
```

```bash
npm run dev
```

가짜 카메라가 ONVIF로 자신을 광고하므로, 앱의 카메라 검색 목록에 `FakeCam SIM-1000`이 뜬다.
아이디·비밀번호는 아무 값이나 넣으면 된다.

앱 흐름은 **2a 로그인·매장 연결 → 2b 카메라 추가 → 2c 실시간**이다 (디자인:
`design/씬스틸러 PC 앱.dc.html`). 서버 주소는 첫 화면 하단의 **설정 ▸ 고급**에서 넣는다.
배포본에는 빌드 때 박는다:

```bash
SCENE_STEALER_API_URL=https://api.example.com \
SCENE_STEALER_SUPABASE_URL=https://xxxx.supabase.co \
SCENE_STEALER_SUPABASE_ANON_KEY=... \
npm run dist
```

### 화면만 브라우저로 보기

`npm run ui` 는 백엔드 없이 가짜 API로 뜬다. 휴대폰 번호는 아무 010 번호, 인증번호는
아무 6자리(`000000` 은 틀린 번호로 취급)면 로그인된다. 새 위험 이벤트(2d 팝업)는 브라우저
콘솔에서 `window.__sceneStealer.emitRiskEvent()` 로 띄운다. 컴포넌트 전시장은
`#/dev/components`.

## 스크립트

| 명령 | 설명 |
|---|---|
| `npm run dev` | Electron 앱 개발 모드 |
| `npm run ui` | Electron 없이 브라우저에서 화면만 (`localhost:5174`, 가짜 API로 동작) |
| `npm run fake-camera` | 가짜 CCTV 카메라 (ONVIF + RTSP) 실행 |
| `npm test` | 전체 테스트 |
| `npm run test:unit` | 단위 테스트만 (빠름) |
| `npm run test:e2e` | 전체 파이프라인 E2E (실제 ffmpeg 사용, ~100초) |
| `npm run typecheck` | 타입 검사 |
| `npm run dist` | 설치 파일 빌드 (dmg/exe/AppImage) |

루트에서 실행하면 `build`·`typecheck`·`test*` 는 Turborepo 로(결과 캐시), 나머지는
`npm run <명령> -w cctv-agent` 로 이 앱에 넘어간다. 인자는 `--` 뒤에 붙인다
(예: `npm run dist -- --dir`).

`electron` 버전은 범위(`^`)가 아니라 **정확한 버전**으로 고정한다. 모노레포에서는 electron 이
루트 `node_modules` 로 올라가서, electron-builder 가 설치본에서 버전을 못 읽고 `package.json`
의 고정 버전만 본다. 올릴 때는 `npm install -w cctv-agent -D -E electron@<버전>`.

## 백엔드 API 규격

백엔드는 [scene-stealer-back](https://github.com/SceneStealer1/scene-stealer-back) 이다. 화면이 쓰는
API 전체는 [`docs/api-contract.md`](../../docs/api-contract.md) (백엔드 레포와 같은 사본). 아래는
그중 에이전트가 영상을 올리는 부분이다.

```http
POST {backendBaseUrl}/v1/segments
Content-Type: multipart/form-data
Authorization: Bearer <deviceToken>
Idempotency-Key: <segmentId>

  part "meta"  : application/json
  part "video" : video/mp4
```

```jsonc
// meta
{
  "segmentId": "01K5ZQ8G3M7X2N4P6R8T0V2W4Y",  // ULID. Idempotency-Key 와 동일
  "storeId": "store-gangnam-01",
  "deviceId": "agent-7f3k9m2p",
  "camera": {
    "id": "urn:uuid:2419d68a-...",   // ONVIF 기기 UUID. IP 가 바뀌어도 유지된다
    "name": "계산대",
    "manufacturer": "Hikvision",
    "model": "DS-2CD2143G2",
    "streamProfile": "sub"           // "main" | "sub"
  },
  "video": {
    "codec": "h264",                 // "h264" | "h265"
    "width": 704, "height": 480, "fps": 15,
    "durationMs": 300133,
    "sizeBytes": 19783421,
    "container": "mp4"
  },
  "startedAt": "2026-09-07T14:30:00.000Z",   // UTC
  "endedAt":   "2026-09-07T14:35:00.133Z",
  "sequence": 1284,
  "agentVersion": "1.0.0"
}
```

### 백엔드가 지켜야 할 것

| 응답 | 언제 | 에이전트 동작 |
|---|---|---|
| `201` | 정상 수신 | 조각 삭제, 다음으로 |
| `409` | **이미 받은 `segmentId`** | 성공으로 취급, 조각 삭제 |
| `401` `403` | 토큰 문제 | 재시도 중단, 화면에 경고 |
| `413` | 조각이 너무 큼 | 재시도 중단, 조각 길이 축소 안내 |
| `5xx` `408` `429` | 일시적 장애 | 지수 백오프 재시도 |

**`409` 처리는 선택이 아니라 필수다.** 업로드는 성공했으나 응답을 받지 못하는 경우가 반드시
생기고, 그때 에이전트는 같은 `segmentId`로 다시 보낸다. 백엔드가 이를 걸러내지 않으면
같은 5분이 두 번 분석되어 알림이 중복 발송된다.

`sequence`는 `(deviceId, camera.id)`마다 0부터 증가한다. **생성 순서지 업로드 순서가 아니다** —
인터넷이 끊겼다 복구되면 밀린 조각이 몰려 오지만 번호는 생성 시점 기준으로 유지된다.
번호가 건너뛰면 그 구간의 영상이 유실된 것이다.

## 동작 방식

```
[계산대] ─RTSP─> 워커1 ─조각─> 보관1 ─┐
[출입문] ─RTSP─> 워커2 ─조각─> 보관2 ─┼─> 업로더(하나) ─HTTPS─> [백엔드]
[창고]   ─RTSP─> 워커3 ─조각─> 보관3 ─┘   카메라를 돌아가며 하나씩
                    │
                녹화·재접속은 카메라마다 독립
```

- **카메라마다 녹화가 독립적이다.** 한 대가 끊기거나 비밀번호가 틀려도 그 카메라만 멈춘다.
- **업로드는 전체가 하나다.** 카메라마다 따로 올리면 대수만큼 동시 업로드가 일어나
  매장 업링크를 다 먹는다. 대신 카메라를 돌아가며 하나씩 집어 한 대가 밀려도 다른 대가 굶지 않는다.
- **모든 카메라가 같은 시각에 잘린다** (`-segment_atclocktime`). 14:30, 14:35처럼 경계가
  맞아 있어야 AI 서버가 같은 구간의 여러 카메라를 나란히 놓고 볼 수 있다.
- **재인코딩하지 않는다** (`-c:v copy`). CPU를 거의 쓰지 않고 화질 손실이 없다.
- **키프레임(IDR) 경계에서만 자른다** (`-f segment`). H.264/H.265는 임의 지점에서 자르면
  재생 불가능한 조각이 나온다.
- ffmpeg는 `spool/parts/`에 쓰고, **완성 신호(`-segment_list` manifest)를 받은 뒤에만**
  스풀 루트로 옮긴다. 스풀 루트에 있는 파일은 전부 완성본이라는 불변식이 성립한다.
- 녹화와 업로드는 스풀을 사이에 두고 완전히 분리되어 있다. 한쪽이 죽어도 다른 쪽은 돈다.

### 장애 처리

| 상황 | 동작 |
|---|---|
| 카메라 응답 없음 | 백오프 재시작 (1s→30s) |
| 조각 주기의 1.5배 동안 새 조각 없음 | 스트림이 멈춘 것으로 보고 강제 재시작 |
| **카메라 인증 실패** | **재시도 중단**, 사람 개입 요청 |
| 인터넷 끊김 | 조각을 디스크에 축적, 복구되면 오래된 순으로 전송 |
| 디스크 상한 초과 | 오래된 조각부터 삭제하고 화면에 경고 |
| PC 재부팅 | 자동 시작 → 스풀에 남은 것부터 이어서 업로드 |

되는 재시도와 안 되는 재시도를 구분하는 것이 원칙이다. 네트워크 장애는 기다리면 풀리지만
비밀번호가 틀린 것은 백만 번 시도해도 풀리지 않는다.

## 설정

`{userData}/config.json`에 저장된다 (macOS 기준 `~/Library/Application Support/cctv-agent/`).

| 항목 | 기본값 | 비고 |
|---|---|---|
| `backendBaseUrl` | 빌드 기본값 | 설정 ▸ 고급에서 바꿀 수 있다 |
| `supabaseUrl` | 빌드 기본값 | 휴대폰 인증번호를 보내는 로그인 서버 |
| `supabaseAnonKey` | 빌드 기본값 | 로그인 서버 공개 키 |
| `deviceToken` | — | 2a 에서 매장에 PC 를 연결하면 서버가 발급한다 |
| `storeId` | — | 2a 에서 고른 매장 |
| `deviceId` | 자동 생성 | 최초 실행 시 부여, 편집 불가 |
| `segmentSeconds` | `60` | 조각 길이. 화면에서는 **'알림 빠르기'**. 서버의 매장 설정을 하트비트로 따라간다 |
| `streamProfile` | `sub` | 서브스트림은 대역폭이 약 1/8 |
| `cameras` | `[]` | 감시 중인 카메라 목록 |
| `alignToClock` | `true` | 모든 카메라의 조각 경계를 벽시계에 맞춤 |
| `spoolLimitBytes` | `5 GiB` | **총량.** 카메라 수로 나누어 카메라마다 같은 몫 |
| `includeAudio` | `false` | |
| `autoStart` | `true` | 부팅 시 자동 시작 |

사장님 로그인 토큰은 `config.json` 이 아니라 `{userData}/session.bin` 에 OS 키체인으로 암호화해
둔다 — 설정 전체가 화면(렌더러)으로 넘어가기 때문이다.

**조각 길이는 감지 지연과 직결된다.** 5분으로 두면 이상행동 알림이 최대 5분 늦게 온다.
절도는 통상 30초 내에 끝나므로, 빠른 대응이 목표라면 30초~1분을 권한다.
반대로 배회처럼 느린 행동은 긴 맥락이 유리하다.

## 문서

- [프로토콜 흐름과 API 명세](docs/protocol-flow.md) — 단계별 프로토콜 사용법 + 백엔드 요청 규격
- [설계 문서](docs/superpowers/specs/2026-09-07-cctv-ingest-agent-design.md) — 프로토콜 조사, 아키텍처, 결정 근거
- [구현 계획서](docs/superpowers/plans/2026-09-07-cctv-ingest-agent.md)

## 현재 범위 밖

모니터가 있는 매장을 대상으로 한다. 아래는 나중에 **수집 엔진을 건드리지 않고** 얹을 수 있다.

- 모니터 없는 매장 (QR 페어링, 소프트AP 프로비저닝, 백엔드 명령중계, LED 상태표시)
- 모바일 앱 (QR 스캔 + 웹뷰 + 푸시 알림)
- 움직임 게이팅 — 아무 일 없던 구간을 안 보내 전송량을 70~90% 줄인다
- 위험도 결과 수신 (ONVIF Profile M)
