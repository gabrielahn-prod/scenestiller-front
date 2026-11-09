// design/ds/fig-tokens.css → src/generated.ts
//
// 손으로 옮기지 않는 이유: 토큰이 94개고 alias 가 섞여 있어서 한 값만 틀려도
// PC 와 모바일 색이 갈린다. 디자인 원본이 갱신되면 이 스크립트를 다시 돌린다.
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const cssPath = resolve(here, '../../../design/ds/fig-tokens.css')
const css = readFileSync(cssPath, 'utf8')

/** `:root { … }` 와 다크 블록을 따로 읽는다. */
const blockOf = (selector) => {
  const start = css.indexOf(selector)
  if (start === -1) return {}
  const open = css.indexOf('{', start)
  const close = css.indexOf('}', open)
  return Object.fromEntries(
    [...css.slice(open, close).matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)].map(([, k, v]) => [k, v.trim()]),
  )
}

const rgbToHex = (value) => {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value)
  if (!m) return null
  return '#' + m.slice(1, 4).map((n) => Number(n).toString(16).padStart(2, '0')).join('')
}

/** var(--x) 사슬을 끝까지 따라가 실제 색으로 바꾼다. */
const resolveValue = (raw, table, seen = new Set()) => {
  const alias = /^var\(--([a-z0-9-]+)\)$/i.exec(raw)
  if (!alias) return rgbToHex(raw) ?? raw
  const key = alias[1]
  if (seen.has(key) || !(key in table)) return raw
  return resolveValue(table[key], table, new Set([...seen, key]))
}

const light = blockOf(':root {')
const dark = blockOf(':root[data-theme="dark"]')

const toEntries = (table, base) =>
  Object.entries(table)
    .filter(([, v]) => !/^\d+$/.test(v))
    .map(([k, v]) => [k, resolveValue(v, base)])
    .filter(([, v]) => typeof v === 'string' && v.startsWith('#'))
    .sort(([a], [b]) => a.localeCompare(b))

const render = (entries) =>
  entries.map(([k, v]) => `  '${k}': '${v}',`).join('\n')

const out = `// 자동 생성 — 고치지 마세요. \`npm run generate -w @scene-stealer/tokens\` 로 다시 만듭니다.
// 원본: design/ds/fig-tokens.css (피그마 변수 ${Object.keys(light).length}개)

export const lightTokens = {
${render(toEntries(light, light))}
} as const

export const darkTokens = {
${render(toEntries(dark, { ...light, ...dark }))}
} as const

export type TokenName = keyof typeof lightTokens
`
writeFileSync(resolve(here, '../src/generated.ts'), out)
console.log(`토큰 ${toEntries(light, light).length}개 생성 (다크 ${toEntries(dark, { ...light, ...dark }).length}개)`)
