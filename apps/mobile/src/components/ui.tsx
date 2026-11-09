import { Children, Fragment, useState, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { toggle as toggleSpec } from '@scene-stealer/tokens'
import { palette } from '../lib/palette'
import { font } from '../lib/typography'
import { Icon, type IconName } from './icons'
import { Logo } from './Logo'

/**
 * 화면 부품 — 피그마 모바일 화면(알림 상세 · 홈 · 기록 · 설정)에서 잰 크기 그대로.
 * 폭 393 기준이고, 좌우 여백은 16 이다.
 */

/** 웹을 넓은 창으로 열었을 때 앱이 차지하는 폭 (_layout). 아래에서 올라오는 시트도 이 폭을 넘지 않는다. */
export const WEB_FRAME_WIDTH = 430
/** 화면 좌우 여백 */
export const GUTTER = 16

/** 앱 머리 — 흰 바탕 48, 왼쪽 로고 · 오른쪽 종. 종은 위험 기록으로 간다. */
export const AppHeader = () => {
  const insets = useSafeAreaInsets()
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Logo />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="위험 기록 보기"
          hitSlop={10}
          onPress={() => router.navigate('/records')}
          style={({ pressed }) => [styles.bell, pressed && styles.pressed]}
        >
          <Icon name="bell" size={24} color={palette.ink} />
        </Pressable>
      </View>
    </View>
  )
}

/** 탭 화면 틀 — 앱 머리 아래 회색 바탕. */
export const Screen = ({ children }: { children: ReactNode }) => (
  <View style={styles.screen}>
    <AppHeader />
    {children}
  </View>
)

/** 흰 카드 — 흰 바탕 · gray/300 테두리 · r12. */
export const Card = ({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.card, style]}>{children}</View>
)

/** 섹션 머리 — 왼쪽 18 굵은 제목, 오른쪽엔 '미확인 2' 같은 것 또는 안내 한 줄. */
export const SectionHeader = ({ title, right }: { title: string; right?: ReactNode }) => (
  <View style={styles.sectionHead}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {typeof right === 'string' ? <Text style={styles.sectionHint}>{right}</Text> : right}
  </View>
)

/** 칩 앞(뒤)의 상태 점 — 연결됨 초록 · 끊김 빨강 · 중지 회색. */
export type ChipDot = 'ok' | 'danger' | 'idle'

const DOT_COLOR: Record<ChipDot, string> = { ok: palette.green, danger: palette.red, idle: palette.faint }

export const Chip = ({
  label,
  selected = false,
  tone = 'default',
  dot,
  dotPosition = 'before',
  trailing,
  variant = 'solid',
  onPress,
}: {
  label: string
  selected?: boolean
  tone?: 'default' | 'danger'
  dot?: ChipDot
  /** 매장 칩은 이름 뒤, 카메라 칩은 이름 앞에 점을 찍는다. */
  dotPosition?: 'before' | 'after'
  /** '카메라 ⌄' 처럼 글자 뒤에 붙는 아이콘 */
  trailing?: IconName
  /** solid = 흰 바탕 32 (매장 · 필터). outline = 바탕 없이 30 (카메라 상태). */
  variant?: 'solid' | 'outline'
  onPress?: () => void
}) => {
  const danger = tone === 'danger'
  const textColor = selected ? palette.white : danger ? palette.red : variant === 'solid' ? palette.navy : palette.ink
  const dotView = dot ? <View style={[styles.chipDot, { backgroundColor: DOT_COLOR[dot] }]} /> : null
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityState={onPress ? { selected } : undefined}
      style={({ pressed }) => [
        variant === 'solid' ? styles.chip : styles.chipOutline,
        selected && styles.chipSelected,
        danger && !selected && styles.chipDanger,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      {dotPosition === 'before' ? dotView : null}
      <Text style={[styles.chipText, selected && styles.chipTextSelected, { color: textColor }]}>{label}</Text>
      {dotPosition === 'after' ? dotView : null}
      {trailing ? <Icon name={trailing} size={16} color={textColor} /> : null}
    </Pressable>
  )
}

/** 점선 동그라미 '+' — 홈 매장 칩 줄 끝. */
export const AddChip = ({ onPress, label }: { onPress: () => void; label: string }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityLabel={label}
    onPress={onPress}
    style={({ pressed }) => [styles.addChip, pressed && styles.pressed]}
  >
    <Icon name="plus" size={16} color={palette.ink} />
  </Pressable>
)

/**
 * 큰 버튼 (54) — danger = '112 전화하기', navy = '확인했어요', blue = 화면 안의 주요 동작.
 * outline 은 흰 바탕 테두리 버튼 (로그인의 '번호 다시 입력').
 */
type ButtonTone = 'danger' | 'navy' | 'blue' | 'outline'

const BUTTON_FILL: Record<ButtonTone, string> = {
  danger: palette.red,
  navy: palette.navy,
  blue: palette.blue,
  outline: palette.white,
}

export const Button = ({
  label,
  icon,
  onPress,
  tone = 'navy',
  disabled = false,
  loading = false,
  style,
}: {
  label: string
  icon?: IconName
  onPress: () => void
  tone?: ButtonTone
  disabled?: boolean
  loading?: boolean
  style?: StyleProp<ViewStyle>
}) => {
  const ink = tone === 'outline' ? palette.navy : palette.white
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: BUTTON_FILL[tone] },
        tone === 'outline' && styles.buttonOutline,
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={22} color={ink} inner={BUTTON_FILL[tone]} /> : null}
          <Text style={[styles.buttonText, { color: ink }]}>{label}</Text>
        </>
      )}
    </Pressable>
  )
}

/** 회색 버튼 (38) — '전체 기록 보기 (2건 더) ⌄'. */
export const MoreButton = ({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    onPress={onPress}
    style={({ pressed }) => [styles.more, pressed && styles.pressed]}
  >
    <Text style={styles.moreText}>{label}</Text>
    <Icon name={icon} size={16} color={palette.sub} />
  </Pressable>
)

/** 네모 칸 버튼 (72) — 알림 상세의 '전후 영상 보기 · 다른 카메라 · 클립 저장·공유'. */
export const Tile = ({
  icon, label, onPress, active = false, disabled = false,
}: {
  icon: IconName
  label: string
  onPress: () => void
  active?: boolean
  disabled?: boolean
}) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ expanded: active, disabled }}
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [styles.tile, active && styles.tileActive, disabled && styles.disabled, pressed && styles.pressed]}
  >
    <Icon name={icon} size={24} color={active ? palette.blue : palette.navy} />
    <Text style={[styles.tileText, active && { color: palette.blue }]} numberOfLines={1}>{label}</Text>
  </Pressable>
)

/** 밑줄 글자 버튼 — '문제 없음 (오탐신고)'. */
export const TextLink = ({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable accessibilityRole="button" hitSlop={10} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.linkBox, pressed && styles.pressed]}>
    <Text style={[styles.link, disabled && { color: palette.faint }]}>{label}</Text>
  </Pressable>
)

/**
 * 피그마 toggle switch — 설정 화면에 놓인 크기(원본 32×20 의 0.8배, 26×16) 그대로.
 * 그림은 작아도 누르는 자리는 hitSlop 으로 44 이상 둔다.
 */
export const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (next: boolean) => void; label: string }) => (
  <Pressable
    onPress={() => onChange(!value)}
    accessibilityRole="switch"
    accessibilityLabel={label}
    accessibilityState={{ checked: value }}
    hitSlop={14}
    style={[styles.toggleTrack, { backgroundColor: value ? toggleSpec.onColor : toggleSpec.offColor }]}
  >
    <View style={[styles.toggleKnob, value && { alignSelf: 'flex-end' }]} />
  </Pressable>
)

/** 설정 한 줄 (38, 아래 줄이 있으면 44) — 선 아이콘 · 글자 · 값 · 꺾쇠. */
export const SettingsRow = ({
  icon, label, sub, subTone = 'muted', value, right, onPress, chevron = Boolean(onPress),
}: {
  icon: IconName
  label: string
  sub?: string
  subTone?: 'muted' | 'danger'
  value?: string
  right?: ReactNode
  onPress?: () => void
  chevron?: boolean
}) => (
  <Pressable
    onPress={onPress}
    disabled={!onPress}
    accessibilityRole={onPress ? 'button' : undefined}
    style={({ pressed }) => [styles.srow, sub ? styles.srowTall : null, pressed && onPress ? styles.srowPressed : null]}
  >
    <Icon name={icon} size={18} color={palette.navy} />
    <View style={styles.srowBody}>
      <Text style={styles.srowLabel} numberOfLines={1}>{label}</Text>
      {sub ? (
        <Text style={[styles.srowSub, subTone === 'danger' && { color: palette.red }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
    {value ? <Text style={styles.srowValue} numberOfLines={1}>{value}</Text> : null}
    {right}
    {chevron ? <Icon name="chevronRight" size={20} color={palette.faint} /> : <View style={styles.srowEnd} />}
  </Pressable>
)

/** 줄 묶음 카드 — 줄 사이에 gray/200 선. */
export const RowGroup = ({ children }: { children: ReactNode }) => {
  const rows = Children.toArray(children).filter(Boolean)
  return (
    <Card>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={styles.rowDivider} /> : null}
          {row}
        </Fragment>
      ))}
    </Card>
  )
}

/** 설정의 '알림' · '내 매장' 같은 작은 머리글 + 그 아래 카드. */
export const Section = ({ caption, children, style }: { caption: string; children: ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[styles.section, style]}>
    <Text style={styles.sectionCaption}>{caption}</Text>
    {children}
  </View>
)

/** 아래에서 올라오는 시트. 바깥을 누르면 닫힌다. */
export const Sheet = ({
  visible, title, onClose, children,
}: {
  visible: boolean
  title: string
  onClose: () => void
  children: ReactNode
}) => {
  const insets = useSafeAreaInsets()
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기">
        {/* 안쪽을 눌러도 닫히지 않게 누름을 여기서 받는다. */}
        <Pressable style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, GUTTER) + 8 }]} onPress={() => undefined}>
          <View style={styles.sheetHead}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="닫기" hitSlop={12} onPress={onClose}>
              <Icon name="close" size={22} color={palette.muted} />
            </Pressable>
          </View>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  )
}

/** 시트 안의 고르기 줄 — 고른 줄은 파랑 + 체크. */
export const OptionRow = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={({ pressed }) => [styles.option, pressed && styles.srowPressed]}
  >
    <Text style={[styles.optionText, selected && styles.optionTextOn]}>{label}</Text>
    {selected ? <Icon name="check" size={20} color={palette.blue} /> : null}
  </Pressable>
)

/** 빈 목록 — 카드 안 가운데 한 줄. */
export const EmptyCard = ({ text }: { text: string }) => (
  <Card style={styles.empty}>
    <Text style={styles.emptyText}>{text}</Text>
  </Card>
)

/**
 * 입력 칸. 디자인시스템 4장 '입력' — 누르면 테두리가 파랑으로 바뀐다.
 * 브라우저가 그리는 검은 포커스 테두리는 끈다 (그 자리를 파란 테두리가 대신한다).
 */
export const TextField = ({ style, onFocus, onBlur, editable = true, ...props }: TextInputProps) => {
  const [focused, setFocused] = useState(false)
  return (
    <TextInput
      {...props}
      editable={editable}
      placeholderTextColor={palette.faint}
      onFocus={(event) => {
        setFocused(true)
        onFocus?.(event)
      }}
      onBlur={(event) => {
        setFocused(false)
        onBlur?.(event)
      }}
      style={[
        styles.field,
        WEB_NO_OUTLINE,
        focused && { borderColor: palette.blue },
        !editable && { backgroundColor: palette.fill, color: palette.muted },
        style,
      ]}
    />
  )
}

/**
 * 크롬은 포커스 테두리를 outline-style:auto 로 그려서 굵기(outlineWidth 0)만으로는 지워지지 않는다.
 * RN 타입에는 'none' 이 없지만 react-native-web 은 그대로 CSS 로 넘긴다.
 */
const WEB_NO_OUTLINE = (Platform.OS === 'web' ? { outlineStyle: 'none' } : null) as TextStyle | null

const SHADOW_SOFT = '0 2px 8px rgba(20, 35, 61, 0.06)'

/** 설정 화면의 토글은 컴포넌트 원본의 0.8배로 놓였다. */
const TOGGLE_SCALE = 0.8

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },

  header: { backgroundColor: palette.white },
  headerRow: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: GUTTER,
    // 종 그림은 네모 칸 안쪽에 여백이 있다 — 그림의 오른쪽 끝이 여백 16 에 오게 칸을 조금 밖으로 뺀다.
    paddingRight: GUTTER - 3,
  },
  bell: { padding: 0 },
  screen: { flex: 1, backgroundColor: palette.page },

  card: {
    backgroundColor: palette.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    overflow: 'hidden',
  },

  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sectionTitle: { ...font(18, '700'), lineHeight: 24, color: palette.ink },
  sectionHint: { ...font(12), color: palette.muted, flexShrink: 1, textAlign: 'right' },

  chip: {
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
  },
  chipOutline: {
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: palette.border,
  },
  chipSelected: { backgroundColor: palette.navy, borderColor: palette.navy },
  chipDanger: { borderColor: palette.redLine },
  chipDot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { ...font(13, '500'), lineHeight: 18 },
  chipTextSelected: { fontWeight: '600' },
  addChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: palette.border,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
  },

  button: {
    height: 54,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: GUTTER,
  },
  buttonOutline: { borderWidth: 1, borderColor: palette.border },
  buttonText: { ...font(16, '600') },

  more: {
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.fill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  moreText: { ...font(13, '500'), color: palette.sub },

  tile: {
    flex: 1,
    height: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: palette.white,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 4,
    boxShadow: SHADOW_SOFT,
  },
  tileActive: { borderColor: palette.blue },
  tileText: { ...font(14, '600'), lineHeight: 18, color: palette.navy },

  linkBox: { alignSelf: 'center', paddingVertical: 4 },
  link: { ...font(13, '500'), color: palette.sub, textDecorationLine: 'underline' },

  toggleTrack: {
    width: toggleSpec.track.width * TOGGLE_SCALE,
    height: toggleSpec.track.height * TOGGLE_SCALE,
    borderRadius: toggleSpec.track.radius,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: toggleSpec.knob.size * TOGGLE_SCALE,
    height: toggleSpec.knob.size * TOGGLE_SCALE,
    borderRadius: toggleSpec.knob.radius,
    backgroundColor: toggleSpec.knob.color,
  },

  srow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 10,
    paddingVertical: 8,
  },
  srowTall: { minHeight: 44, paddingVertical: 6 },
  srowPressed: { backgroundColor: palette.fill },
  srowBody: { flex: 1, gap: 1 },
  srowLabel: { ...font(13, '500'), lineHeight: 18, color: palette.ink },
  srowSub: { ...font(10), lineHeight: 13, color: palette.muted },
  srowValue: { ...font(12), color: palette.muted, maxWidth: 150, textAlign: 'right' },
  srowEnd: { width: 4 },
  rowDivider: { height: 1, backgroundColor: palette.divider },

  section: { gap: 6 },
  sectionCaption: { ...font(13, '500'), color: palette.sub },

  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(20, 35, 61, 0.4)' },
  sheet: {
    width: '100%',
    maxWidth: WEB_FRAME_WIDTH,
    alignSelf: 'center',
    backgroundColor: palette.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 20,
    paddingHorizontal: GUTTER,
    gap: 14,
  },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { ...font(18, '700'), color: palette.ink },
  option: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
  },
  optionText: { ...font(15, '500'), color: palette.ink },
  optionTextOn: { fontWeight: '700', color: palette.blue },

  empty: { paddingVertical: 24, alignItems: 'center', paddingHorizontal: GUTTER },
  emptyText: { ...font(13), color: palette.muted, textAlign: 'center' },

  field: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 10,
    paddingHorizontal: GUTTER,
    ...font(15),
    color: palette.ink,
    backgroundColor: palette.white,
  },
})
