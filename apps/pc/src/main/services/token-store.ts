import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { safeStorage } from 'electron'
import type { SessionTokens, TokenStore } from './server-session'

/**
 * 사장님 로그인 토큰 보관.
 *
 * config.json 에 두지 않는 이유: getConfig IPC 가 설정 전체를 렌더러로 보낸다.
 * 거기 리프레시 토큰이 섞이면 렌더러가 토큰을 쥐게 된다.
 *
 * OS 키체인(safeStorage)으로 암호화해서 쓴다. 암호화를 못 쓰는 환경(키링 없는
 * 리눅스 등)에서는 평문으로 디스크에 남기지 않고 메모리에만 둔다 — 재시작하면
 * 다시 로그인해야 하지만, 감시(조각 업로드)는 기기 토큰으로 돌아서 멈추지 않는다.
 */
export const createSafeTokenStore = (filePath: string): TokenStore => {
  const memory = { tokens: null as SessionTokens | null }
  const canEncrypt = (): boolean => {
    try {
      return safeStorage.isEncryptionAvailable()
    } catch {
      return false
    }
  }

  return {
    load: () => {
      if (memory.tokens) return memory.tokens
      if (!canEncrypt()) return null
      try {
        const decrypted = safeStorage.decryptString(readFileSync(filePath))
        memory.tokens = JSON.parse(decrypted) as SessionTokens
        return memory.tokens
      } catch {
        // 파일이 없거나, 다른 OS 계정에서 암호화돼 풀 수 없다. 다시 로그인하면 된다.
        return null
      }
    },

    save: (tokens) => {
      memory.tokens = tokens
      if (!canEncrypt()) return
      mkdirSync(dirname(filePath), { recursive: true })
      const temp = join(dirname(filePath), `.${randomBytes(4).toString('hex')}.tmp`)
      writeFileSync(temp, safeStorage.encryptString(JSON.stringify(tokens)))
      renameSync(temp, filePath)
    },

    clear: () => {
      memory.tokens = null
      rmSync(filePath, { force: true })
    },
  }
}
