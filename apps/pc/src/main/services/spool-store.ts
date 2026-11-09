import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface SpoolEntry {
  readonly path: string
  readonly name: string
  readonly sizeBytes: number
  /** 조각이 닫힌 시각. 파일명에 새겨져 있다. 시작 시각은 여기서 길이를 빼서 구한다. */
  readonly closedAt: Date
}

export interface SpoolStore {
  /** 오래된 순으로 정렬된 완성 조각 목록. 쓰는 중인 조각은 parts/ 에 있어 여기 안 잡힌다. */
  list(): Promise<SpoolEntry[]>
  oldest(): Promise<SpoolEntry | null>
  remove(path: string): Promise<void>
  totalBytes(): Promise<number>
  /** 상한을 넘으면 오래된 것부터 지우고 삭제한 개수를 반환한다. */
  enforceLimit(): Promise<number>
}

const SEGMENT_NAME = /^seg_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})_(\d{3})\.mp4$/

const pad = (value: number, width: number): string => String(value).padStart(width, '0')

/** 완성된 조각의 파일명. 닫힌 시각을 로컬 시각으로 새긴다 (밀리초까지 — 충돌 방지). */
export const formatSegmentName = (closedAt: Date): string =>
  `seg_${closedAt.getFullYear()}${pad(closedAt.getMonth() + 1, 2)}${pad(closedAt.getDate(), 2)}` +
  `_${pad(closedAt.getHours(), 2)}${pad(closedAt.getMinutes(), 2)}${pad(closedAt.getSeconds(), 2)}` +
  `_${pad(closedAt.getMilliseconds(), 3)}.mp4`

export const parseSegmentClosedAt = (name: string): Date | null => {
  const matched = SEGMENT_NAME.exec(name)
  if (!matched) return null
  const [year, month, day, hour, minute, second, ms] = matched.slice(1).map(Number) as number[]
  return new Date(year!, month! - 1, day!, hour!, minute!, second!, ms!)
}

export const createSpoolStore = (dir: string, limitBytes: number): SpoolStore => {
  const list = async (): Promise<SpoolEntry[]> => {
    // 스풀 디렉토리가 없거나 도중에 사라져도 목록 조회는 실패하지 않아야 한다.
    await mkdir(dir, { recursive: true }).catch(() => undefined)
    const names = await readdir(dir).catch(() => [] as string[])
    const entries = await Promise.all(
      names.map(async (name) => {
        const closedAt = parseSegmentClosedAt(name)
        if (!closedAt) return null
        const path = join(dir, name)
        const stats = await stat(path).catch(() => null)
        return stats?.isFile() ? { path, name, sizeBytes: stats.size, closedAt } : null
      }),
    )
    return entries
      .filter((entry): entry is SpoolEntry => entry !== null)
      .sort((a, b) => a.closedAt.getTime() - b.closedAt.getTime())
  }

  const remove = async (path: string): Promise<void> => {
    await rm(path, { force: true })
  }

  const totalBytes = async (): Promise<number> =>
    (await list()).reduce((sum, entry) => sum + entry.sizeBytes, 0)

  return {
    list,
    remove,
    totalBytes,

    oldest: async () => (await list())[0] ?? null,

    enforceLimit: async () => {
      const entries = await list()
      const total = entries.reduce((sum, entry) => sum + entry.sizeBytes, 0)
      if (total <= limitBytes) return 0

      // 오래된 것부터 상한 아래로 내려갈 때까지 버린다.
      const { evicted } = await entries.reduce(
        async (pending, entry) => {
          const state = await pending
          if (state.bytes <= limitBytes) return state
          await remove(entry.path)
          return { bytes: state.bytes - entry.sizeBytes, evicted: state.evicted + 1 }
        },
        Promise.resolve({ bytes: total, evicted: 0 }),
      )
      return evicted
    },
  }
}
