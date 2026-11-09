/**
 * 두 데모 셸(`/` 가짜 서버 데모, `/wanted-test` 실서버 데모)이 같이 쓰는 뼈대.
 * 창 맞춤·접는 카드·휴대폰 안내는 가짜 서버 데모만 쓴다 — 실서버 데모는 앱 화면만 보인다.
 */

export const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id)
  if (!el) throw new Error(`#${id} 가 없습니다`)
  return el as T
}

/**
 * 앱 안의 주소. 셸이 `/` 에 있든 `/wanted-test` 에 있든 같은 곳을 가리키게
 * 상대 경로가 아니라 배포 기준 경로(BASE_URL)에서 만든다.
 */
export const appUrl = (path: string): string =>
  new URL(path, `${location.origin}${import.meta.env.BASE_URL}`).href

const PC_WIDTH = 1280
const PC_HEIGHT = 860

/**
 * PC 앱은 데스크톱 창을 전제로 만든 화면이라 좁히면 상단 메뉴가 줄바꿈된다.
 * 고정 폭으로 그리고 창에 맞춰 통째로 줄인다. 창이 바뀌면 다시 계산한다.
 */
export const fitPcFrame = (frame: HTMLIFrameElement): void => {
  frame.style.width = `${PC_WIDTH}px`
  frame.style.height = `${PC_HEIGHT}px`

  const apply = (): void => {
    const scale = Math.min(globalThis.innerWidth / PC_WIDTH, globalThis.innerHeight / PC_HEIGHT)
    frame.style.transform = `scale(${scale})`
  }

  apply()
  globalThis.addEventListener('resize', apply)
}

/** 접혀 있는 카드. 필요한 사람만 펼친다. */
export const setupCollapsible = (toggle: HTMLButtonElement, body: HTMLElement): void => {
  toggle.addEventListener('click', () => {
    body.hidden = !body.hidden
    toggle.setAttribute('aria-expanded', String(!body.hidden))
  })
}

/**
 * 좁은 화면이면 PC 앱 대신 모바일 앱으로 안내한다.
 * 이 주소가 대회 사이트에 걸리는 링크라 심사위원이 폰으로 먼저 열 수 있다.
 */
export const watchViewport = (handoff: HTMLElement, link: HTMLAnchorElement, phoneUrl: string): void => {
  const narrowScreen = globalThis.matchMedia?.('(max-width: 720px)')
  link.href = phoneUrl

  const apply = (narrow: boolean): void => {
    handoff.hidden = !narrow
  }

  apply(narrowScreen?.matches ?? false)
  narrowScreen?.addEventListener('change', (event) => apply(event.matches))
}

/** iframe 안의 PC 앱이 손잡이를 열어 둘 때까지 기다린다. 로드 직후에는 아직 없다. */
export const waitForFrameValue = async <T>(
  frame: HTMLIFrameElement,
  read: (window: Window) => T | undefined,
  timeoutMs = 20_000,
): Promise<T | null> => {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const value = frame.contentWindow ? read(frame.contentWindow) : undefined
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  return null
}
