/**
 * Web Push 암호화 — aes128gcm (RFC 8291 · RFC 8188) 와 VAPID JWT (RFC 8292).
 *
 * `web-push` 패키지를 쓰지 않는 이유: 그건 Node 전용(`crypto` 모듈)이라 Worker 에서 돌지 않는다.
 * 여기 있는 건 전부 Web Crypto 만 쓰므로 Worker 와 Node 22 양쪽에서 그대로 동작한다 — 그래서 테스트도 된다.
 */

/**
 * Web Crypto 가 받는 BufferSource 는 ArrayBuffer 로 뒷받침된 뷰만 인정한다 (TS 5.7+).
 * 맨 Uint8Array 는 SharedArrayBuffer 도 포함해서 거절당하므로 이 별칭으로 좁혀 쓴다.
 */
export type Bytes = Uint8Array<ArrayBuffer>

const encoder = new TextEncoder()

export const utf8 = (text: string): Bytes => encoder.encode(text)

export const concatBytes = (...parts: readonly Uint8Array[]): Bytes => {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  return parts.reduce(
    (acc, part) => {
      acc.bytes.set(part, acc.offset)
      return { bytes: acc.bytes, offset: acc.offset + part.length }
    },
    { bytes: new Uint8Array(total), offset: 0 },
  ).bytes
}

export const base64UrlEncode = (bytes: Bytes): string => {
  // spread(...bytes) 는 인자 개수 한계에 걸릴 수 있어서 join 으로 만든다
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const base64UrlDecode = (text: string): Bytes => {
  const standard = text.replace(/-/g, '+').replace(/_/g, '/')
  const padded = standard.padEnd(Math.ceil(standard.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0))
}

const hmacSha256 = async (key: Bytes, data: Bytes): Promise<Bytes> => {
  const signingKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', signingKey, data))
}

/**
 * HKDF (RFC 5869). Web Crypto 의 deriveBits('HKDF') 를 쓰지 않고 직접 쓴 이유는
 * RFC 8291 이 extract 결과(PRK)를 다음 단계의 IKM 으로 다시 넣기 때문 — 단계별로 갈라 써야 한다.
 */
export const hkdf = async (
  salt: Bytes,
  ikm: Bytes,
  info: Bytes,
  length: number,
): Promise<Bytes> => {
  if (length < 1 || length > 255 * 32) throw new RangeError(`HKDF 길이가 범위를 벗어났다: ${length}`)
  const prk = await hmacSha256(salt, ikm)
  const blocks = await Array.from({ length: Math.ceil(length / 32) }).reduce<Promise<readonly Uint8Array[]>>(
    async (pending, _unused, index) => {
      const previous = await pending
      const tail = previous.at(-1) ?? new Uint8Array(0)
      return [...previous, await hmacSha256(prk, concatBytes(tail, info, Uint8Array.of(index + 1)))]
    },
    Promise.resolve([]),
  )
  return concatBytes(...blocks).slice(0, length)
}

/** salt(16) + rs(4) + idlen(1). keyid 는 이 뒤에 붙는 가변 길이다. */
export const AES128GCM_HEADER_LENGTH = 21
const P256_PUBLIC_KEY_LENGTH = 65
const AES_GCM_TAG_LENGTH = 16
export const DEFAULT_RECORD_SIZE = 4096

export interface Aes128GcmBody {
  readonly salt: Bytes
  readonly recordSize: number
  /** aes128gcm 의 keyid 자리. Web Push 에서는 서버의 임시 ECDH 공개키(65바이트)가 들어간다. */
  readonly keyId: Bytes
  readonly ciphertext: Bytes
}

/** RFC 8188 §2.1 — salt(16) | rs(4, big-endian) | idlen(1) | keyid | ciphertext */
export const buildAes128GcmBody = ({ salt, recordSize, keyId, ciphertext }: Aes128GcmBody): Bytes => {
  if (salt.length !== 16) throw new RangeError(`salt 는 16바이트여야 한다: ${salt.length}`)
  if (keyId.length > 255) throw new RangeError(`keyid 가 255바이트를 넘었다: ${keyId.length}`)
  const header = new Uint8Array(AES128GCM_HEADER_LENGTH + keyId.length)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, recordSize, false)
  header[20] = keyId.length
  header.set(keyId, 21)
  return concatBytes(header, ciphertext)
}

export const parseAes128GcmBody = (body: Bytes): Aes128GcmBody => {
  if (body.length < AES128GCM_HEADER_LENGTH) throw new RangeError('aes128gcm 헤더가 잘렸다')
  const view = new DataView(body.buffer, body.byteOffset, body.byteLength)
  const keyIdLength = view.getUint8(20)
  return {
    salt: body.slice(0, 16),
    recordSize: view.getUint32(16, false),
    keyId: body.slice(21, 21 + keyIdLength),
    ciphertext: body.slice(21 + keyIdLength),
  }
}

const KEY_INFO_PREFIX = utf8('WebPush: info')
const CEK_INFO = concatBytes(utf8('Content-Encoding: aes128gcm'), Uint8Array.of(0))
const NONCE_INFO = concatBytes(utf8('Content-Encoding: nonce'), Uint8Array.of(0))

export interface ContentKeys {
  readonly contentEncryptionKey: Bytes
  readonly nonce: Bytes
}

/** RFC 8291 §3.4 — ECDH 공유 비밀과 auth 시크릿에서 CEK(16) · nonce(12) 를 뽑는다. */
export const deriveContentKeys = async (input: {
  readonly sharedSecret: Bytes
  readonly authSecret: Bytes
  readonly uaPublicKey: Bytes
  readonly asPublicKey: Bytes
  readonly salt: Bytes
}): Promise<ContentKeys> => {
  const keyInfo = concatBytes(KEY_INFO_PREFIX, Uint8Array.of(0), input.uaPublicKey, input.asPublicKey)
  // 1단계는 salt 자리에 auth 시크릿이 들어간다 — 구독자만 아는 값이라 여기서 상대가 고정된다
  const ikm = await hkdf(input.authSecret, input.sharedSecret, keyInfo, 32)
  const [contentEncryptionKey, nonce] = await Promise.all([
    hkdf(input.salt, ikm, CEK_INFO, 16),
    hkdf(input.salt, ikm, NONCE_INFO, 12),
  ])
  return { contentEncryptionKey, nonce }
}

export interface SubscriptionKeys {
  /** 구독자 공개키. base64url 로 인코딩된 비압축 P-256 점(65바이트). */
  readonly p256dh: string
  /** 구독자 auth 시크릿. base64url 16바이트. */
  readonly auth: string
}

export interface EncryptOptions {
  /** 테스트에서 RFC 시험 벡터를 재현하려고 열어 둔 구멍. 실제 전송에서는 비운다. */
  readonly salt?: Bytes
  readonly serverKeys?: CryptoKeyPair
  readonly recordSize?: number
}

export const generateServerKeys = (): Promise<CryptoKeyPair> =>
  crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as Promise<CryptoKeyPair>

export const encryptPayload = async (
  payload: Bytes,
  keys: SubscriptionKeys,
  options: EncryptOptions = {},
): Promise<Bytes> => {
  const recordSize = options.recordSize ?? DEFAULT_RECORD_SIZE
  // 레코드 하나로만 보낸다. 평문 + 구분자 1 + 태그 16 이 rs 를 넘으면 규격 위반이다
  if (payload.length + 1 + AES_GCM_TAG_LENGTH > recordSize) {
    throw new RangeError(`페이로드가 레코드 크기를 넘었다: ${payload.length} > ${recordSize - 17}`)
  }
  const uaPublicKey = base64UrlDecode(keys.p256dh)
  const authSecret = base64UrlDecode(keys.auth)
  if (uaPublicKey.length !== P256_PUBLIC_KEY_LENGTH) throw new RangeError('p256dh 가 P-256 공개키가 아니다')

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const serverKeys = options.serverKeys ?? (await generateServerKeys())
  const asPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeys.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, serverKeys.privateKey, 256),
  )
  const { contentEncryptionKey, nonce } = await deriveContentKeys({
    sharedSecret,
    authSecret,
    uaPublicKey,
    asPublicKey,
    salt,
  })
  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['encrypt'])
  // RFC 8188 §2: 마지막 레코드의 평문 끝에는 구분자 0x02 를 붙인다 (중간 레코드면 0x01)
  const record = concatBytes(payload, Uint8Array.of(2))
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, record),
  )
  return buildAes128GcmBody({ salt, recordSize, keyId: asPublicKey, ciphertext })
}

/** 푸시 서비스 엔드포인트에서 VAPID `aud` 를 만든다 — 경로는 빼고 origin 만 쓴다. */
export const audienceOf = (endpoint: string): string => new URL(endpoint).origin

const toEcJwk = (publicKey: Bytes, privateKey: Bytes): JsonWebKey => {
  if (publicKey.length !== P256_PUBLIC_KEY_LENGTH || publicKey[0] !== 0x04) {
    throw new RangeError('VAPID 공개키는 0x04 로 시작하는 비압축 P-256 점 65바이트여야 한다')
  }
  if (privateKey.length !== 32) throw new RangeError(`VAPID 개인키는 32바이트여야 한다: ${privateKey.length}`)
  // Web Crypto 는 raw 개인키를 못 받는다. 그래서 공개키에서 x·y 를 떼어 JWK 로 조립한다
  return {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(publicKey.slice(1, 33)),
    y: base64UrlEncode(publicKey.slice(33, 65)),
    d: base64UrlEncode(privateKey),
    ext: true,
  }
}

// async 인 이유: 키 검증 실패도 예외가 아니라 거절로 나가야 호출부가 한 갈래로 받는다
export const importVapidKey = async (publicKey: string, privateKey: string): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    'jwk',
    toEcJwk(base64UrlDecode(publicKey), base64UrlDecode(privateKey)),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )

export interface VapidJwtInput {
  readonly audience: string
  /** 푸시 서비스가 문제 생겼을 때 연락할 곳. `mailto:` 또는 https URL. */
  readonly subject: string
  readonly signingKey: CryptoKey
  readonly expiresInSeconds?: number
  readonly nowSeconds?: number
}

/** 12시간. RFC 8292 는 24시간을 상한으로 두고, 푸시 서비스에 따라 그보다 짧게 거절한다. */
const DEFAULT_JWT_LIFETIME_SECONDS = 12 * 60 * 60

export const createVapidJwt = async (input: VapidJwtInput): Promise<string> => {
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000)
  const header = base64UrlEncode(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const payload = base64UrlEncode(
    utf8(
      JSON.stringify({
        aud: input.audience,
        exp: now + (input.expiresInSeconds ?? DEFAULT_JWT_LIFETIME_SECONDS),
        sub: input.subject,
      }),
    ),
  )
  const signingInput = `${header}.${payload}`
  // ECDSA 서명 결과가 곧 r||s 64바이트라 ES256 이 요구하는 형식과 같다 (DER 변환 불필요)
  const signature = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, input.signingKey, utf8(signingInput)),
  )
  return `${signingInput}.${base64UrlEncode(signature)}`
}

export const vapidAuthorization = (jwt: string, publicKey: string): string => `vapid t=${jwt}, k=${publicKey}`
