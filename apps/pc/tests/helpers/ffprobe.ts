import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { resolveFfprobePath } from '../../src/main/services/media-probe'

const execFileAsync = promisify(execFile)

/**
 * 파일의 첫 프레임이 키프레임인지 확인한다.
 *
 * 이것이 조각 유효성의 핵심 판정이다. H.264/H.265 조각이 키프레임으로 시작하지
 * 않으면 그 조각만 따로 디코딩할 수 없어 AI 서버가 읽지 못한다.
 */
export const startsWithKeyframe = async (filePath: string): Promise<boolean> => {
  const { stdout } = await execFileAsync(resolveFfprobePath(), [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'frame=key_frame',
    '-read_intervals', '%+#1',
    '-of', 'json',
    filePath,
  ])
  return JSON.parse(stdout)?.frames?.[0]?.key_frame === 1
}
