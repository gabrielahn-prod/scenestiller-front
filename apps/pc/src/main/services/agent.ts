import { setTimeout as sleep } from 'node:timers/promises'
import { ulid } from 'ulid'
import type { AgentStatus } from '../../shared/types'
import { resolveFfmpegPath } from '../lib/ffmpeg'
import { createConfigStore, type BuildDefaults, type ConfigStore } from './config-store'
import { createFleet, type Fleet } from './fleet'
import { probeMedia } from './media-probe'
import { createSegmentRecorder } from './segment-recorder'
import { createSpoolStore } from './spool-store'
import { uploadSegment } from './uploader'

export interface AgentPaths {
  readonly configFile: string
  /** 카메라마다 이 아래에 자기 폴더를 갖는다. */
  readonly spoolRoot: string
}

export interface Agent {
  readonly fleet: Fleet
  readonly config: ConfigStore
}

/** 빌드 때 박힌 서버 주소. vitest 등 define 이 없는 곳에서는 비어 있다. */
const buildDefaults = (): BuildDefaults =>
  typeof __SCENE_STEALER_BUILD_DEFAULTS__ === 'undefined' ? {} : __SCENE_STEALER_BUILD_DEFAULTS__

/**
 * 실제 의존성을 물린 에이전트를 만든다.
 *
 * Fleet 은 모든 협력자를 주입받으므로, 테스트는 이 조립 함수를 건너뛰고
 * 가짜를 넣을 수 있다. 여기 있는 것은 오직 "무엇을 쓸지" 뿐이다.
 */
export const createAgent = (paths: AgentPaths, onStatus: (status: AgentStatus) => void): Agent => {
  const config = createConfigStore(paths.configFile, buildDefaults())
  const ffmpegPath = resolveFfmpegPath()

  const fleet = createFleet({
    config,
    spoolRoot: paths.spoolRoot,
    createRecorder: (args) => createSegmentRecorder({ ffmpegPath, ...args }),
    createSpool: (dir, limitBytes) => createSpoolStore(dir, limitBytes),
    upload: uploadSegment,
    probeMedia: (path) => probeMedia(path),
    newSegmentId: () => ulid(),
    now: () => new Date(),
    delay: (ms) => sleep(ms),
    onStatus,
  })

  return { fleet, config }
}
