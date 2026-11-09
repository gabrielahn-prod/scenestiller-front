import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge 는 tailwind.config.js 를 읽지 않는다. 디자인 토큰으로 만든 이름을
 * 알려주지 않으면 모르는 이름을 '색'으로 분류해서 멀쩡한 클래스를 지운다 —
 * text-body(크기)가 text-white(색)를 지워 primary 버튼 글자가 남색 바탕에 묻혔고,
 * shadow-card 가 끊긴 카메라의 빨간 테두리를 가렸다 (tests/unit/cn.test.ts).
 *
 * tailwind.config.js 의 fontSize · borderRadius · boxShadow 에 이름을 더하면 여기도 더한다.
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: ['display', 'h1', 'h2', 'h3', 'body', 'body-sm', 'caption'] }],
      rounded: [{ rounded: ['small', 'card', 'panel', 'chip'] }],
      shadow: [{ shadow: ['card', 'modal', 'segment'] }],
    },
  },
})

export const cn = (...values: ClassValue[]): string => merge(clsx(values))
