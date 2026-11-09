import { describe, expect, it } from 'vitest'
import {
  AES128GCM_HEADER_LENGTH,
  audienceOf,
  base64UrlDecode,
  base64UrlEncode,
  type Bytes,
  buildAes128GcmBody,
  concatBytes,
  createVapidJwt,
  deriveContentKeys,
  encryptPayload,
  hkdf,
  importVapidKey,
  parseAes128GcmBody,
  utf8,
  vapidAuthorization,
} from '../src/push-crypto'

const hex = (bytes: Bytes): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')

const fromHex = (text: string): Bytes =>
  Uint8Array.from(text.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16))

/** 구독자(폰) 쪽 키쌍. 실제 브라우저가 만들어 주는 것과 같은 모양이다. */
const generateUserAgentKeys = (): Promise<CryptoKeyPair> =>
  crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as Promise<CryptoKeyPair>

const importEcdhKeyPair = async (publicKey: string, privateKey: string): Promise<CryptoKeyPair> => {
  const raw = base64UrlDecode(publicKey)
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(raw.slice(1, 33)),
    y: base64UrlEncode(raw.slice(33, 65)),
    d: base64UrlEncode(base64UrlDecode(privateKey)),
    ext: true,
  }
  const [privateCryptoKey, publicCryptoKey] = await Promise.all([
    crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']),
    crypto.subtle.importKey('raw', raw, { name: 'ECDH', namedCurve: 'P-256' }, true, []),
  ])
  return { privateKey: privateCryptoKey, publicKey: publicCryptoKey }
}

/** 폰이 하는 일을 테스트에서 흉내 낸다 — 살아 있는 푸시 서비스를 때리지 않고 규격을 확인하는 방법. */
const decryptAes128Gcm = async (
  body: Bytes,
  userAgentKeys: CryptoKeyPair,
  authSecret: Bytes,
): Promise<string> => {
  const { salt, keyId, ciphertext } = parseAes128GcmBody(body)
  const serverPublic = await crypto.subtle.importKey('raw', keyId, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: serverPublic }, userAgentKeys.privateKey, 256),
  )
  const uaPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', userAgentKeys.publicKey))
  const { contentEncryptionKey, nonce } = await deriveContentKeys({
    sharedSecret,
    authSecret,
    uaPublicKey,
    asPublicKey: keyId,
    salt,
  })
  const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['decrypt'])
  const record = new Uint8Array(
    await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, ciphertext),
  )
  return new TextDecoder().decode(record.slice(0, -1))
}

describe('base64url', () => {
  it('왕복해도 바이트가 그대로다', () => {
    const bytes = crypto.getRandomValues(new Uint8Array(65))
    expect(hex(base64UrlDecode(base64UrlEncode(bytes)))).toBe(hex(bytes))
  })

  it('길이가 4로 나뉘지 않아도 왕복한다 — 패딩을 직접 채운다', () => {
    const lengths = [1, 2, 3, 16, 32, 33]
    lengths.forEach((length) => {
      const bytes = crypto.getRandomValues(new Uint8Array(length))
      expect(hex(base64UrlDecode(base64UrlEncode(bytes)))).toBe(hex(bytes))
    })
  })

  it('URL 에 못 쓰는 글자를 남기지 않는다', () => {
    const bytes = Uint8Array.of(251, 255, 190, 63, 62)
    expect(base64UrlEncode(bytes)).not.toMatch(/[+/=]/)
  })

  it('알려진 값을 그대로 디코딩한다', () => {
    expect(new TextDecoder().decode(base64UrlDecode('aGVsbG8'))).toBe('hello')
  })
})

describe('HKDF (RFC 5869)', () => {
  it('요청한 길이만큼 낸다 — 32바이트를 넘으면 블록을 이어 붙인다', async () => {
    const salt = new Uint8Array(16)
    const ikm = utf8('ikm')
    const info = utf8('info')
    const lengths = [12, 16, 32, 42, 64, 100]
    const results = await Promise.all(lengths.map((length) => hkdf(salt, ikm, info, length)))
    expect(results.map((result) => result.length)).toEqual(lengths)
  })

  it('앞부분은 길이를 늘려도 바뀌지 않는다', async () => {
    const [short, long] = await Promise.all([
      hkdf(new Uint8Array(16), utf8('ikm'), utf8('info'), 16),
      hkdf(new Uint8Array(16), utf8('ikm'), utf8('info'), 64),
    ])
    expect(hex(long.slice(0, 16))).toBe(hex(short))
  })

  it('RFC 5869 A.1 시험 벡터와 같다', async () => {
    const okm = await hkdf(
      fromHex('000102030405060708090a0b0c'),
      fromHex('0b'.repeat(22)),
      fromHex('f0f1f2f3f4f5f6f7f8f9'),
      42,
    )
    expect(hex(okm)).toBe(
      '3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865',
    )
  })

  it('길이가 범위를 벗어나면 거부한다', async () => {
    await expect(hkdf(new Uint8Array(16), utf8('ikm'), utf8('info'), 0)).rejects.toThrow(RangeError)
  })
})

describe('aes128gcm 본문 레이아웃 (RFC 8188)', () => {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyId = crypto.getRandomValues(new Uint8Array(65))
  const ciphertext = crypto.getRandomValues(new Uint8Array(40))

  it('salt | rs(4, big-endian) | idlen(1) | keyid | ciphertext 순서로 쌓는다', () => {
    const body = buildAes128GcmBody({ salt, recordSize: 4096, keyId, ciphertext })
    expect(body.length).toBe(AES128GCM_HEADER_LENGTH + keyId.length + ciphertext.length)
    expect(hex(body.slice(0, 16))).toBe(hex(salt))
    expect(hex(body.slice(16, 20))).toBe('00001000')
    expect(body[20]).toBe(65)
    expect(hex(body.slice(21, 86))).toBe(hex(keyId))
    expect(hex(body.slice(86))).toBe(hex(ciphertext))
  })

  it('파싱하면 넣은 값이 그대로 나온다', () => {
    const parsed = parseAes128GcmBody(buildAes128GcmBody({ salt, recordSize: 4096, keyId, ciphertext }))
    expect(parsed.recordSize).toBe(4096)
    expect(hex(parsed.salt)).toBe(hex(salt))
    expect(hex(parsed.keyId)).toBe(hex(keyId))
    expect(hex(parsed.ciphertext)).toBe(hex(ciphertext))
  })

  it('salt 가 16바이트가 아니면 거부한다', () => {
    expect(() => buildAes128GcmBody({ salt: new Uint8Array(8), recordSize: 4096, keyId, ciphertext })).toThrow(
      RangeError,
    )
  })

  it('헤더보다 짧은 본문은 파싱하지 않는다', () => {
    expect(() => parseAes128GcmBody(new Uint8Array(20))).toThrow(RangeError)
  })
})

describe('페이로드 암호화 (RFC 8291)', () => {
  it('구독자만 풀 수 있다 — 폰 역할을 흉내 내 되돌려 본다', async () => {
    const userAgentKeys = await generateUserAgentKeys()
    const authSecret = crypto.getRandomValues(new Uint8Array(16))
    const keys = {
      p256dh: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', userAgentKeys.publicKey))),
      auth: base64UrlEncode(authSecret),
    }
    const message = JSON.stringify({ title: '이상 행동 감지', body: '1번 카메라' })

    const body = await encryptPayload(utf8(message), keys)

    expect(await decryptAes128Gcm(body, userAgentKeys, authSecret)).toBe(message)
  })

  it('보낼 때마다 salt 와 임시 키가 달라진다', async () => {
    const userAgentKeys = await generateUserAgentKeys()
    const keys = {
      p256dh: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', userAgentKeys.publicKey))),
      auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
    }
    const [first, second] = await Promise.all([encryptPayload(utf8('hi'), keys), encryptPayload(utf8('hi'), keys)])
    expect(hex(parseAes128GcmBody(first).salt)).not.toBe(hex(parseAes128GcmBody(second).salt))
    expect(hex(parseAes128GcmBody(first).keyId)).not.toBe(hex(parseAes128GcmBody(second).keyId))
  })

  it('레코드 한 개에 안 들어가는 페이로드는 거부한다', async () => {
    const userAgentKeys = await generateUserAgentKeys()
    const keys = {
      p256dh: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', userAgentKeys.publicKey))),
      auth: base64UrlEncode(crypto.getRandomValues(new Uint8Array(16))),
    }
    await expect(encryptPayload(new Uint8Array(4080), keys)).rejects.toThrow(RangeError)
  })

  it('p256dh 가 P-256 공개키가 아니면 거부한다', async () => {
    await expect(
      encryptPayload(utf8('hi'), { p256dh: base64UrlEncode(new Uint8Array(20)), auth: base64UrlEncode(new Uint8Array(16)) }),
    ).rejects.toThrow(RangeError)
  })

  it('RFC 8291 §5 시험 벡터와 바이트가 같다', async () => {
    const serverKeys = await importEcdhKeyPair(
      'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
      'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
    )
    const body = await encryptPayload(
      utf8('When I grow up, I want to be a watermelon'),
      {
        p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
        auth: 'BTBZMqHH6r4Tts7J_aSIgg',
      },
      { salt: base64UrlDecode('DGv6ra1nlYgDCS1FRnbzlw'), serverKeys },
    )
    expect(base64UrlEncode(body)).toBe(
      'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
    )
  })
})

describe('VAPID (RFC 8292)', () => {
  const generateVapidKeys = async () => {
    const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
      'sign',
      'verify',
    ])) as CryptoKeyPair
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
    const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
    return { publicKey: base64UrlEncode(raw), privateKey: jwk.d as string }
  }

  it('엔드포인트에서 origin 만 뽑아 aud 로 쓴다', () => {
    expect(audienceOf('https://fcm.googleapis.com/fcm/send/abc:123')).toBe('https://fcm.googleapis.com')
    expect(audienceOf('https://web.push.apple.com/QAB/xyz')).toBe('https://web.push.apple.com')
  })

  it('header.payload.signature 세 토막이고 서명이 공개키로 검증된다', async () => {
    const { publicKey, privateKey } = await generateVapidKeys()
    const signingKey = await importVapidKey(publicKey, privateKey)
    const jwt = await createVapidJwt({
      audience: 'https://fcm.googleapis.com',
      subject: 'mailto:demo@example.com',
      signingKey,
      nowSeconds: 1_700_000_000,
    })

    const parts = jwt.split('.')
    expect(parts).toHaveLength(3)
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]!)))).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]!)))).toEqual({
      aud: 'https://fcm.googleapis.com',
      exp: 1_700_000_000 + 12 * 60 * 60,
      sub: 'mailto:demo@example.com',
    })
    // ES256 서명은 DER 이 아니라 r||s 64바이트여야 한다
    expect(base64UrlDecode(parts[2]!).length).toBe(64)

    const verifyKey = await crypto.subtle.importKey(
      'raw',
      base64UrlDecode(publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      verifyKey,
      base64UrlDecode(parts[2]!),
      utf8(`${parts[0]}.${parts[1]}`),
    )
    expect(verified).toBe(true)
  })

  it('만료 시간은 기본 12시간이고 필요하면 줄일 수 있다', async () => {
    const { publicKey, privateKey } = await generateVapidKeys()
    const signingKey = await importVapidKey(publicKey, privateKey)
    const jwt = await createVapidJwt({
      audience: 'https://example.com',
      subject: 'mailto:a@b.c',
      signingKey,
      nowSeconds: 1_000,
      expiresInSeconds: 60,
    })
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(jwt.split('.')[1]!)))
    expect(payload.exp).toBe(1_060)
  })

  it('공개키가 P-256 비압축 점이 아니면 거부한다', async () => {
    await expect(importVapidKey(base64UrlEncode(new Uint8Array(65)), base64UrlEncode(new Uint8Array(32)))).rejects.toThrow(
      RangeError,
    )
  })

  it('Authorization 헤더는 vapid t=..., k=... 형식이다', () => {
    expect(vapidAuthorization('jwt.parts.here', 'PUBKEY')).toBe('vapid t=jwt.parts.here, k=PUBKEY')
  })
})

describe('concatBytes', () => {
  it('순서를 지켜 이어 붙인다', () => {
    expect(hex(concatBytes(Uint8Array.of(1, 2), Uint8Array.of(3), new Uint8Array(0), Uint8Array.of(4)))).toBe(
      '01020304',
    )
  })
})
