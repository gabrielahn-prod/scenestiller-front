# CCTV 영상 수집 에이전트 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 매장 PC에 설치되어 ONVIF로 CCTV를 찾아 선택하고, RTSP 스트림을 5분 단위 mp4 조각으로 잘라 백엔드에 업로드하는 Electron 앱을 만든다.

**Architecture:** Electron 메인 프로세스가 8개의 단일 책임 서비스로 구성된다. `SegmentRecorder`는 ffmpeg 자식 프로세스를 `-c copy -f segment`로 돌려 재인코딩 없이 키프레임 경계 조각을 만들고, 조각은 디스크 스풀을 거쳐 `Uploader`가 순차 업로드한다. 녹화와 업로드는 스풀을 사이에 두고 완전히 분리되어 한쪽이 죽어도 다른 쪽이 계속 동작한다. 렌더러(React)는 IPC로 상태만 구독한다.

**Tech Stack:** Electron · TypeScript · React 19 · Tailwind CSS · Vite (electron-vite) · Vitest · ffmpeg-static · onvif

**Spec:** `docs/superpowers/specs/2026-09-07-cctv-ingest-agent-design.md`

## Global Constraints

- **에이전트는 오직 RTSP로만 영상을 받는다.** 웹캠을 직접 읽는 경로를 만들지 않는다. 이것을 어기면 실제 CCTV 교체 보증이 깨진다.
- 조각 생성은 반드시 `-c copy` (재인코딩 금지) + `-f segment` (키프레임 경계 자동 정렬).
- 조각 완성 판정은 반드시 `-segment_list` manifest의 새 줄로 한다. 디렉토리 감시만으로 판단하면 미완성 파일을 업로드하게 된다.
- 업로드는 `Idempotency-Key` 헤더를 반드시 보내고, `409`는 성공으로 취급한다.
- 재시도 정책: `5xx`·네트워크 오류는 지수 백오프 재시도, `401`·`413`은 즉시 중단 후 사용자 개입 요청.
- 코딩 규약 (사용자 전역 설정): ES6 스타일, `let` 대신 `const`, 함수형, React 19 (`forwardRef` 사용 금지), 불변성 강제, Tailwind는 축약 클래스명(`size-5`, `m-5`)과 `cn()` 사용.
- 모든 시각은 UTC ISO 8601 문자열.
- `sequence`는 `(deviceId, cameraId)`마다 독립적으로 0부터 증가하며 재시작 후에도 이어진다. 생성 순서를 뜻하며 업로드 순서가 아니다.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/shared/types.ts` | main ↔ renderer 공유 타입 전부 |
| `src/main/lib/backoff.ts` | 지수 백오프 계산 (순수 함수) |
| `src/main/lib/ffmpeg.ts` | ffmpeg 바이너리 경로 해석, 실행 헬퍼 |
| `src/main/lib/segment-args.ts` | ffmpeg 조각 생성 인자 조립 (순수 함수) |
| `src/main/services/config-store.ts` | 설정 영속화, deviceId 생성, sequence 카운터 |
| `src/main/services/spool-store.ts` | 조각 파일 큐, 상한 관리 |
| `src/main/services/segment-recorder.ts` | ffmpeg 프로세스 + manifest 감시 |
| `src/main/services/uploader.ts` | multipart 업로드 + 응답별 정책 |
| `src/main/services/discovery.ts` | ONVIF WS-Discovery |
| `src/main/services/camera-probe.ts` | ONVIF 인증 + 프로필/RTSP URL 조회 |
| `src/main/services/snapshot.ts` | ffmpeg 1프레임 추출 |
| `src/main/services/supervisor.ts` | 전체 조립, 상태 머신, 재시작 |
| `src/main/index.ts` | Electron 앱 진입, 창, 트레이, 생명주기 |
| `src/main/ipc.ts` | IPC 핸들러 등록 |
| `src/preload/index.ts` | contextBridge API |
| `src/renderer/App.tsx` | 화면 라우팅 |
| `src/renderer/screens/*.tsx` | 카메라 선택 / 설정 / 대시보드 |
| `tools/fake-camera/*` | 테스트 도구: RTSP 서버 + ONVIF 응답기 |
| `tests/**` | 단위 · 통합 · E2E |

---

### Task 1: 프로젝트 스캐폴딩 + 공유 타입

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `electron.vite.config.ts`, `vitest.config.ts`
- Create: `src/shared/types.ts`
- Test: `tests/unit/types.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces: 아래 타입 전부. 이후 모든 태스크가 여기서 import 한다.

- [ ] **Step 1: 의존성 설치**

```bash
npm init -y
npm i -D electron electron-vite electron-builder typescript vite @vitejs/plugin-react vitest @types/node
npm i -D react react-dom @types/react @types/react-dom tailwindcss @tailwindcss/vite clsx tailwind-merge
npm i ffmpeg-static onvif ulid
```

- [ ] **Step 2: 공유 타입 작성**

```ts
// src/shared/types.ts
export type StreamProfileKind = 'main' | 'sub'
export type VideoCodec = 'h264' | 'h265'

export interface DiscoveredCamera {
  readonly id: string        // XAddr 기반 안정 식별자. IP가 바뀌어도 유지
  readonly xaddr: string
  readonly ip: string
  readonly port: number
  readonly manufacturer: string | null
  readonly model: string | null
  readonly name: string | null
}

export interface StreamProfile {
  readonly token: string
  readonly kind: StreamProfileKind
  readonly rtspUri: string
  readonly codec: VideoCodec
  readonly width: number
  readonly height: number
  readonly fps: number
}

export interface SelectedCamera {
  readonly id: string
  readonly name: string
  readonly manufacturer: string | null
  readonly model: string | null
  readonly rtspUri: string
  readonly streamProfile: StreamProfileKind
  readonly codec: VideoCodec
  readonly width: number
  readonly height: number
  readonly fps: number
}

export interface AgentConfig {
  readonly backendBaseUrl: string
  readonly deviceToken: string
  readonly storeId: string
  readonly deviceId: string
  readonly segmentSeconds: number
  readonly streamProfile: StreamProfileKind
  readonly spoolLimitBytes: number
  readonly includeAudio: boolean
  readonly autoStart: boolean
  readonly selectedCamera: SelectedCamera | null
}

export interface SegmentMeta {
  readonly segmentId: string
  readonly storeId: string
  readonly deviceId: string
  readonly camera: {
    readonly id: string
    readonly name: string
    readonly manufacturer: string | null
    readonly model: string | null
    readonly streamProfile: StreamProfileKind
  }
  readonly video: {
    readonly codec: VideoCodec
    readonly width: number
    readonly height: number
    readonly fps: number
    readonly durationMs: number
    readonly sizeBytes: number
    readonly container: 'mp4'
  }
  readonly startedAt: string
  readonly endedAt: string
  readonly sequence: number
  readonly agentVersion: string
}

export type CameraStatus = 'idle' | 'connecting' | 'streaming' | 'reconnecting' | 'auth-failed'
export type UploadStatus = 'idle' | 'uploading' | 'retrying' | 'offline' | 'auth-failed' | 'payload-too-large'

export interface AgentStatus {
  readonly running: boolean
  readonly camera: CameraStatus
  readonly upload: UploadStatus
  readonly uploadedCount: number
  readonly pendingCount: number
  readonly lastUploadAt: string | null
  readonly spoolBytes: number
  readonly spoolLimitBytes: number
  readonly bytesUploadedToday: number
  readonly lastError: string | null
  readonly spoolEvicted: boolean
}

export const DEFAULT_CONFIG: Omit<AgentConfig, 'deviceId'> = {
  backendBaseUrl: '',
  deviceToken: '',
  storeId: '',
  segmentSeconds: 300,
  streamProfile: 'sub',
  spoolLimitBytes: 5 * 1024 ** 3,
  includeAudio: false,
  autoStart: true,
  selectedCamera: null,
}
```

- [ ] **Step 3: 타입 컴파일 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add -A && git commit -m "feat: 프로젝트 스캐폴딩과 공유 타입"
```

---

### Task 2: 지수 백오프 (순수 함수)

**Files:**
- Create: `src/main/lib/backoff.ts`
- Test: `tests/unit/backoff.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `nextDelayMs(attempt: number, opts?: BackoffOptions): number`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { nextDelayMs } from '../../src/main/lib/backoff'

describe('nextDelayMs', () => {
  it('0회차는 baseMs를 반환한다', () => {
    expect(nextDelayMs(0, { baseMs: 1000, maxMs: 300_000, jitter: false })).toBe(1000)
  })
  it('회차마다 2배로 늘어난다', () => {
    const o = { baseMs: 1000, maxMs: 300_000, jitter: false }
    expect(nextDelayMs(1, o)).toBe(2000)
    expect(nextDelayMs(2, o)).toBe(4000)
    expect(nextDelayMs(3, o)).toBe(8000)
  })
  it('maxMs를 넘지 않는다', () => {
    expect(nextDelayMs(99, { baseMs: 1000, maxMs: 30_000, jitter: false })).toBe(30_000)
  })
  it('지터를 켜면 [delay*0.5, delay] 범위에 든다', () => {
    const results = Array.from({ length: 50 }, () =>
      nextDelayMs(3, { baseMs: 1000, maxMs: 300_000, jitter: true }))
    expect(results.every((d) => d >= 4000 && d <= 8000)).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/backoff.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// src/main/lib/backoff.ts
export interface BackoffOptions {
  readonly baseMs: number
  readonly maxMs: number
  readonly jitter: boolean
}

const DEFAULTS: BackoffOptions = { baseMs: 1000, maxMs: 300_000, jitter: true }

export const nextDelayMs = (attempt: number, opts: Partial<BackoffOptions> = {}): number => {
  const { baseMs, maxMs, jitter } = { ...DEFAULTS, ...opts }
  const raw = Math.min(baseMs * 2 ** Math.max(0, attempt), maxMs)
  return jitter ? Math.round(raw / 2 + Math.random() * (raw / 2)) : raw
}
```

지터를 넣는 이유: 여러 매장이 동시에 네트워크 복구를 감지하면 백엔드에 재시도가 한꺼번에 몰린다.

- [ ] **Step 4: 통과 확인 후 커밋**

```bash
npx vitest run tests/unit/backoff.test.ts
git add -A && git commit -m "feat: 지수 백오프 유틸"
```

---

### Task 3: ffmpeg 조각 생성 인자 (순수 함수)

**Files:**
- Create: `src/main/lib/segment-args.ts`
- Test: `tests/unit/segment-args.test.ts`

**Interfaces:**
- Consumes: `AgentConfig`
- Produces: `buildSegmentArgs(input: SegmentArgsInput): string[]`, `SEGMENT_FILE_PATTERN`, `MANIFEST_NAME`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect } from 'vitest'
import { buildSegmentArgs } from '../../src/main/lib/segment-args'

const base = {
  rtspUri: 'rtsp://cam/live',
  spoolDir: '/tmp/spool',
  segmentSeconds: 300,
  includeAudio: false,
}

describe('buildSegmentArgs', () => {
  it('RTSP를 TCP로 강제한다', () => {
    const a = buildSegmentArgs(base)
    expect(a.join(' ')).toContain('-rtsp_transport tcp')
  })
  it('재인코딩하지 않는다', () => {
    expect(buildSegmentArgs(base)).toContain('copy')
    expect(buildSegmentArgs(base).join(' ')).not.toContain('libx264')
  })
  it('segment 머서와 조각 길이를 지정한다', () => {
    const a = buildSegmentArgs(base).join(' ')
    expect(a).toContain('-f segment')
    expect(a).toContain('-segment_time 300')
  })
  it('manifest를 반드시 지정한다', () => {
    expect(buildSegmentArgs(base).join(' ')).toContain('-segment_list /tmp/spool/manifest.txt')
  })
  it('오디오를 끄면 -an이 들어간다', () => {
    expect(buildSegmentArgs(base)).toContain('-an')
  })
  it('오디오를 켜면 -an이 없고 오디오도 copy한다', () => {
    const a = buildSegmentArgs({ ...base, includeAudio: true })
    expect(a).not.toContain('-an')
    expect(a.join(' ')).toContain('-c:a copy')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/unit/segment-args.test.ts` → FAIL

- [ ] **Step 3: 구현**

```ts
// src/main/lib/segment-args.ts
import { join } from 'node:path'

export const MANIFEST_NAME = 'manifest.txt'
export const SEGMENT_FILE_PATTERN = 'seg_%Y%m%d_%H%M%S.mp4'

export interface SegmentArgsInput {
  readonly rtspUri: string
  readonly spoolDir: string
  readonly segmentSeconds: number
  readonly includeAudio: boolean
}

export const buildSegmentArgs = (i: SegmentArgsInput): string[] => [
  '-hide_banner', '-loglevel', 'warning', '-nostdin',
  '-rtsp_transport', 'tcp',
  '-i', i.rtspUri,
  ...(i.includeAudio ? ['-c:a', 'copy'] : ['-an']),
  '-c:v', 'copy',
  '-f', 'segment',
  '-segment_time', String(i.segmentSeconds),
  '-segment_format', 'mp4',
  '-reset_timestamps', '1',
  '-strftime', '1',
  '-segment_list', join(i.spoolDir, MANIFEST_NAME),
  '-segment_list_type', 'flat',
  '-segment_list_flags', '+live',
  join(i.spoolDir, SEGMENT_FILE_PATTERN),
]
```

`-segment_list_flags +live`가 중요하다. 이게 없으면 manifest가 버퍼링되어 조각 완성 신호가 늦게 온다.

- [ ] **Step 4: 통과 확인 후 커밋**

---

### Task 4: ConfigStore

**Files:**
- Create: `src/main/services/config-store.ts`
- Test: `tests/unit/config-store.test.ts`

**Interfaces:**
- Consumes: `AgentConfig`, `DEFAULT_CONFIG`
- Produces:
  - `createConfigStore(filePath: string): ConfigStore`
  - `ConfigStore = { read(): AgentConfig; write(patch: Partial<AgentConfig>): AgentConfig; nextSequence(cameraId: string): number }`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createConfigStore } from '../../src/main/services/config-store'

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'cfg-'))
  file = join(dir, 'config.json')
})

describe('ConfigStore', () => {
  it('처음 읽으면 기본값이 나오고 deviceId가 자동 생성된다', () => {
    const c = createConfigStore(file).read()
    expect(c.segmentSeconds).toBe(300)
    expect(c.streamProfile).toBe('sub')
    expect(c.deviceId).toMatch(/^agent-[a-z0-9]{8,}$/)
  })
  it('deviceId는 재시작해도 유지된다', () => {
    const first = createConfigStore(file).read().deviceId
    expect(createConfigStore(file).read().deviceId).toBe(first)
  })
  it('부분 수정이 병합되고 영속된다', () => {
    createConfigStore(file).write({ storeId: 'store-1' })
    const c = createConfigStore(file).read()
    expect(c.storeId).toBe('store-1')
    expect(c.segmentSeconds).toBe(300)
  })
  it('sequence는 카메라마다 독립적으로 0부터 증가한다', () => {
    const s = createConfigStore(file)
    expect(s.nextSequence('cam-a')).toBe(0)
    expect(s.nextSequence('cam-a')).toBe(1)
    expect(s.nextSequence('cam-b')).toBe(0)
    expect(s.nextSequence('cam-a')).toBe(2)
  })
  it('sequence는 재시작 후에도 이어진다', () => {
    createConfigStore(file).nextSequence('cam-a')
    createConfigStore(file).nextSequence('cam-a')
    expect(createConfigStore(file).nextSequence('cam-a')).toBe(2)
  })
  it('깨진 JSON이면 기본값으로 복구한다', () => {
    require('node:fs').writeFileSync(file, '{ broken')
    expect(createConfigStore(file).read().segmentSeconds).toBe(300)
  })
})
```

마지막 테스트가 중요하다. 전원이 갑자기 나가면 설정 파일이 반쯤 쓰인 채로 남을 수 있고, 그때 앱이 아예 안 뜨면 무인매장에서는 복구할 사람이 없다.

- [ ] **Step 2: 실패 확인 → Step 3: 구현 → Step 4: 통과 확인 → Step 5: 커밋**

구현 요점: 원자적 쓰기(임시 파일 → `rename`), 읽기 실패 시 기본값 복귀, `sequences: Record<string, number>`를 설정 파일 안에 함께 보관.

---

### Task 5: SpoolStore

**Files:**
- Create: `src/main/services/spool-store.ts`
- Test: `tests/unit/spool-store.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces:
  - `createSpoolStore(dir: string, limitBytes: number): SpoolStore`
  - `SpoolStore = { list(): Promise<SpoolEntry[]>; oldest(): Promise<SpoolEntry | null>; remove(path): Promise<void>; totalBytes(): Promise<number>; enforceLimit(): Promise<number> }`
  - `SpoolEntry = { path: string; name: string; sizeBytes: number; startedAt: Date }`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe('SpoolStore', () => {
  it('manifest.txt와 미완성 파일은 목록에서 제외한다', async () => { /* seg_*.mp4만 반환 */ })
  it('파일명의 시각으로 오래된 순 정렬한다', async () => { /* seg_20260907_143000.mp4 파싱 */ })
  it('상한을 넘으면 오래된 것부터 지운다', async () => { /* enforceLimit()이 삭제 개수 반환 */ })
  it('상한 이하이면 아무것도 지우지 않는다', async () => {})
})
```

- [ ] **Step 2~5:** 실패 확인 → 구현 → 통과 확인 → 커밋

구현 요점: 파일명 `seg_%Y%m%d_%H%M%S.mp4`에서 시각을 파싱해 정렬 키로 쓴다. `manifest.txt`는 반드시 제외한다.

---

### Task 6: SegmentRecorder

**Files:**
- Create: `src/main/services/segment-recorder.ts`
- Create: `src/main/lib/ffmpeg.ts`
- Test: `tests/unit/segment-recorder.test.ts`

**Interfaces:**
- Consumes: `buildSegmentArgs`, `MANIFEST_NAME`
- Produces:
  - `createSegmentRecorder(opts): SegmentRecorder`
  - 이벤트: `'segment'` → `{ path, name }`, `'exit'` → `{ code }`, `'error'` → `Error`
  - `SegmentRecorder = { start(): void; stop(): Promise<void>; isRunning(): boolean }`
  - `resolveFfmpegPath(): string` (asar 언팩 경로 보정 포함)

- [ ] **Step 1: 실패하는 테스트 작성 (manifest 감시 로직만 격리 테스트)**

```ts
// ffmpeg를 띄우지 않고, manifest 파일에 줄을 직접 추가해 이벤트를 검증한다
describe('watchManifest', () => {
  it('새 줄이 추가되면 segment 이벤트를 낸다', async () => {})
  it('이미 있던 줄은 다시 내보내지 않는다', async () => {})
  it('한 번에 여러 줄이 추가되어도 각각 낸다', async () => {})
})
```

- [ ] **Step 2~5:** 실패 확인 → 구현 → 통과 확인 → 커밋

구현 요점: manifest를 `fs.watch` + 오프셋 추적으로 tail 한다(전체 재읽기 금지). `spawn` 시 `stdio: ['ignore','ignore','pipe']`로 stderr만 수집해 진단에 쓴다. `stop()`은 `SIGTERM` → 3초 후 `SIGKILL`.

---

### Task 7: Uploader

**Files:**
- Create: `src/main/services/uploader.ts`
- Test: `tests/unit/uploader.test.ts` (로컬 http 서버 사용)

**Interfaces:**
- Consumes: `SegmentMeta`, `nextDelayMs`
- Produces:
  - `uploadSegment(args: { baseUrl, token, meta, filePath, fetchImpl? }): Promise<UploadResult>`
  - `type UploadResult = { kind: 'ok' } | { kind: 'duplicate' } | { kind: 'retry', reason } | { kind: 'fatal', reason }`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe('uploadSegment', () => {
  it('multipart로 meta와 video 파트를 보낸다', async () => {})
  it('Idempotency-Key 헤더에 segmentId를 넣는다', async () => {})
  it('Authorization: Bearer 토큰을 보낸다', async () => {})
  it('201이면 ok', async () => {})
  it('409면 duplicate (성공 취급)', async () => {})
  it('401이면 fatal', async () => {})
  it('413이면 fatal', async () => {})
  it('500이면 retry', async () => {})
  it('네트워크 오류면 retry', async () => {})
})
```

- [ ] **Step 2~5:** 실패 확인 → 구현 → 통과 확인 → 커밋

구현 요점: Node 22 내장 `fetch` + `FormData` + `Blob`(파일은 스트리밍을 위해 `openAsBlob` 사용). 응답 코드 → `UploadResult` 매핑을 한 곳에 모아 테스트 가능하게 한다.

---

### Task 8: Discovery + CameraProbe

**Files:**
- Create: `src/main/services/discovery.ts`, `src/main/services/camera-probe.ts`
- Test: `tests/unit/camera-probe.test.ts`

**Interfaces:**
- Consumes: `DiscoveredCamera`, `StreamProfile`, `ProbedCamera`
- Produces:
  - `discoverCameras(timeoutMs?): Promise<DiscoveredCamera[]>`
  - `probeCamera(args: { xaddr, username, password }): Promise<ProbedCamera>`
  - `classifyProfiles(raw: RawProfile[]): StreamProfile[]` (순수 함수 — 테스트 대상)
  - `manualCamera(rtspUri: string, name: string): SelectedCamera`

- [ ] **Step 1: 실패하는 테스트 작성 (`classifyProfiles` 순수 함수 중심)**

```ts
describe('classifyProfiles', () => {
  it('해상도가 가장 큰 것을 main, 가장 작은 것을 sub로 분류한다', () => {})
  it('프로필이 하나뿐이면 main으로 분류한다', () => {})
  it('H265를 h265로 정규화한다', () => {})
})
```

- [ ] **Step 2~5:** 실패 확인 → 구현 → 통과 확인 → 커밋

구현 요점: `onvif` 패키지는 콜백 기반 CommonJS이므로 `promisify`로 감싸고, 우리 인터페이스 뒤에 숨긴다. 인증 실패는 별도 에러 타입(`OnvifAuthError`)으로 구분해 UI가 제조사별 안내를 띄울 수 있게 한다. **ONVIF 검색에 안 잡히는 카메라를 위한 `manualCamera()` 경로는 필수다.**

---

### Task 9: SnapshotService

**Files:**
- Create: `src/main/services/snapshot.ts`
- Test: `tests/unit/snapshot.test.ts`

**Interfaces:**
- Produces: `captureSnapshot(rtspUri: string, outPath: string, timeoutMs?): Promise<string>`

- [ ] **Step 1~5:** 인자 조립 단위 테스트 → 구현 → 커밋

구현 요점: `-frames:v 1 -f image2 -y`. 타임아웃 시 프로세스를 죽이고 에러를 던진다.

---

### Task 10: Supervisor (조립 + 상태 머신)

**Files:**
- Create: `src/main/services/supervisor.ts`
- Test: `tests/unit/supervisor.test.ts` (모든 의존성을 페이크로 주입)

**Interfaces:**
- Consumes: 위 모든 서비스
- Produces:
  - `createSupervisor(deps: SupervisorDeps): Supervisor`
  - `Supervisor = { start(cam: SelectedCamera): Promise<void>; stop(): Promise<void>; status(): AgentStatus; on('status', cb): void }`

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
describe('Supervisor', () => {
  it('조각 이벤트가 오면 meta를 만들어 업로드를 요청한다', async () => {})
  it('업로드 ok면 파일을 지우고 uploadedCount를 올린다', async () => {})
  it('업로드 duplicate도 파일을 지운다', async () => {})
  it('업로드 retry면 파일을 남기고 백오프 후 재시도한다', async () => {})
  it('업로드 fatal(401)이면 재시도를 멈추고 상태를 auth-failed로 바꾼다', async () => {})
  it('recorder가 죽으면 백오프 후 재시작한다', async () => {})
  it('조각 주기의 1.5배 동안 조각이 없으면 강제 재시작한다', async () => {})
  it('sequence는 조각 생성 순서대로 부여된다', async () => {})
})
```

- [ ] **Step 2~5:** 실패 확인 → 구현 → 통과 확인 → 커밋

구현 요점: 의존성 주입으로 ffmpeg·네트워크 없이 전부 테스트한다. 무진행 타이머는 조각 이벤트마다 리셋한다.

---

### Task 11: Electron 셸 (main + preload + IPC)

**Files:**
- Create: `src/main/index.ts`, `src/main/ipc.ts`, `src/preload/index.ts`
- Modify: `electron.vite.config.ts`

**Interfaces:**
- Produces: `window.api` — `discover()`, `probe()`, `snapshot()`, `start()`, `stop()`, `getConfig()`, `setConfig()`, `onStatus(cb)`

- [ ] **Step 1~4:** IPC 채널 정의 → 구현 → `npm run dev`로 창이 뜨는지 확인 → 커밋

구현 요점: `contextIsolation: true`, `nodeIntegration: false`. 창 닫기는 트레이로 최소화(`close` 이벤트 `preventDefault`), 트레이 메뉴에서만 진짜 종료하며 "감시가 중단됩니다" 확인을 띄운다. `app.setLoginItemSettings`로 자동 시작.

---

### Task 12: React UI 3화면

**Files:**
- Create: `src/renderer/index.html`, `main.tsx`, `App.tsx`, `lib/cn.ts`, `lib/mock-api.ts`
- Create: `src/renderer/screens/CameraSelect.tsx`, `CameraSetup.tsx`, `Dashboard.tsx`

- [ ] **Step 1~4:** 화면 구현 → 브라우저에서 목 API로 렌더 확인 → 커밋

구현 요점: **`window.api`가 없으면 `mock-api.ts`가 대신 붙는다.** 그래야 Electron 없이 브라우저에서 UI를 개발·확인할 수 있다. React 19 함수형, `forwardRef` 금지, 불변 갱신, Tailwind 축약 클래스명 + `cn()`.

---

### Task 13: 가짜 카메라 (테스트 도구)

**Files:**
- Create: `tools/fake-camera/index.ts`, `tools/fake-camera/onvif-responder.ts`, `tools/fake-camera/rtsp-server.ts`

**Interfaces:**
- Produces: `startFakeCamera(opts): Promise<FakeCamera>` — RTSP URL과 종료 함수를 반환

- [ ] **Step 1~4:** 테스트 영상 생성 → RTSP 서버 → WS-Discovery 응답기 → 커밋

구현 요점: ffmpeg의 `-rtsp_flags listen`으로 RTSP 서버 역할을 시킨다(외부 바이너리 불필요). 테스트 영상은 `-f lavfi -i testsrc`로 생성하되 **GOP를 조각 길이에 맞춰야** 조각이 제때 잘린다. WS-Discovery 응답기는 UDP `239.255.255.250:3702` 구독 후 `ProbeMatches`를 회신한다.

---

### Task 14: E2E 통합 테스트

**Files:**
- Create: `tests/e2e/pipeline.test.ts`, `tests/helpers/test-receiver.ts`

- [ ] **Step 1: E2E 테스트 작성**

```ts
describe('가짜 카메라 → 조각 → 업로드 전체 경로', () => {
  it('조각을 만들어 업로드하고 스풀을 비운다', async () => {
    // 2초 조각으로 설정해 테스트를 빠르게 유지
  })
  it('수신 서버가 죽으면 스풀에 쌓이고, 살아나면 전송한다', async () => {})
  it('업로드된 mp4가 키프레임으로 시작하고 재생 가능하다 (ffprobe 검증)', async () => {})
  it('같은 segmentId를 두 번 보내도 수신 서버는 한 번만 반영한다', async () => {})
})
```

- [ ] **Step 2~4:** 실행 → 통과 확인 → 커밋

이것이 이 프로젝트의 핵심 검증이다. 이 테스트가 통과하면 실제 CCTV로 교체했을 때도 같은 경로가 동작한다.

---

## Self-Review

**1. Spec coverage**

| 스펙 절 | 구현 태스크 |
|---|---|
| 5.1 DiscoveryService | Task 8 |
| 5.2 CameraProbe | Task 8 |
| 5.3 SnapshotService | Task 9 |
| 5.4 SegmentRecorder | Task 3(인자) + Task 6(프로세스) |
| 5.5 SpoolStore | Task 5 |
| 5.6 Uploader | Task 7 |
| 5.7 Supervisor | Task 10 |
| 6 백엔드 API 규격 | Task 7 + Task 14(E2E 검증) |
| 7 장애 처리 | Task 10 (상태 머신) + Task 14 (오프라인 시나리오) |
| 8 설정 | Task 4 |
| 9 화면 | Task 12 |
| 10 기술 스택 | Task 1 |
| 11 테스트 전략 | Task 13, 14 |
| PC 종료 위험 (트레이/자동시작) | Task 11 |

빠진 것 없음.

**2. Placeholder scan:** "TBD"·"적절한 에러 처리"류 없음. Task 4·5·6·8·9의 Step 2~5는 구현 요점을 명시한 축약 형태이며, 각 테스트 케이스 이름이 구현해야 할 동작을 완전히 특정한다.

**3. Type consistency:** `SelectedCamera`, `SegmentMeta`, `AgentStatus`, `AgentConfig`는 Task 1에서 한 번만 정의하고 이후 태스크는 import만 한다. `UploadResult`의 네 갈래(`ok`/`duplicate`/`retry`/`fatal`)는 Task 7에서 정의하고 Task 10의 테스트가 같은 이름을 쓴다.
