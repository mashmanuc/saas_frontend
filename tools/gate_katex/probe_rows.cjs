/**
 * Скільки середовищ мають рядки, розділені ПЕРЕНОСОМ, а не `\\`.
 *
 * Це те, чого аудит не ловив: KaTeX такий array рендерить БЕЗ помилки — просто
 * складає все в один рядок. Формально чисто, візуально стовпчик зник.
 * Знайшов власник очима на скріншоті, не вимір.
 */
const fs = require('fs')
const path = require('path')

const lines = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')

const ENV = /\\begin\{(array|tabular)\}(\{[^}]*\})?([\s\S]*?)\\end\{\1\}/g

let envs = 0, newlineRows = 0, properRows = 0, backslashDash = 0
const examples = []

for (const l of lines) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  if (/\\-/.test(r.text)) backslashDash += r.n
  ENV.lastIndex = 0
  let m
  while ((m = ENV.exec(r.text)) !== null) {
    envs++
    const body = m[3]
    const hasBreak = /\\\\/.test(body)
    const hasNewline = /\n/.test(body.trim())
    if (!hasBreak && hasNewline) {
      newlineRows++
      if (examples.length < 3) examples.push(m[0].replace(/\n/g, '⏎').slice(0, 120))
    } else if (hasBreak) properRows++
  }
}

console.log('середовищ array/tabular усього:', envs)
console.log('  рядки через `\\\\` (правильно):', properRows)
console.log('  рядки через ПЕРЕНОС (стовпчик зникає):', newlineRows)
console.log('фрагментів із `\\-`:', backslashDash)
console.log('\nприклади:')
examples.forEach((e) => console.log('  ', e))
