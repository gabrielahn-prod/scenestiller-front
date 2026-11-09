import { AGENT_VERSION, type SegmentMeta } from '../../src/shared/types'

export const makeMeta = (overrides: Partial<SegmentMeta> = {}): SegmentMeta => ({
  segmentId: '01K5ZQ8G3M7X2N4P6R8T0V2W4Y',
  storeId: 'store-gangnam-01',
  deviceId: 'agent-7f3k9m2p',
  camera: {
    id: 'cam-01',
    name: '계산대',
    manufacturer: 'Hikvision',
    model: 'DS-2CD2143G2',
    streamProfile: 'sub',
  },
  video: {
    codec: 'h264',
    width: 704,
    height: 480,
    fps: 15,
    durationMs: 300_133,
    sizeBytes: 1024,
    container: 'mp4',
  },
  startedAt: '2026-09-07T14:30:00.000Z',
  endedAt: '2026-09-07T14:35:00.133Z',
  sequence: 1284,
  agentVersion: AGENT_VERSION,
  ...overrides,
})
