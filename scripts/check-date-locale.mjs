#!/usr/bin/env node
/**
 * Guard: дати НЕ форматуються жорсткою/браузерною локаллю.
 *
 * Дата має брати активну мову інтерфейсу — через `activeLocale()` з
 * `@/utils/i18nDate` (або `locale.value` з `useI18n()`), а НЕ `'uk-UA'`,
 * НЕ `undefined`, НЕ порожню (браузерну) локаль. Інакше в англійському
 * режимі дати лишаються українськими (fallbackLocale=uk).
 *
 * Захищає суцільний sweep 2026-07-22 (94 файли + SSOT utils/i18nDate.ts).
 *
 * Escape hatch: рядок з коментарем `// i18n-date-ok` пропускається — для
 * навмисних НЕ-display випадків (парсинг дати, обчислення TZ-зсуву тощо),
 * напр. `Intl.DateTimeFormat('en-CA', …)` для YYYY-MM-DD.
 *
 * НЕ чіпає: `Intl.NumberFormat(...)` (валюта/числа), bare `toLocaleString()`
 * на числах, тести (`*.spec.*` / `__tests__`).
 *
 * Usage: node scripts/check-date-locale.mjs   (exit 1 при порушеннях)
 */
import fs from 'fs'
import path from 'path'

const SRC = path.resolve('src')
const OK_MARK = 'i18n-date-ok' // marker у `// i18n-date-ok` або `<!-- i18n-date-ok -->`

const RULES = [
  { re: /\.toLocaleDateString\(\s*(['"`][^'"`]*['"`]|undefined)/, msg: "toLocaleDateString() з жорсткою/undefined локаллю" },
  { re: /\.toLocaleDateString\(\s*\)/,                            msg: "toLocaleDateString() без локалі (браузерна)" },
  { re: /\.toLocaleTimeString\(\s*(['"`][^'"`]*['"`]|undefined)/, msg: "toLocaleTimeString() з жорсткою/undefined локаллю" },
  { re: /\.toLocaleTimeString\(\s*\)/,                            msg: "toLocaleTimeString() без локалі (браузерна)" },
  { re: /(?:Intl\.)?DateTimeFormat\(\s*(['"`][^'"`]*['"`]|undefined)/, msg: "Intl.DateTimeFormat() з жорсткою/undefined локаллю" },
  { re: /\.toLocaleString\(\s*['"`][a-z]{2}(-[A-Za-z]{2,4})?['"`]/, msg: "toLocaleString() з жорсткою локаллю-рядком" },
]

const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__', '.git'])

function collect(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) collect(p, out)
    } else if (/\.(vue|ts|js)$/.test(e.name) && !/\.(spec|test)\.[jt]s$/.test(e.name) && e.name !== 'i18nDate.ts') {
      out.push(p)
    }
  }
  return out
}

const violations = []
for (const file of collect(SRC)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  lines.forEach((line, idx) => {
    if (line.includes(OK_MARK)) return
    for (const { re, msg } of RULES) {
      if (re.test(line)) {
        violations.push({
          file: path.relative(process.cwd(), file).replace(/\\/g, '/'),
          line: idx + 1,
          msg,
          code: line.trim().slice(0, 110),
        })
        break
      }
    }
  })
}

if (violations.length) {
  console.error(`\n✗ check:date-locale — ${violations.length} порушень (дати з жорсткою/браузерною локаллю):\n`)
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    ${v.msg}`)
    console.error(`    ${v.code}`)
  }
  console.error(`\n  Fix: локаль → activeLocale() з '@/utils/i18nDate' (або locale.value з useI18n()).`)
  console.error(`  Якщо це навмисний парсинг/обчислення (не display) — додай коментар \`${OK_MARK}\` на рядку.\n`)
  process.exit(1)
}

console.log(`✓ check:date-locale — 0 порушень`)
