/**
 * Полювання на двійників: кирилиця там, де математика чекає латиницю.
 *
 * Клас той самий, що дав баг із градусами: символ виглядає правильно, а
 * рендериться не тим, чим здається. Градуси я знайшла лише тому, що власник
 * побачив їх очима — регексом із латинською «o» кирилична «о» невидима.
 *
 * ⚠️ Шукаємо ЛИШЕ ВСЕРЕДИНІ формул. Поза ними кирилиця — це нормальний
 * український текст, і «знахідок» було б десятки тисяч порожніх.
 *
 * Чому це дефект, а не дрібниця. У KaTeX кирилична «х» у формулі малюється
 * прямим шрифтом як буква тексту, а латинська «x» — курсивом як змінна.
 * Учень бачить дві різні на вигляд «ікси» в одній задачі й не розуміє,
 * чому. Помилки при цьому немає ніде: рендер відпрацьовує, аудит зелений.
 */
import fs from 'node:fs'
import path from 'node:path'
import { normalizeSourceText } from '../../src/utils/katexCompat.ts'

const SEG = /(\$\$[\s\S]+?\$\$|\$[^$]{1,800}?\$)/g

// Кирилиця, чиї латинські двійники — типові математичні змінні.
const HOMOGLYPHS = {
  'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x',
  'А': 'A', 'В': 'B', 'Е': 'E', 'К': 'K', 'М': 'M', 'Н': 'H', 'О': 'O',
  'Р': 'P', 'С': 'C', 'Т': 'T', 'Х': 'X', 'і': 'i', 'І': 'I',
}
// Символи, які пишуть замість команд.
const RAW_SYMBOLS = {
  '×': '\\times', '÷': '\\div', '·': '\\cdot', '≤': '\\le', '≥': '\\ge',
  '≠': '\\ne', '≈': '\\approx', '√': '\\sqrt', '∞': '\\infty', '±': '\\pm',
  '–': '- (коротке тире)', '—': '- (довге тире)', ' ': 'нерозривний пробіл',
}

const homo = {}, raw = {}, examples = {}
for (const k of Object.keys(HOMOGLYPHS)) homo[k] = 0
for (const k of Object.keys(RAW_SYMBOLS)) raw[k] = 0

let segments = 0
for (const l of fs.readFileSync(
  path.resolve('../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  const text = normalizeSourceText(r.text)
  SEG.lastIndex = 0
  let m
  while ((m = SEG.exec(text)) !== null) {
    segments++
    const body = m[0]
    for (const ch of Object.keys(HOMOGLYPHS)) {
      const n = (body.split(ch).length - 1)
      if (!n) continue
      homo[ch] += n * r.n
      if (!examples['h' + ch]) examples['h' + ch] = body.slice(0, 70)
    }
    for (const ch of Object.keys(RAW_SYMBOLS)) {
      const n = (body.split(ch).length - 1)
      if (!n) continue
      raw[ch] += n * r.n
      if (!examples['r' + ch]) examples['r' + ch] = body.slice(0, 70)
    }
  }
}

console.log(`математичних сегментів у корпусі: ${segments}\n`)

console.log('── КИРИЛИЦЯ ВСЕРЕДИНІ ФОРМУЛ (мала б бути латиниця) ' + '─'.repeat(14))
const hs = Object.entries(homo).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
if (!hs.length) console.log('   немає')
for (const [ch, n] of hs) {
  console.log(`   ${ch} → ${HOMOGLYPHS[ch]}   ${String(n).padStart(6)}   …${(examples['h' + ch] || '').replace(/\s+/g, ' ')}`)
}

console.log('\n── ГОТОВІ СИМВОЛИ ЗАМІСТЬ КОМАНД ' + '─'.repeat(33))
const rs = Object.entries(raw).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
if (!rs.length) console.log('   немає')
for (const [ch, n] of rs) {
  const label = ch === ' ' ? '(NBSP)' : ch
  console.log(`   ${label} → ${RAW_SYMBOLS[ch]}   ${String(n).padStart(6)}   …${(examples['r' + ch] || '').replace(/\s+/g, ' ')}`)
}
