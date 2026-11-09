import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { DEFAULT_CONFIG, type AgentConfig, type SelectedCamera } from '../../shared/types'

interface Persisted extends AgentConfig {
  /** 카메라별 조각 일련번호. 재시작 후에도 이어지도록 설정과 함께 보관한다. */
  readonly sequences: Readonly<Record<string, number>>
}

export interface ConfigStore {
  read(): AgentConfig
  write(patch: Partial<AgentConfig>): AgentConfig
  /** (deviceId, cameraId)마다 0부터 증가하는 조각 일련번호를 하나 발급한다. */
  nextSequence(cameraId: string): number
}

const createDeviceId = (): string => `agent-${randomBytes(6).toString('hex')}`

type DefaultKey = keyof typeof DEFAULT_CONFIG
const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG) as DefaultKey[]

/**
 * 1대만 고를 수 있던 시절의 설정을 여러 대 형식으로 옮긴다.
 * 이 함수가 없으면 기존 사용자가 업데이트한 뒤 카메라를 다시 고르게 된다.
 */
const migrateCameras = (source: Record<string, unknown>): readonly SelectedCamera[] => {
  if (Array.isArray(source.cameras)) return source.cameras as SelectedCamera[]
  const legacy = source.selectedCamera
  return legacy && typeof legacy === 'object' ? [legacy as SelectedCamera] : []
}

/**
 * 배포본에 박아 넣는 기본값 (서버 주소 등). 사장님이 '설정 ▸ 고급'을 몰라도
 * 첫 실행에서 바로 로그인할 수 있어야 한다.
 */
export type BuildDefaults = Partial<Pick<AgentConfig, 'backendBaseUrl' | 'supabaseUrl' | 'supabaseAnonKey'>>

const isBlank = (value: unknown): boolean => value === undefined || value === null || value === ''

/** 알 수 없는 필드를 버리고 기본값을 채운 정규 설정을 만든다. */
const normalize = (raw: unknown, buildDefaults: BuildDefaults): Persisted => {
  const source = (raw ?? {}) as Record<string, unknown>
  const defaults: Record<string, unknown> = { ...DEFAULT_CONFIG, ...buildDefaults }
  // 빌드 기본값은 비어 있는 자리만 채운다. 고급 설정에서 바꾼 값은 지킨다.
  const config = CONFIG_KEYS.reduce<Record<string, unknown>>(
    (acc, key) => ({ ...acc, [key]: isBlank(source[key]) ? defaults[key] : source[key] }),
    {},
  )
  const deviceId = typeof source.deviceId === 'string' && source.deviceId.length > 0
    ? source.deviceId
    : createDeviceId()
  const sequences = typeof source.sequences === 'object' && source.sequences !== null
    ? (source.sequences as Record<string, number>)
    : {}
  return { ...config, cameras: migrateCameras(source), deviceId, sequences } as Persisted
}

/**
 * 설정 파일이 반쯤 쓰인 채 남는 상황(정전 등)에도 앱이 뜨는 것을 우선한다.
 * 읽기 실패는 기본값으로 조용히 복구하고, 쓰기는 임시 파일 → rename 으로 원자화한다.
 * 무인매장에는 복구해 줄 사람이 없다.
 */
export const createConfigStore = (filePath: string, buildDefaults: BuildDefaults = {}): ConfigStore => {
  const load = (): Persisted => {
    try {
      return normalize(JSON.parse(readFileSync(filePath, 'utf8')), buildDefaults)
    } catch {
      return normalize(null, buildDefaults)
    }
  }

  const save = (next: Persisted): Persisted => {
    mkdirSync(dirname(filePath), { recursive: true })
    const temp = join(dirname(filePath), `.${randomBytes(4).toString('hex')}.tmp`)
    writeFileSync(temp, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    renameSync(temp, filePath)
    return next
  }

  // 최초 실행이거나 파일이 깨졌으면 지금 정규화해 두어야 deviceId가 고정된다.
  const initial = load()
  save(initial)

  const toConfig = ({ sequences: _ignored, ...config }: Persisted): AgentConfig => config

  return {
    read: () => toConfig(load()),

    write: (patch) => toConfig(save({ ...load(), ...patch })),

    nextSequence: (cameraId) => {
      const current = load()
      const value = current.sequences[cameraId] ?? 0
      save({ ...current, sequences: { ...current.sequences, [cameraId]: value + 1 } })
      return value
    },
  }
}
