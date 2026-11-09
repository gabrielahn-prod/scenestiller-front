import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cameraKey } from '../../src/main/lib/camera-key'
import type { RecorderFactoryArgs } from '../../src/main/services/camera-worker'
import { createConfigStore } from '../../src/main/services/config-store'
import { createFleet, type Fleet } from '../../src/main/services/fleet'
import type { ProbedMedia } from '../../src/main/services/media-probe'
import { createSpoolStore } from '../../src/main/services/spool-store'
import type { UploadArgs, UploadResult } from '../../src/main/services/uploader'
import type { AgentStatus, SegmentMeta, SelectedCamera } from '../../src/shared/types'

export const makeCamera = (id: string, name: string): SelectedCamera => ({
  id,
  name,
  manufacturer: 'FakeCam',
  model: 'SIM-1000',
  rtspUri: `rtsp://admin:pw@127.0.0.1/${id}`,
  streamProfile: 'sub',
  codec: 'h264',
  width: 640,
  height: 480,
  fps: 15,
})

const PROBED: ProbedMedia = {
  codec: 'h264', width: 640, height: 480, fps: 15, durationMs: 5000, sizeBytes: 100,
}

export interface Harness {
  readonly fleet: Fleet
  readonly uploads: SegmentMeta[]
  readonly statuses: AgentStatus[]
  spoolDirOf(cameraId: string): string
  emitSegment(cameraId: string, name: string, bytes?: number): void
  emitFlowing(cameraId: string): void
  emitExit(cameraId: string, stderr?: string): void
  recorderStarts(cameraId: string): number
  setUploadResults(results: UploadResult[]): void
  setProbeResult(result: ProbedMedia | null): void
  cleanup(): void
}

export const makeHarness = (
  options: { spoolLimitBytes?: number; stallTimeoutMs?: number } = {},
): Harness => {
  const dir = mkdtempSync(join(tmpdir(), 'cctv-fleet-'))
  const spoolRoot = join(dir, 'spool')
  const config = createConfigStore(join(dir, 'config.json'))
  config.write({
    backendBaseUrl: 'http://backend.test',
    deviceToken: 'tok',
    storeId: 'store-1',
    segmentSeconds: 5,
    spoolLimitBytes: options.spoolLimitBytes ?? 10 * 1024 * 1024,
  })

  const recorders = new Map<string, { args: RecorderFactoryArgs; starts: number }>()
  const state = {
    uploadResults: [] as UploadResult[],
    probeResult: PROBED as ProbedMedia | null,
    idCounter: 0,
  }
  const uploads: SegmentMeta[] = []
  const statuses: AgentStatus[] = []

  const dirOf = (cameraId: string): string => join(spoolRoot, cameraKey(cameraId))
  const byUri = (cameraId: string) => recorders.get(dirOf(cameraId))

  const fleet = createFleet({
    config,
    spoolRoot,
    createRecorder: (args) => {
      // 실제 SegmentRecorder 는 start() 에서 스풀 폴더를 만든다. 가짜도 같게 맞춘다.
      mkdirSync(args.spoolDir, { recursive: true })
      const existing = recorders.get(args.spoolDir)
      const entry = { args, starts: existing?.starts ?? 0 }
      recorders.set(args.spoolDir, entry)
      return {
        start: () => {
          entry.starts += 1
        },
        stop: async () => {},
        isRunning: () => true,
      }
    },
    createSpool: (d, limit) => createSpoolStore(d, limit),
    upload: async ({ meta }: UploadArgs) => {
      uploads.push(meta)
      return state.uploadResults.shift() ?? { kind: 'ok' }
    },
    probeMedia: async () => state.probeResult,
    newSegmentId: () => `seg-id-${state.idCounter++}`,
    now: () => new Date('2026-09-08T05:30:00.000Z'),
    delay: (ms) => new Promise((resolve) => setTimeout(resolve, Math.min(ms, 5))),
    onStatus: (status) => statuses.push(status),
    idleMs: 5,
    stallTimeoutMs: options.stallTimeoutMs ?? 60_000,
  })

  return {
    fleet,
    uploads,
    statuses,
    spoolDirOf: dirOf,
    emitSegment: (cameraId, name, bytes = 100) => {
      const path = join(dirOf(cameraId), name)
      writeFileSync(path, Buffer.alloc(bytes, 1))
      byUri(cameraId)?.args.onSegment({ name, path })
    },
    emitFlowing: (cameraId) => byUri(cameraId)?.args.onFlowing(),
    emitExit: (cameraId, stderr = 'Connection timed out') =>
      byUri(cameraId)?.args.onExit({ code: 1, stderr }),
    recorderStarts: (cameraId) => byUri(cameraId)?.starts ?? 0,
    setUploadResults: (results) => {
      state.uploadResults = [...results]
    },
    setProbeResult: (result) => {
      state.probeResult = result
    },
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  }
}

export const waitFor = async (
  predicate: () => boolean | Promise<boolean>,
  { timeoutMs = 15_000, stepMs = 5 } = {},
): Promise<void> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, stepMs))
  }
  throw new Error('조건이 시간 안에 만족되지 않았습니다')
}
