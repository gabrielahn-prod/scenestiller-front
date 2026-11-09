import qrcode from 'qrcode-generator'
import { $, appUrl, fitPcFrame, setupCollapsible, waitForFrameValue, watchViewport } from './shell'

/**
 * 데모 진행기.
 *
 * 하는 일은 셋뿐이다 — 휴대폰과 이어 줄 코드를 QR 로 보여 주고, iframe 안의 PC 앱에게
 * 시나리오를 시키고, 위험이 잡히는 순간 그 휴대폰으로 알림을 쏜다.
 *
 * PC 앱은 같은 출처의 iframe 이라 contentWindow 를 그대로 만질 수 있다. 앱이 개발용으로
 * 열어 둔 `window.__sceneStealer` 를 쓰면 되므로 앱 쪽에 데모 전용 배선을 더 넣을 필요가 없다.
 */

interface ScenarioStep {
  readonly phase: 'streaming' | 'segment' | 'risk'
  readonly label: string
  readonly detail?: string
}

type AckState = 'confirmed' | 'false_positive'

interface Ack {
  readonly eventId: string
  readonly state: AckState
  readonly at: string
}

interface DemoHook {
  readonly isDemo?: boolean
  startScenario?: () => void
  stopScenario?: () => void
  triggerRisk?: (options?: { cameraId?: string; risk?: 'high' | 'medium' | 'low' }) => {
    eventId: string
    cameraName: string
    at: string
  }
  emitRiskEvent?: (input?: { risk?: 'high' | 'medium' | 'low' }) => { id: string; cameraName?: string }
  onScenario?: (listener: (step: ScenarioStep) => void) => () => void
  applyState?: (eventId: string, state: AckState) => Promise<boolean>
}

const renderQr = (container: HTMLElement, url: string): void => {
  const qr = qrcode(0, 'M')
  qr.addData(url)
  qr.make()
  container.innerHTML = qr.createSvgTag({ margin: 0, scalable: true })
}

const PUSH_ENDPOINT = (import.meta.env.VITE_PUSH_ENDPOINT ?? '').replace(/\/+$/, '')

/**
 * 페어링 코드 6자리. 서버가 [A-Z0-9]{6} 만 받는데
 * `Math.random().toString(36).slice(2, 8)` 은 운이 나쁘면 6자리가 안 나온다.
 * 헷갈리는 글자(I·L·O·0·1)는 뺐다 — 심사위원이 눈으로 옮겨 적을 수도 있다.
 */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

const makeCode = (): string => {
  const bytes = new Uint8Array(6)
  globalThis.crypto.getRandomValues(bytes)
  return [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

const code = makeCode()

/** 휴대폰이 열 주소. 앱은 이 코드로 자기 구독을 등록하고, 우리는 같은 코드로 알림을 쏜다. */
const phoneUrl = appUrl(`m/?code=${code}`)

/** iframe 안의 PC 앱이 준비될 때까지 기다린다. 로드 직후에는 아직 훅이 없다. */
const waitForPcApp = (frame: HTMLIFrameElement): Promise<DemoHook | null> =>
  waitForFrameValue(frame, (window) => (window as Window & { __sceneStealer?: DemoHook }).__sceneStealer)

type NotifyResult = 'sent' | 'no-phone' | 'no-server' | 'failed'

const notifyPhone = async (title: string, body: string, eventId: string): Promise<NotifyResult> => {
  if (!PUSH_ENDPOINT) return 'no-server'
  try {
    const response = await fetch(`${PUSH_ENDPOINT}/notify`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code, title, body, data: { eventId } }),
    })
    if (response.ok) return 'sent'
    return response.status === 404 || response.status === 410 ? 'no-phone' : 'failed'
  } catch {
    return 'failed'
  }
}

/**
 * 휴대폰이 QR 을 찍고 알림을 허용했는지 확인한다.
 * 이게 없으면 심사위원은 위험 버튼을 눌러 실패해 봐야 연결이 안 됐다는 걸 안다.
 */
const waitForPhone = (onConnected: () => void): (() => void) => {
  if (!PUSH_ENDPOINT) return () => undefined
  let stopped = false
  const poll = async (): Promise<void> => {
    while (!stopped) {
      try {
        const response = await fetch(`${PUSH_ENDPOINT}/subscribed?code=${code}`)
        const body = (await response.json()) as { subscribed?: boolean }
        if (body.subscribed) return onConnected()
      } catch {
        // 네트워크가 잠깐 끊겨도 계속 본다 — 심사 도중 조용히 멈추면 안 된다.
      }
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
  }
  void poll()
  return () => {
    stopped = true
  }
}

const ACK_LABEL: Record<AckState, string> = { confirmed: '확인', false_positive: '오탐' }

/**
 * 휴대폰에서 처리한 것을 받아 이 PC 에도 반영한다.
 * 서버가 없으면 아무 일도 하지 않는다 — 나머지 시연은 서버 없이도 끝까지 돈다.
 */
const watchAcks = (onAck: (ack: Ack) => void): void => {
  if (!PUSH_ENDPOINT) return
  const seen = { since: new Date().toISOString() }
  const poll = async (): Promise<void> => {
    for (;;) {
      try {
        const response = await fetch(`${PUSH_ENDPOINT}/acks?code=${code}&since=${encodeURIComponent(seen.since)}`)
        const body = (await response.json()) as { acks?: Ack[] }
        body.acks?.forEach((ack) => {
          seen.since = ack.at
          onAck(ack)
        })
      } catch {
        // 잠깐 끊겨도 계속 본다.
      }
      await new Promise((resolve) => setTimeout(resolve, 2500))
    }
  }
  void poll()
}

const NOTIFY_MESSAGE: Record<NotifyResult, string> = {
  sent: '휴대폰으로 알림을 보냈습니다. 잠금화면을 확인해 주세요.',
  'no-phone': '휴대폰이 아직 연결되지 않았습니다. 1번의 QR 을 먼저 찍어 주세요.',
  'no-server': '이 배포에는 알림 서버가 연결돼 있지 않아, 휴대폰 화면 안에서만 알림이 보입니다.',
  failed: '알림을 보내지 못했습니다. 잠시 후 다시 눌러 주세요.',
}

/**
 * 영상 안에서 이상 행동이 일어나는 시각(데모 시작 후 초).
 * 테스트셋 영상이 들어오면 실제 이상행동이 일어나는 초로 이 숫자만 바꾸면 된다.
 * 심사위원이 아무것도 누르지 않아도 보고만 있으면 폰이 울리게 하는 것이 목적이다.
 */
interface ScheduledAlert {
  readonly atSeconds: number
  readonly cameraId: string
  readonly risk: 'high' | 'medium'
  /**
   * 휴대폰 앱이 아는 사건 번호. 두 앱은 같은 뼈대 데이터로 심어져 있어서
   * ev-1 은 양쪽 모두 '계산대 · 높음' 이다. 그래서 알림을 탭하면 곧바로 그 사건이 열린다.
   */
  readonly phoneEventId: string
}

const ALERT_SCHEDULE: readonly ScheduledAlert[] = [
  { atSeconds: 14, cameraId: 'cam-01', risk: 'high', phoneEventId: 'ev-1' },
  { atSeconds: 52, cameraId: 'cam-02', risk: 'medium', phoneEventId: 'ev-2' },
]

const RISK_LABEL = { high: '높음', medium: '보통' } as const

const main = async (): Promise<void> => {
  renderQr($('qr'), phoneUrl)
  $('code').textContent = code
  setupCollapsible($<HTMLButtonElement>('phone-toggle'), $('phone-body'))
  watchViewport($('handoff'), $<HTMLAnchorElement>('open-phone'), phoneUrl)
  fitPcFrame($<HTMLIFrameElement>('pc'))

  const hook = await waitForPcApp($<HTMLIFrameElement>('pc'))
  if (!hook) return

  const status = $('phone-status')
  status.textContent = PUSH_ENDPOINT
    ? 'QR 을 찍고 알림을 허용하면 준비가 끝납니다.'
    : '알림 서버 없이 도는 배포라, 휴대폰에서는 페이지를 열어 둔 동안 알림이 보입니다.'

  waitForPhone(() => {
    status.textContent = '휴대폰이 연결되었습니다. 이제 화면을 꺼도 알림이 갑니다.'
    status.className = 'sub ok'
    $('phone-dot').classList.add('ready')
  })

  /** 휴대폰이 아는 번호 → 이 PC 가 만든 번호. 휴대폰에서 처리한 걸 되돌려 반영할 때 쓴다. */
  const pairedEvents = new Map<string, string>()

  const raiseRisk = async (alert: ScheduledAlert): Promise<void> => {
    const event = hook.triggerRisk?.({ cameraId: alert.cameraId, risk: alert.risk })
    if (event) pairedEvents.set(alert.phoneEventId, event.eventId)
    await notifyPhone(
      `강남 1호점 · ${event?.cameraName ?? '계산대'}`,
      `이상 행동이 감지되었습니다 · 위험도 ${RISK_LABEL[alert.risk]}`,
      alert.phoneEventId,
    )
  }

  // 들어오자마자 돈다. 심사위원이 누를 것은 없다.
  ALERT_SCHEDULE.forEach((alert) => {
    setTimeout(() => void raiseRisk(alert), alert.atSeconds * 1000)
  })

  watchAcks(async (ack) => {
    const pcEventId = pairedEvents.get(ack.eventId)
    if (pcEventId) await hook.applyState?.(pcEventId, ack.state)
  })
}

void main()
