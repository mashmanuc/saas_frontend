/**
 * Чому фікс градусів не спрацював на екрані власника.
 *
 * Мій регекс шукає `^{o}` з ЛАТИНСЬКОЮ «o» (U+006F). У кириличних текстах
 * та сама на вигляд літера часто виявляється кириличною «о» (U+043E) — і
 * жоден регекс із латинською її не побачить.
 */
const fs = require('fs')
const path = require('path')

const lines = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')

const FORMS = {
  'латинська o (U+006F)': /\^\{o\}/,
  'кирилична о (U+043E)': /\^\{о\}/,
  'грецька ο (U+03BF)': /\^\{ο\}/,
  'градус ° у фігурних': /\^\{°\}/,
  'нуль 0 у фігурних': /\^\{0\}/,
  'велика O': /\^\{O\}/,
}

const counts = {}
const examples = {}
for (const k of Object.keys(FORMS)) counts[k] = 0

for (const l of lines) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  for (const [name, re] of Object.entries(FORMS)) {
    if (!re.test(r.text)) continue
    counts[name] += r.n
    if (!examples[name]) {
      const at = r.text.search(re)
      examples[name] = r.text.slice(Math.max(0, at - 30), at + 20).replace(/\s+/g, ' ')
    }
  }
}

for (const [name, n] of Object.entries(counts)) {
  console.log(`${name.padEnd(26)} ${String(n).padStart(6)}${examples[name] ? '   …' + examples[name] : ''}`)
}

// І окремо: чи є взагалі `^{` із будь-чим одним символом усередині.
const single = {}
for (const l of lines) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  for (const m of r.text.matchAll(/\^\{(.)\}/g)) {
    const ch = m[1]
    const key = `${ch} U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`
    single[key] = (single[key] || 0) + r.n
  }
}
console.log('\nусі односимвольні верхні індекси `^{X}` (топ-12):')
Object.entries(single).sort((a, b) => b[1] - a[1]).slice(0, 12)
  .forEach(([k, n]) => console.log(`   ${k.padEnd(14)} ${n}`))
