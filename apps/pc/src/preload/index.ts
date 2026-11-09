import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type AgentApi, type StreamConnectionState } from '../shared/ipc'
import type { ServerStreamMessage } from '../shared/server-types'
import type { AgentStatus } from '../shared/types'

/** 메인 → 렌더러 이벤트 구독. 해제 함수를 돌려준다. */
const subscribe = <T>(channel: string, listener: (payload: T) => void): (() => void) => {
  const handler = (_event: unknown, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

/**
 * 렌더러에 노출하는 유일한 통로.
 * contextIsolation 이 켜져 있어 렌더러는 Node 에 직접 닿지 못한다.
 */
const api: AgentApi = {
  discover: (timeoutMs) => ipcRenderer.invoke(IPC.discover, timeoutMs),
  probe: (args) => ipcRenderer.invoke(IPC.probe, args),
  probeRtsp: (rtspUri) => ipcRenderer.invoke(IPC.probeRtsp, rtspUri),
  snapshot: (rtspUri) => ipcRenderer.invoke(IPC.snapshot, rtspUri),
  previewStart: (rtspUri, options) => ipcRenderer.invoke(IPC.previewStart, rtspUri, options),
  previewStop: (key) => ipcRenderer.invoke(IPC.previewStop, key),
  start: (cameras) => ipcRenderer.invoke(IPC.start, cameras),
  stop: () => ipcRenderer.invoke(IPC.stop),
  getConfig: () => ipcRenderer.invoke(IPC.getConfig),
  setConfig: (patch) => ipcRenderer.invoke(IPC.setConfig, patch),
  getStatus: () => ipcRenderer.invoke(IPC.getStatus),
  openSpoolFolder: () => ipcRenderer.invoke(IPC.openSpoolFolder),
  onStatus: (listener) => subscribe<AgentStatus>(IPC.statusChanged, listener),

  authSendOtp: (phone) => ipcRenderer.invoke(IPC.authSendOtp, phone),
  authVerifyOtp: (phone, code) => ipcRenderer.invoke(IPC.authVerifyOtp, phone, code),
  authSignOut: () => ipcRenderer.invoke(IPC.authSignOut),
  authGetSession: () => ipcRenderer.invoke(IPC.authGetSession),

  serverRequest: (request) => ipcRenderer.invoke(IPC.serverRequest, request),
  serverStreamStart: (storeId) => ipcRenderer.invoke(IPC.serverStreamStart, storeId),
  serverStreamStop: () => ipcRenderer.invoke(IPC.serverStreamStop),
  onServerStream: (listener) => subscribe<ServerStreamMessage>(IPC.serverStreamMessage, listener),
  onServerStreamState: (listener) => subscribe<StreamConnectionState>(IPC.serverStreamState, listener),

  attention: (on) => ipcRenderer.invoke(IPC.attention, on),
  openExternal: (url) => ipcRenderer.invoke(IPC.openExternal, url),
  copyText: (text) => ipcRenderer.invoke(IPC.copyText, text),
}

contextBridge.exposeInMainWorld('api', api)
