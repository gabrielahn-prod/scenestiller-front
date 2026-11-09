import { Image } from 'expo-image'

/**
 * 아이콘 — 피그마 모바일 화면의 아이콘을 24 격자 SVG 로 옮겼다.
 * 탭바는 꽉 찬 모양, 설정 줄 · 버튼 안은 선 모양이다 (피그마 그대로).
 * 아이콘 묶음 의존성을 늘리지 않고 SVG 를 그린다 — expo-image 는 웹 · 네이티브 모두 SVG 를 그린다.
 * `{c}` 는 주 색, `{k}` 는 꽉 찬 아이콘 안에 파낸 부분(대개 흰색)이다.
 */
const STROKE = (body: string) =>
  `<g fill="none" stroke="{c}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</g>`

const ICONS = {
  // ---------------------------------------------------------------- 탭바 (꽉 찬 모양)
  home: '<path fill="{c}" d="M11.1 2.9a1.4 1.4 0 0 1 1.8 0l8 6.7c.3.3.5.7.5 1.1v9.1c0 .8-.7 1.5-1.5 1.5h-4.6v-5.6c0-.6-.4-1-1-1h-4.6c-.6 0-1 .4-1 1v5.6H4.1c-.8 0-1.5-.7-1.5-1.5v-9.1c0-.4.2-.8.5-1.1Z"/>',
  records:
    '<path fill="{c}" d="M6.2 2h7.4c.4 0 .8.2 1.1.4l5.1 5.2c.3.3.4.7.4 1.1v11.1c0 1.2-1 2.2-2.2 2.2H6.2C5 22 4 21 4 19.8V4.2C4 3 5 2 6.2 2Z"/><path fill="{k}" opacity=".35" d="M14 2.4V7c0 .8.6 1.4 1.4 1.4H20Z"/><path fill="none" stroke="{k}" stroke-width="1.6" stroke-linecap="round" d="M8 13h8M8 16.6h5"/>',
  // 톱니 8개 — 모서리는 같은 색 테두리(1.5)로 둥글린다. 가운데 구멍은 evenodd 로 파낸다.
  settings:
    '<path fill="{c}" stroke="{c}" stroke-width="1.5" stroke-linejoin="round" fill-rule="evenodd" d="M10.28 5.11L10.55 2.81L13.45 2.81L13.72 5.11L15.66 5.91L17.47 4.48L19.52 6.53L18.09 8.34L18.89 10.28L21.19 10.55L21.19 13.45L18.89 13.72L18.09 15.66L19.52 17.47L17.47 19.52L15.66 18.09L13.72 18.89L13.45 21.19L10.55 21.19L10.28 18.89L8.34 18.09L6.53 19.52L4.48 17.47L5.91 15.66L5.11 13.72L2.81 13.45L2.81 10.55L5.11 10.28L5.91 8.34L4.48 6.53L6.53 4.48L8.34 5.91ZM12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z"/>',

  // ---------------------------------------------------------------- 선 아이콘
  bell: STROKE('<path d="M6.2 9.1a5.8 5.8 0 0 1 11.6 0c0 6.2 2.6 8 2.6 8H3.6s2.6-1.8 2.6-8"/><path d="M10.2 20.4a2 2 0 0 0 3.6 0"/>'),
  moon: STROKE('<path d="M20.2 14.6A8.4 8.4 0 0 1 9.4 3.8a8.4 8.4 0 1 0 10.8 10.8Z"/>'),
  alarm: STROKE(
    '<path d="M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 5.8 2.4 7.5 2.4 7.5H4s2.4-1.7 2.4-7.5"/><path d="M10.3 20.3a1.9 1.9 0 0 0 3.4 0"/><path d="M3.4 7.2A8.6 8.6 0 0 1 5.6 3.6"/><path d="M20.6 7.2a8.6 8.6 0 0 0-2.2-3.6"/>',
  ),
  phoneDevice: STROKE('<rect x="6.5" y="2.5" width="11" height="19" rx="2.4"/><path d="M10.8 18.3h2.4"/>'),
  store: STROKE(
    '<path d="M3.5 9.2 5 4.5h14l1.5 4.7"/><path d="M3.5 9.2c0 1.5 1.2 2.6 2.8 2.6s2.9-1.1 2.9-2.6c0 1.5 1.2 2.6 2.8 2.6s2.8-1.1 2.8-2.6c0 1.5 1.3 2.6 2.9 2.6s2.8-1.1 2.8-2.6"/><path d="M5 12v7.5h14V12"/><path d="M10 19.5v-4.3h4v4.3"/>',
  ),
  plusCircle: STROKE('<circle cx="12" cy="12" r="9"/><path d="M12 8.2v7.6M8.2 12h7.6"/>'),
  pin: STROKE('<path d="M19.2 10.2c0 5-7.2 11-7.2 11s-7.2-6-7.2-11a7.2 7.2 0 0 1 14.4 0Z"/><circle cx="12" cy="10.2" r="2.6"/>'),
  clock: STROKE('<circle cx="12" cy="12" r="9"/><path d="M12 7.2V12l3.2 2"/>'),
  camera: STROKE(
    '<path d="M9.2 4.5h5.6l1.8 2.4h2.6c1.1 0 2 .9 2 2v8.6c0 1.1-.9 2-2 2H4.8c-1.1 0-2-.9-2-2V8.9c0-1.1.9-2 2-2h2.6Z"/><circle cx="12" cy="13.1" r="3.4"/>',
  ),
  monitor: STROKE('<rect x="2.8" y="3.8" width="18.4" height="12.6" rx="1.8"/><path d="M8.5 20.2h7M12 16.4v3.8"/>'),
  chevronRight: STROKE('<path d="m9.5 6 6 6-6 6"/>'),
  chevronLeft: STROKE('<path d="m14.5 5-7 7 7 7"/>'),
  chevronDown: STROKE('<path d="m6 9.5 6 6 6-6"/>'),
  chevronUp: STROKE('<path d="m6 14.5 6-6 6 6"/>'),
  share: STROKE('<path d="M12.5 3.8H6c-1.2 0-2.2 1-2.2 2.2v12c0 1.2 1 2.2 2.2 2.2h12c1.2 0 2.2-1 2.2-2.2v-6.5"/><path d="M20.2 3.8 11.6 12.4"/><path d="M15.2 3.8h5v5"/>'),
  expand: STROKE('<path d="M4.5 9V4.5H9M4.5 4.5l5 5M19.5 9V4.5H15M19.5 4.5l-5 5M4.5 15v4.5H9M4.5 19.5l5-5M19.5 15v4.5H15M19.5 19.5l-5-5"/>'),
  playOutline: STROKE('<path d="M7.5 4.8v14.4c0 .6.7 1 1.2.7l11-7.2a.8.8 0 0 0 0-1.4l-11-7.2c-.5-.3-1.2 0-1.2.7Z"/>'),
  upload: STROKE('<path d="M12 15.2V3.6"/><path d="m7.4 8.2 4.6-4.6 4.6 4.6"/><path d="M4.2 14.8v3.4c0 1.2 1 2.2 2.2 2.2h11.2c1.2 0 2.2-1 2.2-2.2v-3.4"/>'),
  warning: STROKE('<path d="M10.4 4.2 2.9 17.4a1.8 1.8 0 0 0 1.6 2.7h15a1.8 1.8 0 0 0 1.6-2.7L13.6 4.2a1.8 1.8 0 0 0-3.2 0Z"/><path d="M12 9.5v4.2M12 16.8h.01"/>'),
  check: STROKE('<path d="m5 12.6 4.6 4.6L19 7.8"/>'),
  close: STROKE('<path d="M6 6l12 12M18 6 6 18"/>'),
  plus: STROKE('<path d="M12 5v14M5 12h14"/>'),

  // ---------------------------------------------------------------- 꽉 찬 아이콘
  play: '<path fill="{c}" d="M8 5.1v13.8c0 .8.9 1.3 1.6.9l10.6-6.9a1 1 0 0 0 0-1.8L9.6 4.2C8.9 3.8 8 4.3 8 5.1Z"/>',
  phone:
    '<path fill="{c}" d="M6.9 3.2c.4 0 .8.3.9.7l1 3.3c.1.4 0 .8-.3 1.1l-1.7 1.4a13.6 13.6 0 0 0 7.5 7.5l1.4-1.7c.3-.3.7-.4 1.1-.3l3.3 1c.4.1.7.5.7.9v3.2c0 .6-.5 1.1-1.1 1.1C10.4 21.4 2.6 13.6 2.6 4.3c0-.6.5-1.1 1.1-1.1Z"/>',
  checkCircle:
    '<circle cx="12" cy="12" r="10" fill="{c}"/><path fill="none" stroke="{k}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" d="m7.6 12.3 3 3 5.8-6.1"/>',
  siren:
    '<path fill="{c}" d="M7.2 17.2v-5.4a4.8 4.8 0 0 1 9.6 0v5.4Z"/><rect x="5" y="17.6" width="14" height="2.8" rx="1" fill="{c}"/><path fill="none" stroke="{c}" stroke-width="1.7" stroke-linecap="round" d="M12 2.6v2M4.7 5.5l1.4 1.4M19.3 5.5l-1.4 1.4M2.6 11.8h2M19.4 11.8h2"/><path fill="none" stroke="{k}" stroke-width="1.5" stroke-linecap="round" d="M10 11.6a2 2 0 0 1 2-2"/>',
  shieldCheck:
    '<path fill="{c}" d="M11.4 2.3a1.6 1.6 0 0 1 1.2 0l6.2 2.5c.6.2 1 .8 1 1.5v4.8c0 4.7-3.2 8.8-7.4 10.4a1.6 1.6 0 0 1-.8 0c-4.2-1.6-7.4-5.7-7.4-10.4V6.3c0-.7.4-1.3 1-1.5Z"/><path fill="none" stroke="{k}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="m8.6 12.1 2.4 2.4 4.4-4.6"/>',
  document:
    '<path fill="{c}" d="M6.4 2.4h7.2c.4 0 .8.2 1.1.4l4.8 4.9c.3.3.5.7.5 1.1v11c0 1.1-.9 2-2 2H6.4c-1.1 0-2-.9-2-2V4.4c0-1.1.9-2 2-2Z"/><path fill="none" stroke="{k}" stroke-width="1.6" stroke-linecap="round" d="M8.2 12.4h7.6M8.2 16h5"/><path fill="{k}" opacity=".45" d="M13.8 2.8V7c0 .8.6 1.4 1.4 1.4h4.4Z"/>',
} as const

export type IconName = keyof typeof ICONS

const uri = (name: IconName, color: string, inner: string): string =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">${ICONS[name]
      .replaceAll('{c}', color)
      .replaceAll('{k}', inner)}</svg>`,
  )}`

export const Icon = ({
  name,
  color,
  size = 24,
  inner = '#FFFFFF',
}: {
  name: IconName
  color: string
  size?: number
  /** 꽉 찬 아이콘 안쪽(파낸 곳) 색 */
  inner?: string
}) => (
  <Image source={{ uri: uri(name, color, inner) }} style={{ width: size, height: size }} contentFit="contain" accessible={false} />
)
