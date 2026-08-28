/**
 * Перемір градусів після фіксу — на СПРАВЖНІЙ функції, не на копії регексу.
 *
 * Перевіряє те, чого перша спроба не перевірила: скільки записів градуса
 * лишилось у корпусі після нормалізації, з розбивкою за символом. Саме через
 * відсутність такого кроку я доповіла «114, усі» й пропустила 694 кириличні.
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeSourceText } from '../../src/utils/katexCompat.ts'

const FORMS = {
  'кирилична о U+043E': /\^\{?о\}?/g,
  'латинська o U+006F': /\^\{?o\}?/g,
  'градус ° U+00B0': /\^\{?°\}?/g,
}
// Контроль: законні показники, яких чіпати НЕ можна.
const KEEP = {
  'нуль ^{0}': /\^\{0\}/g,
  'двійка ^{2}': /\^\{2\}/g,
  'ен ^{n}': /\^\{n\}/g,
}

const before = {}, after = {}, keepBefore = {}, keepAfter = {}
for (const k of Object.keys(FORMS)) { before[k] = 0; after[k] = 0 }
for (const k of Object.keys(KEEP)) { keepBefore[k] = 0; keepAfter[k] = 0 }

for (const l of fs.readFileSync(
  path.resolve('../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  const norm = normalizeSourceText(r.text)
  for (const [name, re] of Object.entries(FORMS)) {
    before[name] += ((r.text.match(re) || []).length) * r.n
    after[name] += ((norm.match(re) || []).length) * r.n
  }
  for (const [name, re] of Object.entries(KEEP)) {
    keepBefore[name] += ((r.text.match(re) || []).length) * r.n
    keepAfter[name] += ((norm.match(re) || []).length) * r.n
  }
}

console.log('ГРАДУСИ — мають зникнути')
console.log(`${'форма'.padEnd(24)} ${'до'.padStart(7)} ${'після'.padStart(7)}`)
for (const k of Object.keys(FORMS)) {
  const ok = after[k] === 0 ? '✅' : '❌'
  console.log(`${k.padEnd(24)} ${String(before[k]).padStart(7)} ${String(after[k]).padStart(7)}  ${ok}`)
}

console.log('\nЗАКОННІ ПОКАЗНИКИ — мають лишитись недоторканими')
console.log(`${'форма'.padEnd(24)} ${'до'.padStart(7)} ${'після'.padStart(7)}`)
for (const k of Object.keys(KEEP)) {
  const ok = keepAfter[k] === keepBefore[k] ? '✅' : '❌ ЗАЧЕПИЛИ'
  console.log(`${k.padEnd(24)} ${String(keepBefore[k]).padStart(7)} ${String(keepAfter[k]).padStart(7)}  ${ok}`)
}
