/**
 * Перевірка класифікатора прози — з наголосом на ХИБНІ спрацювання.
 *
 * Небезпека тут асиметрична. Пропустити прозу — лишити як було (покошене
 * слово). А от помилково назвати прозою СПРАВЖНЮ формулу означає показати
 * її сирим текстом, тобто внести регрес там, де все працювало.
 *
 * Тому нижче не «скільки знайшли», а два списки: що визнано прозою (весь,
 * очима) і скільки формул із математикою випадково туди потрапило.
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeSourceText, looksLikeProse } from '../../src/utils/katexCompat.ts'

const SEG = /(\$\$[\s\S]+?\$\$|\$[^$]{1,800}?\$)/g
// Ознаки СПРАВЖНЬОЇ математики — якщо вони є, а ми сказали «проза», це промах.
const REAL_MATH = /\\[a-zA-Z]{2,}|[=<>±≤≥]|\d\s*[+\-*/]\s*\d|\^|_\{/

let total = 0, prose = 0, suspicious = 0
const found = [], falsePositives = []

for (const l of fs.readFileSync(
  path.resolve('../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  const text = normalizeSourceText(r.text)
  SEG.lastIndex = 0
  let m
  while ((m = SEG.exec(text)) !== null) {
    total++
    const inner = m[0].replace(/^\$\$?|\$\$?$/g, '').trim()
    if (!looksLikeProse(inner)) continue
    prose++
    if (found.length < 70) found.push(inner.slice(0, 80))
    if (REAL_MATH.test(inner)) {
      suspicious++
      if (falsePositives.length < 10) falsePositives.push(inner.slice(0, 80))
    }
  }
}

console.log(`математичних сегментів: ${total}`)
console.log(`визнано прозою:         ${prose}`)
console.log(`🔴 з них МІСТЯТЬ математику (хибне спрацювання): ${suspicious}`)

if (falsePositives.length) {
  console.log('\n❌ ХИБНІ — ці формули показались би сирим текстом:')
  falsePositives.forEach((e) => console.log(`   $${e}$`))
} else {
  console.log('\n✅ жодна формула з математикою не потрапила в прозу')
}

console.log('\nусе, що визнано прозою:')
found.forEach((e) => console.log(`   $${e}$`))
