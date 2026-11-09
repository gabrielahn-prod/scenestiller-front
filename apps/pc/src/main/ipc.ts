import { randomBytes } from 'node:crypto'
import { readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { clipboard, ipcMain, shell, type BrowserWindow } from 'electron'
import {
  IPC,
  type AuthResult,
  type DiscoverResult,
  type PreviewOptions,
  type PreviewResult,
  type ProbeArgs,
  type ProbeResult,
  type ServerRequest,
  type ServerResult,
  type SessionSummary,
  type SnapshotResult,
} from '../shared/ipc'
import type { AgentConfig, AgentStatus, SelectedCamera } from '../shared/types'
import { resolveFfmpegPath } from './lib/ffmpeg'
import type { Agent } from './services/agent'
import { classifyProfiles, isAuthFailure, probeCamera } from './services/camera-probe'
import { discoverCameras } from './services/discovery'
import { probeMedia } from './services/media-probe'
import { createPreviewService } from './services/preview-stream'
import { createServerClient } from './services/server-client'
import { createServerSession, SessionError } from './services/server-session'
import { createServerStream } from './services/server-stream'
import { captureSnapshot } from './services/snapshot'
import { createSafeTokenStore } from './services/token-store'

const toProbeFailure = (error: unknown): ProbeResult => {
  if (isAuthFailure(error)) {
    return {
      ok: false,
      kind: 'auth',
      message:
        '카메라 인증에 실패했습니다. 일부 제조사(하이크비전 등)는 관리자 계정과 별개로 ' +
        'ONVIF 전용 계정을 만들어야 합니다. 카메라 웹설정 → 네트워크 → 고급 → ONVIF 에서 ' +
        '계정을 추가한 뒤 그 계정으로 시도해 보세요.',
    }
  }
  return {
    ok: false,
    kind: 'unreachable',
    message: `카메라에 연결하지 못했습니다: ${error instanceof Error ? error.message : String(error)}`,
  }
}

export interface IpcPaths {
  readonly spoolRoot: string
  /** 사장님 로그인 토큰. OS 키체인으로 암호화해서 쓴다 (token-store.ts). */
  readonly sessionFile: string
}

export interface IpcHandles {
  /** 앱 종료 때 열린 스트림·미리보기를 닫는다. */
  dispose(): Promise<void>
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error))

export const registerIpc = (
  agent: Agent,
  getWindow: () => BrowserWindow | null,
  paths: IpcPaths,
): IpcHandles => {
  const preview = createPreviewService({ ffmpegPath: resolveFfmpegPath() })

  const send = (channel: string, payload: unknown): void => {
    const window = getWindow()
    if (window && !window.isDestroyed()) window.webContents.send(channel, payload)
  }

  const session = createServerSession({
    getConfig: () => agent.config.read(),
    fetch,
    store: createSafeTokenStore(paths.sessionFile),
  })
  const server = createServerClient({ getBaseUrl: () => agent.config.read().backendBaseUrl, session, fetch })
  const stream = createServerStream({
    getBaseUrl: () => agent.config.read().backendBaseUrl,
    session,
    fetch,
    onMessage: (message) => send(IPC.serverStreamMessage, message),
    onState: (state) => send(IPC.serverStreamState, state),
  })

  const toSummary = (): SessionSummary => {
    const current = session.summary()
    return current ? { signedIn: true, ...current } : { signedIn: false }
  }

  ipcMain.handle(IPC.previewStart, async (_event, rtspUri: string, options?: PreviewOptions): Promise<PreviewResult> => {
    try {
      return { ok: true, url: await preview.start(rtspUri, options) }
    } catch (error) {
      return { ok: false, message: errorMessage(error) }
    }
  })

  ipcMain.handle(IPC.previewStop, (_event, key?: string) => preview.stop(key))

  /* ---------------------------------------------------------- 사장님 로그인 */

  ipcMain.handle(IPC.authSendOtp, async (_event, phone: string): Promise<AuthResult<null>> => {
    try {
      await session.sendOtp(phone)
      return { ok: true, value: null }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof SessionError ? error.message : '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.',
      }
    }
  })

  ipcMain.handle(
    IPC.authVerifyOtp,
    async (_event, phone: string, code: string): Promise<AuthResult<SessionSummary>> => {
      try {
        await session.verifyOtp(phone, code)
        return { ok: true, value: toSummary() }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof SessionError ? error.message : '서버에 연결할 수 없습니다. 인터넷 연결을 확인해 주세요.',
        }
      }
    },
  )

  ipcMain.handle(IPC.authSignOut, async () => {
    // 로그아웃해도 감시(조각 업로드)는 멈추지 않는다 — 그건 기기 토큰으로 돈다.
    // 화면만 닫힌다. 무인매장에서 누가 로그아웃을 눌러도 감시가 꺼지면 안 된다.
    stream.stop()
    await session.signOut()
  })

  ipcMain.handle(IPC.authGetSession, (): SessionSummary => toSummary())

  /* ------------------------------------------------------------ 백엔드 호출 */

  ipcMain.handle(IPC.serverRequest, (_event, request: ServerRequest): Promise<ServerResult> => server.request(request))
  ipcMain.handle(IPC.serverStreamStart, (_event, storeId: string) => stream.start(storeId))
  ipcMain.handle(IPC.serverStreamStop, () => stream.stop())

  /* ------------------------------------------------------------ 2d 위험 팝업 */

  ipcMain.handle(IPC.attention, (_event, on: boolean) => {
    const window = getWindow()
    if (!window || window.isDestroyed()) return
    if (on) {
      // 사장님이 다른 프로그램을 보고 있어도 위험 팝업은 앞에 떠야 한다.
      // 'screen-saver' 레벨이어야 전체화면 앱 위로도 올라온다.
      window.setAlwaysOnTop(true, 'screen-saver')
      window.show()
      window.focus()
      window.flashFrame(true)
      return
    }
    window.setAlwaysOnTop(false)
    window.flashFrame(false)
  })

  ipcMain.handle(IPC.openExternal, async (_event, url: string): Promise<boolean> => {
    // 렌더러가 file:, javascript:, 로컬 실행 파일 경로를 넘기지 못하게 한다.
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
      await shell.openExternal(parsed.toString())
      return true
    } catch {
      return false
    }
  })

  ipcMain.handle(IPC.copyText, (_event, text: string) => {
    clipboard.writeText(String(text))
  })

  ipcMain.handle(IPC.discover, async (_event, timeoutMs?: number): Promise<DiscoverResult> => {
    try {
      return { ok: true, cameras: await discoverCameras(timeoutMs ?? 5000) }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(IPC.probe, async (_event, args: ProbeArgs): Promise<ProbeResult> => {
    try {
      const probed = await probeCamera({
        camera: {
          id: args.xaddr,
          xaddr: args.xaddr,
          ip: new URL(args.xaddr).hostname,
          port: Number(new URL(args.xaddr).port || 80),
          manufacturer: null,
          model: null,
          name: null,
        },
        username: args.username,
        password: args.password,
      })
      return { ok: true, profiles: probed.profiles }
    } catch (error) {
      return toProbeFailure(error)
    }
  })

  ipcMain.handle(IPC.probeRtsp, async (_event, rtspUri: string): Promise<ProbeResult> => {
    const probed = await probeMedia(rtspUri, { timeoutMs: 20_000 })
    if (!probed) {
      return {
        ok: false,
        kind: 'unreachable',
        message: '이 주소에서 영상을 읽지 못했습니다. 주소·아이디·비밀번호를 확인해 주세요.',
      }
    }
    return {
      ok: true,
      profiles: classifyProfiles([
        {
          token: 'manual',
          name: '직접 입력',
          encoding: probed.codec === 'h265' ? 'H265' : 'H264',
          width: probed.width,
          height: probed.height,
          fps: probed.fps,
          bitrateKbps: null,
          rtspUri,
        },
      ]),
    }
  })

  ipcMain.handle(IPC.snapshot, async (_event, rtspUri: string): Promise<SnapshotResult> => {
    const outPath = join(tmpdir(), `cctv-snap-${randomBytes(4).toString('hex')}.jpg`)
    try {
      await captureSnapshot(rtspUri, outPath, { timeoutMs: 20_000 })
      const buffer = await readFile(outPath)
      return { ok: true, dataUrl: `data:image/jpeg;base64,${buffer.toString('base64')}` }
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '미리보기를 가져오지 못했습니다',
      }
    } finally {
      await rm(outPath, { force: true })
    }
  })

  ipcMain.handle(IPC.start, (_event, cameras: SelectedCamera[]) => agent.fleet.start(cameras))
  ipcMain.handle(IPC.stop, () => agent.fleet.stop())
  ipcMain.handle(IPC.getConfig, (): AgentConfig => agent.config.read())
  ipcMain.handle(IPC.setConfig, (_event, patch: Partial<AgentConfig>): AgentConfig =>
    agent.config.write(patch),
  )
  ipcMain.handle(IPC.getStatus, (): AgentStatus => agent.fleet.status())
  ipcMain.handle(IPC.openSpoolFolder, () => shell.openPath(paths.spoolRoot))

  return {
    dispose: async () => {
      stream.stop()
      await preview.stop()
    },
  }
}
