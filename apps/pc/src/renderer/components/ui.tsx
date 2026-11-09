/**
 * 디자인시스템 4장 '컴포넌트'를 그대로 옮긴 것.
 * 값의 단일 출처는 design/씬스틸러 디자인시스템.dc.html 이고, 여기 숫자는 전부
 * 그 파일의 인라인 스타일에서 왔다. 임의로 바꾸지 않는다.
 *
 * 디자인에 없는 상태(hover/active/disabled)는 같은 팔레트 안에서 고르고
 * 왜 그 값인지 한 줄씩 남겼다. 모든 상태는 /dev/components 에서 눈으로 볼 수 있다.
 */
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '../lib/cn'

/* ------------------------------------------------------------------ Button */

export type ButtonVariant =
  | 'primary' // navy r12 — 흐름을 끝내는 버튼 1개 ("감시 시작")
  | 'action' // blue r8 — 페이지 안 주요 액션 ("+ 카메라 추가")
  | 'secondary' // outline — 부수 액션 ("클립 저장")
  | 'danger' // error/600 — 112 신고
  | 'danger-outline' // outline — 삭제
  | 'link' // 텍스트 링크 ("전체 기록 보기")

const VARIANT: Record<ButtonVariant, string> = {
  // navy 는 팔레트에 더 어두운 단계가 없다. 아주 어두운 면은 더 어둡게 해도
  // 차이가 보이지 않으므로 밝기를 올려 hover 를, 낮춰 눌림을 표현한다.
  primary: cn(
    'bg-brand-main text-white rounded-card px-6 py-3 text-body',
    'hover:brightness-125 active:brightness-95',
  ),
  // blue/600·800 은 팔레트에 있는 다음 단계다 (1장 Blue 50–900).
  action: cn(
    'bg-brand-sub text-white rounded-small px-5 py-2.5 text-[15px] font-semibold',
    'hover:bg-blue-700 active:bg-blue-800',
  ),
  secondary: cn(
    'bg-surface text-gray-900 rounded-small px-5 py-2.5 text-[15px] font-semibold',
    'shadow-[inset_0_0_0_1px_var(--gray-300)]',
    'hover:bg-gray-50 active:bg-gray-100',
  ),
  danger: cn(
    'bg-error-600 text-white rounded-small px-5 py-2.5 text-[15px] font-semibold',
    'hover:bg-error-700 active:bg-error-800',
  ),
  'danger-outline': cn(
    'bg-surface text-error-main rounded-small px-5 py-2.5 text-[15px] font-semibold',
    'shadow-[inset_0_0_0_1px_var(--error-300)]',
    'hover:bg-error-50 active:bg-error-100',
  ),
  link: cn(
    'text-brand-sub text-[15px] font-semibold underline',
    'hover:text-blue-700 active:text-blue-800',
  ),
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: ButtonVariant
  /** 진행 중. 디자인의 'loading = gray/300' 상태이고 클릭을 막는다. */
  readonly loading?: boolean
}

export const Button = ({
  variant = 'secondary',
  loading = false,
  className,
  disabled,
  children,
  ...props
}: ButtonProps) => (
  <button
    type="button"
    disabled={disabled || loading}
    className={cn(
      'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition',
      // 디자인 4장: loading = gray/300. disabled 도 같은 처리를 쓴다 —
      // 둘 다 "지금 누를 수 없다"는 같은 뜻이라 두 모양을 만들 이유가 없다.
      'disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-white',
      'disabled:shadow-none disabled:hover:brightness-100',
      VARIANT[variant],
      // loading 은 디자인상 navy 버튼과 같은 크기(r12)로 그려져 있다.
      loading && 'rounded-card px-6 py-3 text-body',
      className,
    )}
    {...props}
  >
    {loading && <Spinner className="size-4" />}
    {children}
  </button>
)

/* ------------------------------------------------------------------- Input */

export type InputState = 'default' | 'error' | 'done'

const INPUT_RING: Record<InputState, string> = {
  default: 'shadow-[inset_0_0_0_1px_var(--gray-500)] bg-surface',
  error: 'shadow-[inset_0_0_0_1px_var(--error-500)] bg-surface',
  // done = 회색 채움 (디자인시스템 4장 'RTSP 주소' 샘플)
  done: 'shadow-[inset_0_0_0_1px_var(--gray-300)] bg-gray-100',
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  readonly label?: string
  readonly error?: string | null
  readonly hint?: ReactNode
  readonly state?: InputState
  /** done 상태에서 오른쪽에 붙는 표시. 디자인의 초록 ✓ 자리. */
  readonly adornment?: ReactNode
}

export const Input = ({
  label,
  error,
  hint,
  state,
  adornment,
  className,
  ...props
}: InputProps) => {
  const resolved: InputState = error ? 'error' : (state ?? 'default')
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="text-body-sm font-semibold text-gray-900">{label}</span>}
      <div
        className={cn(
          'flex h-input items-center gap-2 rounded-card px-4',
          'focus-within:shadow-[inset_0_0_0_1px_var(--blue-600)]',
          INPUT_RING[resolved],
        )}
      >
        <input
          className={cn(
            // w-full: 입력 칸의 기본 폭(size=20)이 격자 칸의 최소 폭이 되지 않게 한다.
            // 그대로 두면 2b '아이디 · 비밀번호' 줄이 가운데 패널을 넓혀 오른쪽 패널이 창 밖으로 밀린다.
            'w-full min-w-0 flex-1 bg-transparent text-[15px] text-gray-900 outline-none',
            'placeholder:text-gray-600 disabled:text-gray-600',
          )}
          {...props}
        />
        {adornment}
      </div>
      {error && <span className="text-caption text-error-main">{error}</span>}
      {!error && hint && <span className="text-caption text-gray-600">{hint}</span>}
    </label>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  readonly label?: string
}

export const Textarea = ({ label, className, ...props }: TextareaProps) => (
  <label className={cn('flex flex-col gap-1.5', className)}>
    {label && <span className="text-body-sm font-semibold text-gray-900">{label}</span>}
    <textarea
      className={cn(
        'min-h-24 rounded-card bg-surface px-4 py-3 text-[15px] text-gray-900 outline-none',
        'shadow-[inset_0_0_0_1px_var(--gray-500)]',
        'focus:shadow-[inset_0_0_0_1px_var(--blue-600)]',
        'placeholder:text-gray-600',
      )}
      {...props}
    />
  </label>
)

/* --------------------------------------------------------------------- Tag */

export type TagTone =
  | 'high'
  | 'medium'
  | 'low'
  | 'alert' // 디자인시스템의 빨간 연한 태그 — 미확인 개수 배지
  | 'unconfirmed'
  | 'confirmed'
  | 'false-positive'
  | 'neutral'

const TAG: Record<TagTone, string> = {
  high: 'bg-risk-high text-white',
  medium: 'bg-risk-medium-surface text-risk-medium-text',
  low: 'bg-gray-100 text-gray-700',
  alert: 'bg-error-50 text-error-main',
  unconfirmed: 'bg-blue-100 text-brand-sub',
  confirmed: 'bg-success-50 text-success-600',
  'false-positive': 'bg-gray-100 text-gray-600 line-through',
  // 디자인에 없는 중립 태그. 위치 태그처럼 의미 없는 라벨에 쓰려고 '낮음'과
  // 같은 gray/100 배경에 gray/600 글자를 골랐다.
  neutral: 'bg-gray-100 text-gray-600',
}

export const Tag = ({
  tone,
  className,
  children,
}: {
  tone: TagTone
  className?: string
  children: ReactNode
}) => (
  <span
    className={cn(
      'inline-flex items-center whitespace-nowrap rounded-chip px-3 py-1 text-caption font-semibold',
      TAG[tone],
      className,
    )}
  >
    {children}
  </span>
)

/* --------------------------------------------------------------- StatusDot */

export type StatusTone = 'connected' | 'reconnecting' | 'disconnected' | 'idle'

const STATUS_COLOR: Record<StatusTone, string> = {
  connected: 'bg-success-500',
  reconnecting: 'bg-risk-medium',
  disconnected: 'bg-risk-high',
  idle: 'bg-gray-500',
}

export const StatusDot = ({ tone, className }: { tone: StatusTone; className?: string }) => (
  <span className={cn('inline-block size-2 shrink-0 rounded-full', STATUS_COLOR[tone], className)} />
)

export const StatusLabel = ({
  tone,
  children,
  className,
}: {
  tone: StatusTone
  children: ReactNode
  className?: string
}) => (
  <span className={cn('inline-flex items-center gap-1.5 text-body-sm', className)}>
    <StatusDot tone={tone} />
    {children}
  </span>
)

/* ------------------------------------------------------------------ Toggle */

interface ToggleProps {
  readonly checked: boolean
  readonly onChange: (next: boolean) => void
  readonly disabled?: boolean
  readonly label?: string
}

export const Toggle = ({ checked, onChange, disabled = false, label }: ToggleProps) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={cn(
      'relative inline-block h-6 w-11 shrink-0 rounded-chip transition',
      checked ? 'bg-brand-sub' : 'bg-gray-300',
      // 켜진 채 잠긴 토글. 2g 디자인은 켜진 채 gray/500 으로 칠한다 —
      // 손잡이는 켜짐 자리에 두고 색만 빼서 "켜져 있지만 바꿀 수 없다"를 보인다.
      disabled && 'cursor-not-allowed',
      disabled && checked && 'bg-gray-500',
      disabled && !checked && 'opacity-50',
    )}
  >
    <span
      className={cn(
        'absolute top-0.5 size-5 rounded-full bg-white transition-all',
        checked ? 'right-0.5' : 'left-0.5',
      )}
    />
  </button>
)

/* --------------------------------------------------------------- Segmented */

export interface SegmentedOption<T extends string> {
  readonly value: T
  readonly label: ReactNode
}

export const Segmented = <T extends string>({
  options,
  value,
  onChange,
  fill = false,
  className,
}: {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (next: T) => void
  /** 폭을 꽉 채우고 칸을 똑같이 나눈다 (2f 상태 선택). */
  fill?: boolean
  className?: string
}) => (
  <div
    className={cn(
      'inline-flex gap-0.5 rounded-small bg-gray-100 p-1',
      fill ? 'flex w-full' : 'self-start',
      className,
    )}
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        onClick={() => onChange(option.value)}
        className={cn(
          'rounded-[6px] px-3.5 py-1.5 text-body-sm transition',
          fill && 'flex-1 p-2 text-center',
          option.value === value
            ? 'bg-surface font-semibold text-gray-900 shadow-segment'
            : 'font-medium text-gray-600 hover:text-gray-900',
        )}
      >
        {option.label}
      </button>
    ))}
  </div>
)

/* -------------------------------------------------------------- Pagination */

export const Pagination = ({
  page,
  pageCount,
  onChange,
}: {
  page: number
  pageCount: number
  onChange: (next: number) => void
}) => {
  const cell = 'flex size-9 items-center justify-center rounded-small transition'
  const quiet = cn(cell, 'bg-surface text-gray-600 shadow-card hover:text-gray-900')
  return (
    <div className="flex gap-2">
      <button
        type="button"
        className={cn(quiet, 'disabled:opacity-40')}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="이전"
      >
        ‹
      </button>
      {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
        <button
          key={number}
          type="button"
          onClick={() => onChange(number)}
          className={cn(number === page ? cn(cell, 'bg-brand-sub font-semibold text-white') : quiet)}
        >
          {number}
        </button>
      ))}
      <button
        type="button"
        className={cn(quiet, 'disabled:opacity-40')}
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
        aria-label="다음"
      >
        ›
      </button>
    </div>
  )
}

/* -------------------------------------------------------------------- Card */

export const Card = ({
  className,
  children,
}: {
  className?: string
  children: ReactNode
}) => (
  <section className={cn('rounded-card bg-surface p-6 shadow-card', className)}>{children}</section>
)

export const CardTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <h2 className={cn('text-h2 text-gray-900', className)}>{children}</h2>
)

/* -------------------------------------------------------------- Video area */

/**
 * 영상이 들어갈 자리. 디자인시스템 4장 "영상 영역은 gray/800".
 * 사선 줄무늬는 PC 앱 디자인의 .vid 규칙 그대로 — 화면이 오기 전에도 '영상 자리'로 읽힌다.
 */
export const VideoSurface = ({
  className,
  children,
}: {
  className?: string
  children?: ReactNode
}) => (
  <div
    className={cn(
      'relative flex aspect-video w-full items-center justify-center overflow-hidden',
      'bg-video text-caption text-gray-500',
      'bg-[length:24px_24px]',
      'bg-[linear-gradient(135deg,rgb(255_255_255/.04)_25%,transparent_25%,transparent_50%,rgb(255_255_255/.04)_50%,rgb(255_255_255/.04)_75%,transparent_75%)]',
      className,
    )}
  >
    {children}
  </div>
)

/** 영상 위 좌상단 라벨. 라이브 배지는 반투명 검정, 위험 배지는 error/600. */
export const VideoBadge = ({
  tone = 'live',
  children,
}: {
  tone?: 'live' | 'danger'
  children: ReactNode
}) => (
  <span
    className={cn(
      'absolute left-2 top-2 rounded-[4px] px-1.5 py-0.5 text-[11px] text-white',
      tone === 'live'
        ? 'bg-[var(--video-label-bg)]'
        : 'bg-risk-high font-semibold',
    )}
  >
    {children}
  </span>
)

/* -------------------------------------------------------------- CameraTile */

interface CameraTileProps {
  readonly name: string
  readonly status: StatusTone
  readonly statusLabel: string
  /** 좌상단 배지. 예: "CAM 01 · LIVE" */
  readonly badge?: string
  readonly children?: ReactNode
  readonly onClick?: () => void
  readonly className?: string
}

export const CameraTile = ({
  name,
  status,
  statusLabel,
  badge,
  children,
  onClick,
  className,
}: CameraTileProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={cn(
      'overflow-hidden rounded-card bg-gray-100 text-left',
      'shadow-[inset_0_0_0_1px_var(--gray-300)]',
      // 끊긴 카메라는 error/300 테두리로 표시한다 (2c 명세).
      status === 'disconnected' && 'shadow-[inset_0_0_0_1px_var(--error-300)]',
      onClick && 'transition hover:shadow-[inset_0_0_0_2px_var(--blue-600)]',
      className,
    )}
  >
    <VideoSurface>
      {badge && <VideoBadge>{badge}</VideoBadge>}
      {children}
    </VideoSurface>
    <div className="flex items-center justify-between px-2.5 py-2 text-caption font-semibold">
      <span className="truncate text-gray-900">{name}</span>
      <span className="flex shrink-0 items-center gap-1.5 font-medium text-gray-600">
        <StatusDot tone={status} className="size-[7px]" />
        {statusLabel}
      </span>
    </div>
  </button>
)

/** 아직 카메라가 없는 자리. 매장당 8대 제한을 눈으로 보여준다 (2c). */
export const EmptyCameraSlot = ({ onClick }: { onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={cn(
      'flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-card',
      'border border-dashed border-gray-300 bg-surface text-gray-600',
      onClick && 'transition hover:border-brand-sub hover:text-brand-sub',
      !onClick && 'opacity-60',
    )}
  >
    <span className="text-h3">+</span>
    <span className="text-caption">카메라 추가</span>
  </button>
)

/* ---------------------------------------------------------------- RiskCard */

export type RiskLevel = 'high' | 'medium' | 'low'
export type EventState = 'unconfirmed' | 'confirmed' | 'false_positive'

const RISK_LABEL: Record<RiskLevel, string> = { high: '높음', medium: '보통', low: '낮음' }
const RISK_TEXT: Record<RiskLevel, string> = {
  high: 'text-error-main',
  medium: 'text-risk-medium-text',
  low: 'text-gray-700',
}

export const riskLabel = (risk: RiskLevel): string => RISK_LABEL[risk]

interface RiskCardProps {
  readonly title: string
  readonly risk: RiskLevel
  readonly state: EventState
  readonly cameraName: string
  readonly time: string
  readonly thumbnailUrl?: string | null
  readonly onClick?: () => void
  readonly className?: string
}

export const RiskCard = ({
  title,
  risk,
  state,
  cameraName,
  time,
  thumbnailUrl,
  onClick,
  className,
}: RiskCardProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={cn(
      'w-full overflow-hidden rounded-card bg-surface text-left transition',
      risk === 'high'
        ? 'bg-error-50 shadow-[inset_0_0_0_2px_var(--error-600)]'
        : 'shadow-card',
      // 확인된 건 흐리게, 오탐은 취소선 — 2c 피드 명세.
      state === 'confirmed' && 'opacity-60',
      onClick && 'hover:shadow-[inset_0_0_0_2px_var(--blue-600)]',
      className,
    )}
  >
    <VideoSurface>
      {thumbnailUrl ? (
        <img src={thumbnailUrl} alt="" className="size-full object-cover" />
      ) : null}
      {risk === 'high' && <VideoBadge tone="danger">위험 감지</VideoBadge>}
    </VideoSurface>
    <div className="px-2.5 py-2">
      <div
        className={cn(
          'flex items-center gap-1.5 text-caption',
          state === 'false_positive' && 'line-through',
        )}
      >
        <b className="text-gray-900">{title}</b>
        <span className={cn('font-semibold', RISK_TEXT[risk])}>{RISK_LABEL[risk]}</span>
      </div>
      <div className="mt-0.5 text-[12px] text-gray-600">
        {cameraName} · {time} · {STATE_LABEL[state]}
      </div>
    </div>
  </button>
)

export const STATE_LABEL: Record<EventState, string> = {
  unconfirmed: '미확인',
  confirmed: '확인됨',
  false_positive: '오탐',
}

export const STATE_TONE: Record<EventState, TagTone> = {
  unconfirmed: 'unconfirmed',
  confirmed: 'confirmed',
  false_positive: 'false-positive',
}

/* ------------------------------------------------------------------- 기타 */

export const Spinner = ({ className }: { className?: string }) => (
  <span
    className={cn(
      'inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent',
      className,
    )}
    role="status"
    aria-label="불러오는 중"
  />
)

export const Notice = ({
  tone,
  children,
  className,
}: {
  tone: 'info' | 'warn' | 'bad'
  children: ReactNode
  className?: string
}) => (
  <div
    className={cn(
      'rounded-card px-4 py-3 text-body-sm leading-normal',
      tone === 'info' && 'bg-blue-50 text-blue-800',
      // 경고는 위험도 '보통'과 같은 색을 쓴다 — 화면 안에서 같은 무게로 읽혀야 한다.
      tone === 'warn' && 'bg-risk-medium-surface text-risk-medium-text',
      tone === 'bad' && 'bg-error-50 text-error-main',
      className,
    )}
  >
    {children}
  </div>
)

export const Stat = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <span className="text-caption text-gray-600">{label}</span>
    <span className="text-h3 text-gray-900">{value}</span>
  </div>
)

/* ------------------------------------------------------------ SelectButton */

export interface SelectOption<T extends string> {
  readonly value: T
  readonly label: string
}

/**
 * 2e 필터의 '기간: 오늘 ▾' 버튼. 모양은 secondary 버튼(.bs) 그대로 두고, 그 위에
 * 투명한 네이티브 <select> 를 겹친다 — 드롭다운을 직접 만들면 키보드·스크린리더
 * 처리를 다시 짜야 한다.
 */
export const SelectButton = <T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: readonly SelectOption<T>[]
  onChange: (next: T) => void
  className?: string
}) => {
  const current = options.find((option) => option.value === value)?.label ?? ''
  return (
    <label
      className={cn(
        'relative inline-flex items-center justify-center whitespace-nowrap rounded-small px-5 py-2.5',
        'bg-surface text-[15px] font-semibold text-gray-900',
        'shadow-[inset_0_0_0_1px_var(--gray-300)] hover:bg-gray-50',
        // 키보드로 왔을 때만 링을 그린다. focus-within 은 마우스로 고른 뒤에도 남아서,
        // 필터를 바꾼 버튼에 파란 테두리가 계속 붙어 있었다 (2e 디자인에 없는 상태).
        'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-blue-600',
        className,
      )}
    >
      {label}: {current} ▾
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}
