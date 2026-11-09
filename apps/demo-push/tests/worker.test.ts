import { createRequire } from 'node:module'
import { afterEach, describe, expect, it, vi } from 'vitest'
import worker, { type Env } from '../src/worker'
import { ACK_LOG_LIMIT, ACK_MAX_AGE_MS, AckLog } from '../src/ack-log'
import {
  base64UrlDecode,
  base64UrlEncode,
  deriveContentKeys,
  parseAes128GcmBody,
  utf8,
  type Bytes,
} from '../src/push-crypto'

interface SqliteStatement {
  all(...bindings: never[]): Record<string, unknown>[]
  run(...bindings: never[]): unknown
}

interface SqliteDatabase {
  prepare(query: string): SqliteStatement
}

// Vite 가 node:sqlite 를 정적으로 못 풀어서(내장 목록보다 나중에 생겼다) require 로 우회한다
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as {
  DatabaseSync: new (location: string) => SqliteDatabase
}

const WORKER_ORIGIN = 'https://demo-push.workers.dev'
const PUSH_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/fake-endpoint-123'

/** KV 흉내. TTL 을 실제로 흘려보내지는 않고, 넘어온 값만 들여다볼 수 있게 남긴다. */
const createStore = () => {
  const entries = new Map<string, { readonly value: string; readonly ttl?: number }>()
  return {
    entries,
    kv: {
      get: async (key: string) => entries.get(key)?.value ?? null,
      put: async (key: string, value: string, options?: { expirationTtl?: number }) => {
        entries.set(key, { value, ttl: options?.expirationTtl })
      },
      delete: async (key: string) => void entries.delete(key),
    },
  }
}

/** 실제 배포와 같은 방식으로 VAPID 키를 만든다 (scripts/generate-vapid.mjs 와 같은 절차). */
const generateVapidKeys = async () => {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
    'sign',
    'verify',
  ])) as CryptoKeyPair
  return {
    publicKey: base64UrlEncode(new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))),
    privateKey: (await crypto.subtle.exportKey('jwk', pair.privateKey)).d as string,
  }
}

// 키 생성은 한 번이면 된다. 테스트마다 다시 만들 이유가 없다
const vapid = await generateVapidKeys()

/**
 * DO 의 SQL 저장소 자리에 진짜 SQLite 를 끼운다 (node:sqlite).
 * 흉내 낸 쿼리 엔진이 아니라 AckLog 가 실제로 쓰는 SQL 이 그대로 돈다.
 */
const createSqlStorage = () => {
  const db = new DatabaseSync(':memory:')
  return {
    exec: (query: string, ...bindings: unknown[]) => {
      const statement = db.prepare(query)
      const isSelect = /^\s*SELECT/i.test(query)
      const rows = isSelect
        ? (statement.all(...(bindings as never[])) as Record<string, unknown>[])
        : (statement.run(...(bindings as never[])), [])
      return { toArray: () => rows }
    },
  }
}

/**
 * DO 네임스페이스 흉내. 핵심은 하나다 — 같은 코드면 같은 인스턴스를 돌려준다.
 * 폰의 쓰기와 데스크톱의 읽기가 같은 저장소를 지난다는 것이 KV 에 없던 성질이고, 이 테스트가 그걸 건다.
 */
const createAckLogNamespace = () => {
  const instances = new Map<string, AckLog>()
  return {
    instances,
    namespace: {
      idFromName: (name: string) => name,
      get: (id: unknown) => {
        const name = id as string
        const existing = instances.get(name)
        if (existing !== undefined) return existing
        const created = new AckLog({ storage: { sql: createSqlStorage() } })
        instances.set(name, created)
        return created
      },
    },
  }
}

const createEnv = () => {
  const store = createStore()
  const ackLog = createAckLogNamespace()
  const env: Env = {
    SUBS: store.kv,
    ACK_LOG: ackLog.namespace,
    VAPID_PUBLIC_KEY: vapid.publicKey,
    VAPID_PRIVATE_KEY: vapid.privateKey,
    VAPID_SUBJECT: 'mailto:demo@example.com',
  }
  return { env, store, ackLog }
}

/**
 * 폰 흉내. 브라우저가 만들어 주는 구독과, 서비스 워커가 푸시를 풀어 보는 과정을 그대로 재현한다.
 * 살아 있는 푸시 서비스를 때리지 않고 "정말 폰까지 닿는가" 를 확인하는 방법이다.
 */
const createPhone = async () => {
  const keyPair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])) as CryptoKeyPair
  const authSecret = crypto.getRandomValues(new Uint8Array(16))
  const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', keyPair.publicKey))

  return {
    subscription: {
      endpoint: PUSH_ENDPOINT,
      keys: { p256dh: base64UrlEncode(publicKey), auth: base64UrlEncode(authSecret) },
    },
    /** 서비스 워커의 push 이벤트에서 `event.data.json()` 이 주는 것과 같은 값을 돌려준다. */
    receive: async (body: Bytes): Promise<unknown> => {
      const { salt, keyId, ciphertext } = parseAes128GcmBody(body)
      const serverKey = await crypto.subtle.importKey('raw', keyId, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
      const sharedSecret = new Uint8Array(
        await crypto.subtle.deriveBits({ name: 'ECDH', public: serverKey }, keyPair.privateKey, 256),
      )
      const { contentEncryptionKey, nonce } = await deriveContentKeys({
        sharedSecret,
        authSecret,
        uaPublicKey: publicKey,
        asPublicKey: keyId,
        salt,
      })
      const aesKey = await crypto.subtle.importKey('raw', contentEncryptionKey, { name: 'AES-GCM' }, false, ['decrypt'])
      const record = new Uint8Array(
        await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, aesKey, ciphertext),
      )
      // 끝의 0x02 는 RFC 8188 의 마지막 레코드 구분자다
      return JSON.parse(new TextDecoder().decode(record.slice(0, -1)))
    },
  }
}

interface PushCall {
  readonly url: string
  readonly headers: Record<string, string>
  readonly body: Bytes
}

/** 푸시 서비스 흉내. 나가는 요청을 붙잡아 두고 원하는 상태 코드로 답한다. */
const stubPushService = (status: number): readonly PushCall[] => {
  const calls: PushCall[] = []
  vi.stubGlobal('fetch', async (url: string, init: RequestInit = {}) => {
    calls.push({
      url: String(url),
      headers: (init.headers ?? {}) as Record<string, string>,
      body: new Uint8Array(await new Response(init.body).arrayBuffer()),
    })
    return new Response(status === 201 ? '' : 'gone', { status })
  })
  return calls
}

const get = (path: string) => new Request(`${WORKER_ORIGIN}${path}`)

const post = (path: string, body: unknown) =>
  new Request(`${WORKER_ORIGIN}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('라우팅', () => {
  it('GET /health 는 살아 있다고 답한다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(get('/health'), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true })
  })

  it('모든 응답에 CORS 가 붙는다 — 공개 데모라 origin 을 안 가린다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(get('/health'), env)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('OPTIONS 프리플라이트는 204 로 통과시킨다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(new Request(`${WORKER_ORIGIN}/notify`, { method: 'OPTIONS' }), env)
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-headers')).toBe('content-type')
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
  })

  it('모르는 경로는 405 다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(new Request(`${WORKER_ORIGIN}/nope`, { method: 'PUT' }), env)
    expect(response.status).toBe(405)
  })

  it('맞는 경로라도 메서드가 다르면 405 다', async () => {
    const { env } = createEnv()
    expect((await worker.fetch(get('/subscribe'), env)).status).toBe(405)
  })
})

describe('POST /subscribe', () => {
  it('구독을 sub:<code> 로 24시간 동안 맡아 둔다', async () => {
    const { env, store } = createEnv()
    const phone = await createPhone()

    const response = await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: phone.subscription }), env)

    expect(response.status).toBe(204)
    expect(store.entries.get('sub:ABC123')?.ttl).toBe(24 * 60 * 60)
    expect(JSON.parse(store.entries.get('sub:ABC123')!.value)).toEqual(phone.subscription)
  })

  it('코드가 6자리가 아니면 400 이다', async () => {
    const { env, store } = createEnv()
    const phone = await createPhone()
    const response = await worker.fetch(post('/subscribe', { code: 'AB', subscription: phone.subscription }), env)
    expect(response.status).toBe(400)
    expect(store.entries.size).toBe(0)
  })

  it('구독 모양이 틀리면 400 이다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: { endpoint: 'x' } }), env)
    expect(response.status).toBe(400)
  })

  it('JSON 이 아니면 400 이다', async () => {
    const { env } = createEnv()
    const broken = new Request(`${WORKER_ORIGIN}/subscribe`, { method: 'POST', body: '나는 JSON 이 아니다' })
    expect((await worker.fetch(broken, env)).status).toBe(400)
  })
})

describe('GET /subscribed — 데스크톱이 폰 연결을 기다리는 폴링', () => {
  it('구독이 있으면 true 다', async () => {
    const { env } = createEnv()
    const phone = await createPhone()
    await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: phone.subscription }), env)

    const response = await worker.fetch(get('/subscribed?code=ABC123'), env)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ subscribed: true })
  })

  it('구독이 없으면 false 다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(get('/subscribed?code=ZZZZZZ'), env)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ subscribed: false })
  })

  it('코드가 망가져 있어도 200 false 다 — 폴링이 에러로 끊기면 안 된다', async () => {
    const { env } = createEnv()
    const malformed = ['/subscribed?code=AB', '/subscribed?code=ABC12!', '/subscribed?code=TOOLONG123', '/subscribed']
    const responses = await Promise.all(malformed.map((path) => worker.fetch(get(path), env)))

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200])
    const bodies = await Promise.all(responses.map((response) => response.json()))
    expect(bodies).toEqual([
      { subscribed: false },
      { subscribed: false },
      { subscribed: false },
      { subscribed: false },
    ])
  })

  it('폰이 쓴 코드와 대소문자가 달라도 찾아낸다', async () => {
    const { env } = createEnv()
    const phone = await createPhone()
    await worker.fetch(post('/subscribe', { code: 'abc123', subscription: phone.subscription }), env)

    expect(await (await worker.fetch(get('/subscribed?code=ABC123'), env)).json()).toEqual({ subscribed: true })
  })

  it('CORS 가 붙는다 — 데스크톱 페이지가 다른 origin 에서 부른다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(get('/subscribed?code=ABC123'), env)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })
})

describe('POST /notify — 폰까지 실제로 닿는 경로', () => {
  const subscribeAndNotify = async (message: Record<string, unknown>, status = 201) => {
    const { env, store } = createEnv()
    const phone = await createPhone()
    await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: phone.subscription }), env)
    const calls = stubPushService(status)
    const response = await worker.fetch(post('/notify', message), env)
    return { env, store, phone, calls, response }
  }

  it('폰이 풀어 보면 보낸 title·body·data 가 그대로 나온다', async () => {
    const { phone, calls, response } = await subscribeAndNotify({
      code: 'ABC123',
      title: '이상 행동 감지',
      body: '1번 카메라 · 방금',
      data: { eventId: 'evt_1' },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: true })
    expect(await phone.receive(calls[0]!.body)).toEqual({
      title: '이상 행동 감지',
      body: '1번 카메라 · 방금',
      data: { eventId: 'evt_1' },
    })
  })

  it('data 를 안 보내면 빈 객체로 채워 보낸다', async () => {
    const { phone, calls } = await subscribeAndNotify({ code: 'ABC123', title: '제목', body: '본문' })
    expect(await phone.receive(calls[0]!.body)).toEqual({ title: '제목', body: '본문', data: {} })
  })

  it('구독 엔드포인트로 그대로 POST 한다', async () => {
    const { calls } = await subscribeAndNotify({ code: 'ABC123', title: 't', body: 'b' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe(PUSH_ENDPOINT)
  })

  it('잠긴 폰을 깨우는 헤더를 붙인다', async () => {
    const { calls } = await subscribeAndNotify({ code: 'ABC123', title: 't', body: 'b' })
    const { headers } = calls[0]!
    expect(headers.TTL).toBe('300')
    // normal 이면 푸시 서비스가 묶어서 나중에 줄 수 있다 — 위험 알림에는 쓸모없다
    expect(headers.Urgency).toBe('high')
    expect(headers['content-encoding']).toBe('aes128gcm')
    expect(headers['content-type']).toBe('application/octet-stream')
  })

  it('코드 대소문자가 달라도 같은 구독을 찾는다 — 심사위원이 손으로 옮겨 적는 값이다', async () => {
    const { calls } = await subscribeAndNotify({ code: 'abc123', title: 't', body: 'b' })
    expect(calls).toHaveLength(1)
  })

  it('구독이 없는 코드는 404 고, 푸시 서비스를 부르지 않는다', async () => {
    const { env } = createEnv()
    const calls = stubPushService(201)
    const response = await worker.fetch(post('/notify', { code: 'ZZZZZZ', title: 't', body: 'b' }), env)

    expect(response.status).toBe(404)
    expect(calls).toHaveLength(0)
  })

  it('title·body 가 문자열이 아니면 400 이다', async () => {
    const { env } = createEnv()
    const phone = await createPhone()
    await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: phone.subscription }), env)
    const response = await worker.fetch(post('/notify', { code: 'ABC123', title: 1, body: 'b' }), env)
    expect(response.status).toBe(400)
  })

  it('VAPID 설정이 비어 있으면 500 으로 이유를 알려 준다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(post('/notify', { code: 'ABC123', title: 't', body: 'b' }), {
      ...env,
      VAPID_PRIVATE_KEY: '',
    })
    expect(response.status).toBe(500)
    expect((await response.json()).error).toBe('not-configured')
  })
})

describe('POST /notify — VAPID 서명', () => {
  /** 푸시 서비스가 Authorization 을 뜯어 보는 것과 같은 순서로 쪼갠다. */
  const parseAuthorization = (authorization: string) => {
    const match = /^vapid t=([\w-]+)\.([\w-]+)\.([\w-]+), k=([\w-]+)$/.exec(authorization)
    if (match === null) throw new Error(`vapid t=<jwt>, k=<pub> 형식이 아니다: ${authorization}`)
    const [, header, payload, signature, publicKey] = match
    return {
      header: JSON.parse(new TextDecoder().decode(base64UrlDecode(header!))),
      claims: JSON.parse(new TextDecoder().decode(base64UrlDecode(payload!))),
      signature: base64UrlDecode(signature!),
      signingInput: utf8(`${header}.${payload}`),
      publicKey: publicKey!,
    }
  }

  const captureAuthorization = async () => {
    const { env } = createEnv()
    const phone = await createPhone()
    await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: phone.subscription }), env)
    const calls = stubPushService(201)
    await worker.fetch(post('/notify', { code: 'ABC123', title: 't', body: 'b' }), env)
    return parseAuthorization(calls[0]!.headers.authorization ?? '')
  }

  it('Authorization 은 vapid t=<jwt>, k=<공개키> 형식이고 k 는 설정한 공개키다', async () => {
    const { header, publicKey } = await captureAuthorization()
    expect(header).toEqual({ typ: 'JWT', alg: 'ES256' })
    expect(publicKey).toBe(vapid.publicKey)
  })

  it('aud 는 엔드포인트 origin 이고 sub 은 설정한 연락처다', async () => {
    const { claims } = await captureAuthorization()
    expect(claims.aud).toBe('https://fcm.googleapis.com')
    expect(claims.sub).toBe('mailto:demo@example.com')
    expect(claims.exp).toBeGreaterThan(Date.now() / 1000)
    // RFC 8292 상한이 24시간이다
    expect(claims.exp).toBeLessThan(Date.now() / 1000 + 24 * 60 * 60)
  })

  it('서명이 VAPID 공개키로 검증된다 — 푸시 서비스가 하는 확인과 같다', async () => {
    const { signature, signingInput } = await captureAuthorization()
    const verifyKey = await crypto.subtle.importKey(
      'raw',
      base64UrlDecode(vapid.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, signature, signingInput)

    expect(verified).toBe(true)
  })

  it('다른 키로는 검증되지 않는다 — 서명이 진짜로 그 키에 묶여 있다', async () => {
    const { signature, signingInput } = await captureAuthorization()
    const other = await generateVapidKeys()
    const verifyKey = await crypto.subtle.importKey(
      'raw',
      base64UrlDecode(other.publicKey),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    const verified = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, verifyKey, signature, signingInput)

    expect(verified).toBe(false)
  })
})

describe('POST /notify — 죽은 구독 치우기', () => {
  const notifyWith = async (status: number) => {
    const { env, store } = createEnv()
    const phone = await createPhone()
    await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: phone.subscription }), env)
    stubPushService(status)
    const response = await worker.fetch(post('/notify', { code: 'ABC123', title: 't', body: 'b' }), env)
    return { store, response, env }
  }

  it('푸시 서비스가 410 을 주면 410 으로 옮기고 KV 에서 지운다', async () => {
    const { store, response } = await notifyWith(410)
    expect(response.status).toBe(410)
    expect(store.entries.has('sub:ABC123')).toBe(false)
  })

  it('404 도 만료로 본다 — 남겨 두면 다음 발송도 같은 실패를 반복한다', async () => {
    const { store, response } = await notifyWith(404)
    expect(response.status).toBe(410)
    expect(store.entries.has('sub:ABC123')).toBe(false)
  })

  it('지워지고 나면 /subscribed 가 false 로 바뀐다', async () => {
    const { env } = await notifyWith(410)
    expect(await (await worker.fetch(get('/subscribed?code=ABC123'), env)).json()).toEqual({ subscribed: false })
  })

  it('그 밖의 실패는 502 로 올리고 구독은 그대로 둔다', async () => {
    const { store, response } = await notifyWith(500)
    expect(response.status).toBe(502)
    expect((await response.json()).error).toBe('push-failed')
    expect(store.entries.has('sub:ABC123')).toBe(true)
  })
})

describe('POST /ack — 폰에서 "확인했어요" 를 누른 순간', () => {
  const ack = (env: Env, message: Record<string, unknown>) => worker.fetch(post('/ack', message), env)

  it('기록하고 서버 시각을 돌려준다', async () => {
    const { env } = createEnv()
    const before = Date.now()

    const response = await ack(env, { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' })

    expect(response.status).toBe(200)
    const payload = await response.json()
    expect(payload.ok).toBe(true)
    expect(Date.parse(payload.at)).toBeGreaterThanOrEqual(before)
    expect(Date.parse(payload.at)).toBeLessThanOrEqual(Date.now())
  })

  it('쓴 걸 그대로 읽어 낼 수 있다', async () => {
    const { env } = createEnv()
    await ack(env, { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' })

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()

    expect(acks).toHaveLength(1)
    expect(acks[0]).toMatchObject({ eventId: 'evt_1', state: 'confirmed' })
    expect(typeof acks[0].at).toBe('string')
  })

  it('at 은 서버가 찍는다 — 폰이 보낸 값은 무시한다', async () => {
    const { env } = createEnv()
    await ack(env, { code: 'ABC123', eventId: 'evt_1', state: 'confirmed', at: '1999-01-01T00:00:00.000Z' })

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()

    expect(acks[0].at).not.toBe('1999-01-01T00:00:00.000Z')
    expect(Date.parse(acks[0].at)).toBeGreaterThan(Date.parse('2020-01-01T00:00:00.000Z'))
  })

  it('여러 개를 누른 순서대로 쌓는다', async () => {
    const { env } = createEnv()
    await ack(env, { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' })
    await ack(env, { code: 'ABC123', eventId: 'evt_2', state: 'false_positive' })

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()

    expect(acks.map((entry: { eventId: string }) => entry.eventId)).toEqual(['evt_1', 'evt_2'])
    expect(acks[1].state).toBe('false_positive')
  })

  it('코드는 대소문자를 안 가린다 — 구독과 같은 규칙이다', async () => {
    const { env } = createEnv()
    await ack(env, { code: 'abc123', eventId: 'evt_1', state: 'confirmed' })

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    expect(acks).toHaveLength(1)
  })

  it('구독과 따로 논다 — 푸시 구독이 없어도 확인은 기록된다', async () => {
    const { env, store } = createEnv()
    await ack(env, { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' })

    expect(store.entries.has('sub:ABC123')).toBe(false)
    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    expect(acks).toHaveLength(1)
  })

  it('확인 로그는 KV 를 건드리지 않는다 — DO 로 옮겼다', async () => {
    const { env, store } = createEnv()
    await ack(env, { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' })
    expect([...store.entries.keys()]).toEqual([])
  })

  it('최근 50개만 남긴다', async () => {
    const { env } = createEnv()
    const many = Array.from({ length: ACK_LOG_LIMIT + 10 }, (_unused, index) => index)
    await many.reduce(async (pending, index) => {
      await pending
      await ack(env, { code: 'ABC123', eventId: `evt_${index}`, state: 'confirmed' })
    }, Promise.resolve())

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()

    expect(acks).toHaveLength(ACK_LOG_LIMIT)
    // 잘려 나가는 건 오래된 쪽이다
    expect(acks[0].eventId).toBe('evt_10')
    expect(acks[49].eventId).toBe('evt_59')
  })

  it('모르는 state 는 400 이다', async () => {
    const { env, store } = createEnv()
    const response = await ack(env, { code: 'ABC123', eventId: 'evt_1', state: 'maybe' })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('invalid-state')
    expect(store.entries.has('acks:ABC123')).toBe(false)
  })

  it('eventId 가 없거나 비면 400 이다', async () => {
    const { env } = createEnv()
    const responses = await Promise.all([
      ack(env, { code: 'ABC123', state: 'confirmed' }),
      ack(env, { code: 'ABC123', eventId: '', state: 'confirmed' }),
      ack(env, { code: 'ABC123', eventId: 42, state: 'confirmed' }),
    ])
    expect(responses.map((response) => response.status)).toEqual([400, 400, 400])
  })

  it('코드가 망가져 있으면 400 이다 — 쓰기는 폴링과 달리 틀린 걸 알려 줘야 한다', async () => {
    const { env } = createEnv()
    const response = await ack(env, { code: 'AB', eventId: 'evt_1', state: 'confirmed' })
    expect(response.status).toBe(400)
    expect((await response.json()).error).toBe('invalid-code')
  })
})

describe('GET /acks — 데스크톱이 확인을 기다리는 폴링', () => {
  const ackAt = async (env: Env, eventId: string) => {
    const response = await worker.fetch(post('/ack', { code: 'ABC123', eventId, state: 'confirmed' }), env)
    return (await response.json()).at as string
  }

  const acksSince = async (env: Env, since?: string) => {
    const path = since === undefined ? '/acks?code=ABC123' : `/acks?code=ABC123&since=${encodeURIComponent(since)}`
    const response = await worker.fetch(get(path), env)
    expect(response.status).toBe(200)
    return (await response.json()).acks as { eventId: string; at: string }[]
  }

  it('since 를 안 주면 전부 준다', async () => {
    const { env } = createEnv()
    await ackAt(env, 'evt_1')
    await ackAt(env, 'evt_2')
    expect((await acksSince(env)).map((entry) => entry.eventId)).toEqual(['evt_1', 'evt_2'])
  })

  it('since 보다 엄격히 뒤엣것만 준다 — 방금 본 건 다시 안 준다', async () => {
    const { env } = createEnv()
    const first = await ackAt(env, 'evt_1')
    // 같은 밀리초에 겹치지 않게 한 틱 띄운다
    await new Promise((resolve) => setTimeout(resolve, 2))
    await ackAt(env, 'evt_2')

    expect((await acksSince(env, first)).map((entry) => entry.eventId)).toEqual(['evt_2'])
  })

  it('마지막 것을 since 로 주면 빈 배열이다 — 폴링이 도는 정상 상태', async () => {
    const { env } = createEnv()
    await ackAt(env, 'evt_1')
    await new Promise((resolve) => setTimeout(resolve, 2))
    const last = await ackAt(env, 'evt_2')

    expect(await acksSince(env, last)).toEqual([])
  })

  it('오래된 것부터 준다', async () => {
    const { env } = createEnv()
    await ackAt(env, 'evt_1')
    await new Promise((resolve) => setTimeout(resolve, 2))
    await ackAt(env, 'evt_2')

    const acks = await acksSince(env)
    expect(Date.parse(acks[0]!.at)).toBeLessThan(Date.parse(acks[1]!.at))
  })

  it('since 가 날짜가 아니면 전부 준다 — 폴링을 끊지 않는다', async () => {
    const { env } = createEnv()
    await ackAt(env, 'evt_1')
    expect((await acksSince(env, '어제')).map((entry) => entry.eventId)).toEqual(['evt_1'])
  })

  it('확인이 하나도 없으면 빈 배열이다', async () => {
    const { env } = createEnv()
    expect(await acksSince(env)).toEqual([])
  })

  it('모르는 코드·망가진 코드는 200 빈 배열이다 — 에러로 폴링을 끊지 않는다', async () => {
    const { env } = createEnv()
    const paths = ['/acks?code=ZZZZZZ', '/acks?code=AB', '/acks?code=ABC12!', '/acks']
    const responses = await Promise.all(paths.map((path) => worker.fetch(get(path), env)))

    expect(responses.map((response) => response.status)).toEqual([200, 200, 200, 200])
    const bodies = await Promise.all(responses.map((response) => response.json()))
    expect(bodies).toEqual([{ acks: [] }, { acks: [] }, { acks: [] }, { acks: [] }])
  })

  it('DO 를 못 부르면 빈 배열로 답한다 — 폴링이 화면을 깨면 안 된다', async () => {
    const { env } = createEnv()
    const broken: Env = {
      ...env,
      ACK_LOG: {
        idFromName: () => 'x',
        get: () => {
          throw new Error('Durable Object 를 못 잡았다')
        },
      },
    }
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    const response = await worker.fetch(get('/acks?code=ABC123'), broken)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ acks: [] })
    // 조용히 삼키진 않는다 — wrangler tail 에 남아야 원인을 찾는다
    expect(console.error).toHaveBeenCalled()
  })

  it('CORS 가 붙는다', async () => {
    const { env } = createEnv()
    const response = await worker.fetch(get('/acks?code=ABC123'), env)
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
  })

  it('확인 로그는 푸시 발송과 서로 간섭하지 않는다', async () => {
    const { env, store } = createEnv()
    const phone = await createPhone()
    await worker.fetch(post('/subscribe', { code: 'ABC123', subscription: phone.subscription }), env)
    stubPushService(201)
    await worker.fetch(post('/notify', { code: 'ABC123', title: 't', body: 'b' }), env)
    await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' }), env)

    expect(store.entries.has('sub:ABC123')).toBe(true)
    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    expect(acks).toHaveLength(1)
  })
})

describe('Durable Object 로 옮긴 이유가 실제로 지켜지는가', () => {
  const ack = (env: Env, eventId: string, code = 'ABC123') =>
    worker.fetch(post('/ack', { code, eventId, state: 'confirmed' }), env)

  const acksOf = async (env: Env, code = 'ABC123', since?: string) => {
    const query = since === undefined ? '' : `&since=${encodeURIComponent(since)}`
    const response = await worker.fetch(get(`/acks?code=${code}${query}`), env)
    return (await response.json()).acks as { eventId: string; at: string }[]
  }

  it('쓴 직후 바로 읽힌다 — KV 였다면 최대 60초 안 보였다', async () => {
    const { env } = createEnv()
    await ack(env, 'evt_1')
    expect((await acksOf(env)).map((entry) => entry.eventId)).toEqual(['evt_1'])
  })

  it('같은 코드는 항상 같은 인스턴스로 간다 — 쓰기와 읽기가 만나는 지점이다', async () => {
    const { env, ackLog } = createEnv()
    await ack(env, 'evt_1')
    await acksOf(env)
    await ack(env, 'evt_2')

    expect([...ackLog.instances.keys()]).toEqual(['ABC123'])
  })

  it('코드가 다르면 인스턴스도 로그도 갈라진다', async () => {
    const { env, ackLog } = createEnv()
    await ack(env, 'evt_a', 'AAAAAA')
    await ack(env, 'evt_b', 'BBBBBB')

    expect([...ackLog.instances.keys()].sort()).toEqual(['AAAAAA', 'BBBBBB'])
    expect((await acksOf(env, 'AAAAAA')).map((entry) => entry.eventId)).toEqual(['evt_a'])
    expect((await acksOf(env, 'BBBBBB')).map((entry) => entry.eventId)).toEqual(['evt_b'])
  })

  it('대소문자가 달라도 같은 인스턴스다 — 코드 정규화가 DO 이름까지 간다', async () => {
    const { env, ackLog } = createEnv()
    await ack(env, 'evt_1', 'abc123')
    await ack(env, 'evt_2', 'ABC123')

    expect([...ackLog.instances.keys()]).toEqual(['ABC123'])
    expect((await acksOf(env)).map((entry) => entry.eventId)).toEqual(['evt_1', 'evt_2'])
  })
})

describe('고친 것 1 — 같은 밀리초에 들어온 확인이 사라지지 않는다', () => {
  it('시계가 멈춰 있어도 at 은 반드시 증가한다', async () => {
    const { env } = createEnv()
    // 두 확인이 같은 밀리초에 들어온 상황을 만든다. 예전 구현이라면 뒤엣것이 since 필터에 걸려 사라졌다
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-18T07:00:00.000Z'))

    const first = await (await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' }), env)).json()
    const second = await (await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_2', state: 'confirmed' }), env)).json()

    expect(first.at).toBe('2026-09-18T07:00:00.000Z')
    expect(second.at).toBe('2026-09-18T07:00:00.001Z')
    expect(Date.parse(second.at)).toBeGreaterThan(Date.parse(first.at))
  })

  it('첫 번째를 since 로 주면 두 번째가 보인다 — 이게 실제로 깨졌던 지점이다', async () => {
    const { env } = createEnv()
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-18T07:00:00.000Z'))

    const first = await (await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_1', state: 'confirmed' }), env)).json()
    await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_2', state: 'confirmed' }), env)

    const response = await worker.fetch(get(`/acks?code=ABC123&since=${encodeURIComponent(first.at)}`), env)
    const { acks } = await response.json()

    expect(acks.map((entry: { eventId: string }) => entry.eventId)).toEqual(['evt_2'])
  })

  it('한 밀리초에 여러 개가 몰려도 전부 서로 다른 at 을 받는다', async () => {
    const { env } = createEnv()
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-18T07:00:00.000Z'))
    const ids = Array.from({ length: 10 }, (_unused, index) => `evt_${index}`)

    await ids.reduce(async (pending, eventId) => {
      await pending
      await worker.fetch(post('/ack', { code: 'ABC123', eventId, state: 'confirmed' }), env)
    }, Promise.resolve())

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    const timestamps = acks.map((entry: { at: string }) => entry.at)
    expect(new Set(timestamps).size).toBe(10)
  })
})

describe('고친 것 2 — 동시에 들어온 확인이 묻히지 않는다', () => {
  it('한꺼번에 20개가 들어와도 하나도 안 잃는다', async () => {
    const { env } = createEnv()
    const ids = Array.from({ length: 20 }, (_unused, index) => `evt_${index}`)

    // 예전엔 읽고-고쳐-쓰기였다. 겹치면 나중 쓰기가 앞선 것을 통째로 덮어썼다
    await Promise.all(
      ids.map((eventId) => worker.fetch(post('/ack', { code: 'ABC123', eventId, state: 'confirmed' }), env)),
    )

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    expect(acks).toHaveLength(20)
    expect(new Set(acks.map((entry: { eventId: string }) => entry.eventId)).size).toBe(20)
  })

  it('동시에 들어와도 at 은 전부 다르다', async () => {
    const { env } = createEnv()
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-18T07:00:00.000Z'))
    const ids = Array.from({ length: 20 }, (_unused, index) => `evt_${index}`)

    await Promise.all(
      ids.map((eventId) => worker.fetch(post('/ack', { code: 'ABC123', eventId, state: 'confirmed' }), env)),
    )

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    expect(new Set(acks.map((entry: { at: string }) => entry.at)).size).toBe(20)
  })
})

describe('24시간 지난 확인은 치운다 — DO 에는 TTL 이 없다', () => {
  it('하루보다 오래된 건 다음 쓰기 때 사라진다', async () => {
    const { env } = createEnv()
    const now = Date.parse('2026-09-18T07:00:00.000Z')
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now - ACK_MAX_AGE_MS - 60_000)
    await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_오래된것', state: 'confirmed' }), env)

    clock.mockReturnValue(now)
    await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_최근것', state: 'confirmed' }), env)

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    expect(acks.map((entry: { eventId: string }) => entry.eventId)).toEqual(['evt_최근것'])
  })

  it('하루 안쪽은 남는다', async () => {
    const { env } = createEnv()
    const now = Date.parse('2026-09-18T07:00:00.000Z')
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now - ACK_MAX_AGE_MS + 60_000)
    await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_어제', state: 'confirmed' }), env)

    clock.mockReturnValue(now)
    await worker.fetch(post('/ack', { code: 'ABC123', eventId: 'evt_지금', state: 'confirmed' }), env)

    const { acks } = await (await worker.fetch(get('/acks?code=ABC123'), env)).json()
    expect(acks.map((entry: { eventId: string }) => entry.eventId)).toEqual(['evt_어제', 'evt_지금'])
  })
})
