import { describe, expect, it } from 'vitest'
import { cn } from '../../src/renderer/lib/cn'

/**
 * tailwind-merge 는 tailwind.config.js 를 읽지 않는다. 우리가 만든 이름(text-caption,
 * rounded-card, shadow-card …)을 모르면 엉뚱한 그룹으로 분류해서 멀쩡한 클래스를 지운다.
 * 화면 비교에서 실제로 났던 사고들을 여기서 막는다.
 */
describe('cn — 디자인 토큰 이름을 아는 병합', () => {
  it('글자 크기와 글자 색은 서로 지우지 않는다', () => {
    // 사고: primary 버튼의 text-white 가 text-body 에 지워져 남색 바탕에 글자가 안 보였다.
    expect(cn('text-white', 'text-body')).toBe('text-white text-body')
    expect(cn('text-caption', 'text-gray-600')).toBe('text-caption text-gray-600')
    expect(cn('text-body-sm font-semibold', 'text-success-600')).toBe('text-body-sm font-semibold text-success-600')
  })

  it.each(['display', 'h1', 'h2', 'h3', 'body', 'body-sm', 'caption'])('text-%s 는 글자 크기다', (size) => {
    expect(cn(`text-${size}`, 'text-error-main')).toBe(`text-${size} text-error-main`)
    // 같은 그룹끼리는 뒤의 것이 이긴다
    expect(cn('text-[15px]', `text-${size}`)).toBe(`text-${size}`)
  })

  it('반경 토큰은 반경끼리만 겨룬다', () => {
    expect(cn('rounded-card', 'rounded-small')).toBe('rounded-small')
    expect(cn('rounded-chip', 'bg-brand-sub')).toBe('rounded-chip bg-brand-sub')
  })

  it('그림자 토큰과 임의 그림자는 같은 그룹이다 — 뒤의 조건부 테두리가 이긴다', () => {
    // 사고: 끊긴 카메라 타일의 빨간 테두리가 shadow-card 에 가려 안 보였다.
    expect(cn('shadow-card', 'shadow-[inset_0_0_0_1.5px_var(--error-300)]')).toBe(
      'shadow-[inset_0_0_0_1.5px_var(--error-300)]',
    )
    expect(cn('shadow-card', 'shadow-modal')).toBe('shadow-modal')
  })

  it('영상 자리의 배경색·배경 크기·배경 그림은 서로 다른 속성이다', () => {
    const merged = cn(
      'bg-video',
      'bg-[length:24px_24px]',
      'bg-[linear-gradient(135deg,rgb(255_255_255/.04)_25%,transparent_25%)]',
    )
    expect(merged.split(' ')).toHaveLength(3)
  })
})
