/**
 * VAPID 키쌍(P-256)을 만들어 찍는다. `npm run vapid`
 *
 * 공개키는 wrangler.toml 의 vars 와 폰 구독 코드(applicationServerKey)에 같이 들어가고,
 * 개인키는 `wrangler secret put VAPID_PRIVATE_KEY` 로만 넣는다 — 파일로 남기지 않는다.
 */
import { webcrypto } from 'node:crypto'

const base64Url = (bytes) =>
  Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const { publicKey, privateKey } = await webcrypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify'],
)

const rawPublicKey = new Uint8Array(await webcrypto.subtle.exportKey('raw', publicKey))
// JWK 의 d 가 이미 base64url 로 인코딩된 32바이트 개인키라 그대로 쓴다
const { d } = await webcrypto.subtle.exportKey('jwk', privateKey)

const vapidPublicKey = base64Url(rawPublicKey)

console.log(`
VAPID_PUBLIC_KEY=${vapidPublicKey}
VAPID_PRIVATE_KEY=${d}

1) wrangler.toml 의 [vars] 에 공개키를 넣는다:

   VAPID_PUBLIC_KEY = "${vapidPublicKey}"

2) 개인키는 시크릿으로만 넣는다 (커밋 금지):

   npx wrangler secret put VAPID_PRIVATE_KEY

3) 폰 구독 페이지에서 applicationServerKey 로 쓰는 값도 공개키다:

   registration.pushManager.subscribe({
     userVisibleOnly: true,
     applicationServerKey: '${vapidPublicKey}',
   })
`)
