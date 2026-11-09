/**
 * 112 신고 안내문 (요구사항 5.4).
 *
 * 사장님이 112 에 전화해서 그대로 읽는 글이다. 백엔드에 생성 API 가 없지만
 * (docs/api-contract.md 11절) 필요한 값 — 매장 주소·시각·CCTV 위치 — 은
 * 전부 화면에 이미 있어서 PC 에서 만든다.
 *
 * 무슨 일인지(절도인지 등)와 인상착의는 쓰지 않는다. AI 는 평소와 다른 움직임만
 * 잡고 종류를 판정하지 않는다 — 사장님이 영상을 보고 직접 말한다.
 *
 * 디자인에는 '클립 링크'도 들어가지만 뺐다. 공유 링크(요구사항 5.2)가 아직 없고,
 * 지금 받을 수 있는 서명 URL 은 1시간이면 만료돼 경찰이 열 때쯤 죽어 있다.
 */

export interface PoliceReportInput {
  readonly storeName: string
  readonly address: string | null
  readonly cameraName: string | null
  /** '높음' 같은 위험도 이름 */
  readonly riskLabel: string
  readonly startedAt: string
  readonly endedAt: string
  /** 테스트용. 기본은 PC 의 현지 시간대(= 매장 시간대). */
  readonly timeZone?: string
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

/**
 * 시간대만 Intl 에 맡기고 문장은 직접 만든다. ko-KR 로케일 출력은 런타임의 ICU
 * 데이터에 따라 '오후 2:32:10' 이 되기도 'PM 2:32:10' 이 되기도 한다 — 경찰에게
 * 읽어 줄 글에 PM 이 찍히면 안 된다.
 */
const partsIn = (iso: string, timeZone: string | undefined) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso))
  const pick = (type: Intl.DateTimeFormatPartTypes): string => parts.find((part) => part.type === type)?.value ?? ''
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return {
    year: Number(pick('year')),
    month: Number(pick('month')),
    day: Number(pick('day')),
    weekday: WEEKDAY[weekdays.indexOf(pick('weekday'))] ?? '',
    hour: Number(pick('hour')),
    minute: Number(pick('minute')),
    second: Number(pick('second')),
  }
}

const koreanClock = ({ hour, minute, second }: ReturnType<typeof partsIn>): string => {
  const noon = hour < 12 ? '오전' : '오후'
  const twelve = hour % 12 === 0 ? 12 : hour % 12
  return `${noon} ${twelve}시 ${minute}분 ${second}초`
}

export const buildPoliceReport = (input: PoliceReportInput): string => {
  const start = partsIn(input.startedAt, input.timeZone)
  const end = partsIn(input.endedAt, input.timeZone)
  const day = `${start.year}년 ${start.month}월 ${start.day}일 (${start.weekday})`

  const lines = [
    '[112 신고 안내]',
    `매장: ${input.storeName}`,
    input.address
      ? `주소: ${input.address}`
      : '주소: (등록된 주소가 없습니다 — 설정 ▸ 매장 정보에서 넣어 주세요)',
    `시각: ${day} ${koreanClock(start)} ~ ${koreanClock(end)}`,
    `상황: CCTV 이상 행동 감지 (위험도 ${input.riskLabel})`,
    input.cameraName ? `CCTV 위치: ${input.cameraName}` : null,
    '',
    '※ AI가 CCTV 영상에서 감지한 의심 상황입니다. 영상 확인 필요.',
  ]

  return lines.filter((line): line is string => line !== null).join('\n')
}
