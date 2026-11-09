/**
 * 컴포넌트 전시장 — Storybook 없이 모든 상태를 한 화면에서 보려고 만든다.
 * design/씬스틸러 디자인시스템.dc.html 을 옆에 띄우고 나란히 비교하는 용도다.
 *
 * 제품 화면이 아니므로 한글 카피 규칙(디자인 그대로)은 여기에 적용되지 않는다.
 */
import { useState } from 'react'
import {
  Button,
  Card,
  CameraTile,
  CardTitle,
  EmptyCameraSlot,
  Input,
  Notice,
  Pagination,
  RiskCard,
  Segmented,
  Spinner,
  Stat,
  StatusLabel,
  Tag,
  Textarea,
  Toggle,
  VideoBadge,
  VideoSurface,
  type ButtonVariant,
  type StatusTone,
  type TagTone,
} from '../../components/ui'

const Section = ({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) => (
  <Card className="flex flex-col gap-4">
    <div className="flex flex-col gap-1">
      <CardTitle className="text-h3">{title}</CardTitle>
      {note && <p className="text-caption text-gray-600">{note}</p>}
    </div>
    {children}
  </Card>
)

const Row = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-2.5">{children}</div>
)

const BUTTON_VARIANTS: readonly { variant: ButtonVariant; label: string }[] = [
  { variant: 'primary', label: '감시 시작' },
  { variant: 'action', label: '+ 카메라 추가' },
  { variant: 'secondary', label: '클립 저장' },
  { variant: 'danger', label: '112 신고' },
  { variant: 'danger-outline', label: '삭제' },
  { variant: 'link', label: '전체 기록 보기' },
]

const TAG_TONES: readonly { tone: TagTone; label: string }[] = [
  { tone: 'high', label: '높음' },
  { tone: 'alert', label: '미확인 2' },
  { tone: 'medium', label: '보통' },
  { tone: 'low', label: '낮음' },
  { tone: 'unconfirmed', label: '미확인' },
  { tone: 'confirmed', label: '확인됨' },
  { tone: 'false-positive', label: '오탐' },
  { tone: 'neutral', label: '계산대' },
]

const STATUSES: readonly { tone: StatusTone; label: string }[] = [
  { tone: 'connected', label: '연결됨' },
  { tone: 'reconnecting', label: '재연결 중' },
  { tone: 'disconnected', label: '끊김' },
  { tone: 'idle', label: '중지' },
]

const SWATCHES: readonly { name: string; value: string; hex: string }[] = [
  { name: 'brand/main', value: 'bg-brand-main', hex: '#14233D' },
  { name: 'brand/sub', value: 'bg-brand-sub', hex: '#3B6FF5' },
  { name: 'risk/high', value: 'bg-risk-high', hex: '#E01F12' },
  { name: 'risk/medium', value: 'bg-risk-medium', hex: '#F9A403' },
  { name: 'risk/low', value: 'bg-risk-low', hex: '#868B94' },
  { name: 'success/500', value: 'bg-success-500', hex: '#12A85F' },
  { name: 'gray/50 (페이지)', value: 'bg-gray-50', hex: '#F7F8F9' },
  { name: 'gray/300 (구분선)', value: 'bg-gray-300', hex: '#DCDEE3' },
  { name: 'gray/800 (영상)', value: 'bg-gray-800', hex: '#2A3038' },
  { name: 'blue/600 (포커스)', value: 'bg-blue-600', hex: '#006AFF' },
]

export const ComponentGallery = () => {
  const [toggles, setToggles] = useState({ on: true, off: false })
  const [segment, setSegment] = useState<'all' | 'unconfirmed' | 'high'>('all')
  const [page, setPage] = useState(1)

  return (
    <div className="min-h-full bg-page px-page py-10">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4">
        <header className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2.5">
            <span className="font-logo text-[26px] font-bold text-brand-main">Scene Stealer</span>
            <Tag tone="neutral">/dev/components</Tag>
          </div>
          <p className="text-body-sm text-gray-600">
            design/씬스틸러 디자인시스템.dc.html 4장과 나란히 비교하는 화면입니다.
          </p>
        </header>

        <Section title="1. 색" note="디자인시스템 1장 — 값은 ds/fig-tokens.css 에서 온다">
          <div className="grid grid-cols-5 gap-4">
            {SWATCHES.map((swatch) => (
              <div key={swatch.name} className="flex flex-col gap-1.5">
                <div className={`h-16 rounded-small ${swatch.value}`} />
                <span className="text-caption text-gray-900">{swatch.name}</span>
                <span className="text-[12px] text-gray-600">{swatch.hex}</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="2. 타이포" note="Pretendard · 로고만 Prompt 700 · 자간 -0.01em · tabular-nums">
          <div className="grid grid-cols-[180px_1fr] items-baseline gap-x-6 gap-y-3.5 text-caption text-gray-600">
            <span>Display · 40/600</span>
            <span className="text-display text-gray-900">매장 CCTV 영상 하나로</span>
            <span>H1 · 32/600</span>
            <span className="text-h1 text-gray-900">위험 기록</span>
            <span>H2 · 24/600</span>
            <span className="text-h2 text-gray-900">발견된 의심 구간 (3)</span>
            <span>H3 · 20/600</span>
            <span className="text-h3 text-gray-900">계산대 · 이상 행동</span>
            <span>Body · 16/500</span>
            <span className="text-body text-gray-900">
              AI가 영상을 분석하여 3개의 의심 구간을 발견했습니다.
            </span>
            <span>Body-sm · 14/500</span>
            <span className="text-body-sm text-gray-600">2026. 07. 10 오전 5:26:36</span>
            <span>Caption · 13/400</span>
            <span className="text-caption text-gray-600">
              원본 영상은 업로드일로부터 7일간 보관합니다.
            </span>
            <span>타임코드 · tabular-nums</span>
            <span className="text-body-sm text-gray-900">14:32:10 – 14:32:41 · 31초</span>
            <span>로고 · Prompt 700</span>
            <span className="font-logo text-[22px] font-bold text-brand-main">Scene Stealer</span>
          </div>
        </Section>

        <Section title="3. 형태" note="반경 8 / 12 / 16 / 99 · 그림자 card · modal">
          <Row>
            <div className="flex size-14 items-center justify-center rounded-small bg-blue-100 text-caption text-brand-sub">8</div>
            <div className="flex size-14 items-center justify-center rounded-card bg-blue-100 text-caption text-brand-sub">12</div>
            <div className="flex size-14 items-center justify-center rounded-panel bg-blue-100 text-caption text-brand-sub">16</div>
            <div className="flex h-9 w-20 items-center justify-center rounded-chip bg-blue-100 text-caption text-brand-sub">99</div>
            <div className="ml-6 flex h-[72px] w-40 items-center justify-center rounded-card bg-surface text-caption text-gray-600 shadow-card">card</div>
            <div className="flex h-[72px] w-40 items-center justify-center rounded-card bg-surface text-caption text-gray-600 shadow-modal">modal</div>
          </Row>
        </Section>

        <Section
          title="4-1. 버튼"
          note="primary=흐름을 끝내는 1개 · action=페이지 주요 액션 · loading/disabled 은 gray/300"
        >
          <Row>
            {BUTTON_VARIANTS.map(({ variant, label }) => (
              <Button key={variant} variant={variant} onClick={() => undefined}>
                {label}
              </Button>
            ))}
          </Row>
          <Row>
            <Button variant="primary" loading>
              연결 중...
            </Button>
            <Button variant="primary" disabled>
              감시 시작
            </Button>
            <Button variant="action" disabled>
              + 카메라 추가
            </Button>
          </Row>
        </Section>

        <div className="grid grid-cols-2 gap-4">
          <Section title="4-2. 입력" note="높이 48 · r12 · default / focus / error / done">
            <Input label="카메라 이름" placeholder="예: 계산대" />
            <Input label="카메라 이름" defaultValue="계산대" />
            <Input
              label="비밀번호"
              type="password"
              defaultValue="123456"
              error="비밀번호가 틀렸습니다 (3회 남음)"
            />
            <Input
              label="RTSP 주소"
              state="done"
              readOnly
              defaultValue="rtsp://192.168.0.64/…"
              adornment={<span className="text-success-500">✓</span>}
            />
            <Textarea label="메모" placeholder="112 접수번호, 피해액 등" />
          </Section>

          <Section title="4-3. 태그 · 상태 점">
            <Row>
              {TAG_TONES.map(({ tone, label }) => (
                <Tag key={tone} tone={tone}>
                  {label}
                </Tag>
              ))}
            </Row>
            <Row>
              {STATUSES.map(({ tone, label }) => (
                <StatusLabel key={tone} tone={tone}>
                  {label}
                </StatusLabel>
              ))}
            </Row>
            <Row>
              <Notice tone="info">서버에 정상 연결되었습니다.</Notice>
            </Row>
            <Row>
              <Notice tone="warn">창고 카메라가 13분째 끊겨 있습니다.</Notice>
            </Row>
            <Row>
              <Notice tone="bad">서버 연결이 끊겼습니다. 다시 연결 중…</Notice>
            </Row>
            <Row>
              <Stat label="오늘 업로드" value="2.4 GB" />
              <Stat label="미확인" value="2" />
              <Spinner className="text-gray-600" />
            </Row>
          </Section>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Section title="4-4. 토글 · 세그먼트 · 페이지네이션">
            <Row>
              <Toggle
                checked={toggles.on}
                onChange={(next) => setToggles((prev) => ({ ...prev, on: next }))}
                label="알림 켜기"
              />
              <Toggle
                checked={toggles.off}
                onChange={(next) => setToggles((prev) => ({ ...prev, off: next }))}
                label="알림 끄기"
              />
              <span className="text-body-sm text-gray-600">on / off</span>
              <Toggle checked disabled onChange={() => undefined} label="잠김 (끌 수 없음)" />
              <span className="text-body-sm text-gray-600">잠김 — 켜진 채 바꿀 수 없음</span>
            </Row>
            <Segmented
              value={segment}
              onChange={setSegment}
              options={[
                { value: 'all', label: '전체 (5)' },
                { value: 'unconfirmed', label: '미확인 (2)' },
                { value: 'high', label: '높음' },
              ]}
            />
            <Pagination page={page} pageCount={3} onChange={setPage} />
          </Section>

          <Section title="4-5. 카메라 타일 · 위험 카드">
            <div className="grid grid-cols-2 gap-2.5">
              <CameraTile name="계산대" status="connected" statusLabel="연결됨" badge="CAM 01 · LIVE" />
              <RiskCard
                title="이상 행동"
                risk="high"
                state="unconfirmed"
                cameraName="계산대"
                time="14:32"
              />
              <CameraTile
                name="창고"
                status="disconnected"
                statusLabel="끊김 13분"
                badge="CAM 04"
              />
              <EmptyCameraSlot onClick={() => undefined} />
              <RiskCard
                title="이상 행동"
                risk="medium"
                state="confirmed"
                cameraName="진열대"
                time="11:04"
              />
              <RiskCard
                title="이상 행동"
                risk="low"
                state="false_positive"
                cameraName="출입문"
                time="09:41"
              />
            </div>
            <VideoSurface className="rounded-card">
              <VideoBadge>CAM 02 · LIVE</VideoBadge>
            </VideoSurface>
          </Section>
        </div>
      </div>
    </div>
  )
}
