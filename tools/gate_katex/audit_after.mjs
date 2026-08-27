/**
 * Крок 3 гейта G-KATEX: перемір ПІСЛЯ фіксу, тим самим корпусом.
 *
 * Відмінність від `audit.cjs` принципова: той відтворював конвеєр копією
 * регекса, а цей імпортує СПРАВЖНІ функції з `katexCompat.ts`. Інакше я
 * міряла б свою копію фіксу, а не фікс.
 *
 * Запуск: npx vite-node tools/gate_katex/audit_after.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import katex from 'katex'
import {
  normalizeSourceText,
  cleanTextSegment,
  splitBareMathEnvironments,
  toKatexCompatible,
} from '../../src/utils/katexCompat.ts'

const CORPUS = path.resolve('../backend/tools/gate_katex/corpus.jsonl')
const OUT = path.resolve('tools/gate_katex/report_after.json')

// Сегментер — дослівно новий регекс із contentRenderer.ts.
const SEG = /(\$\$[\s\S]+?\$\$|\$[^$]{1,800}?\$)/g

function parseSegments(raw) {
  const text = normalizeSourceText(raw)
  const out = []
  let last = 0, m
  SEG.lastIndex = 0
  while ((m = SEG.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    const r = m[0]
    out.push(r.startsWith('$$')
      ? { type: 'display', value: r.slice(2, -2).trim() }
      : { type: 'inline', value: r.slice(1, -1).trim() })
    last = m.index + r.length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

const LATEX_IN_TEXT = /\\[a-zA-Z]+/
const stats = { fragments: 0, occurrences: 0, clean: 0, cleanOcc: 0, red: 0, black: 0 }
const classes = new Map()
const brokenPks = []   // для перевірки гіпотези власника: чи це саме дроби

function bump(cls, n, ex) {
  const e = classes.get(cls) || { frag: 0, occ: 0, example: '' }
  e.frag++; e.occ += n
  if (!e.example) e.example = ex.slice(0, 150).replace(/\s+/g, ' ')
  classes.set(cls, e)
}

// ⚠️ `display` — не дрібниця. Перша редакція аудита завжди рендерила inline, і
// показувала 5 хибних червоних «{equation*} can be used only in display mode»,
// яких у справжньому рендерері немає: там голі середовища йдуть у
// renderLatexToMathML(..., true). Вимірювач мусить повторювати конвеєр точно,
// інакше він вигадує дефекти й ховає справжні.
function renderMath(tex, display) {
  katex.renderToString(toKatexCompatible(tex), {
    throwOnError: true, strict: false, displayMode: display === true,
  })
}

for (const line of fs.readFileSync(CORPUS, 'utf-8').split('\n')) {
  if (!line.trim()) continue
  const row = JSON.parse(line)
  const n = row.n || 1
  stats.fragments++; stats.occurrences += n

  let red = false, black = false
  for (const seg of parseSegments(row.text)) {
    if (seg.type === 'text') {
      for (const part of splitBareMathEnvironments(seg.value)) {
        if (part.math) {
          try { renderMath(part.value, true) } catch (e) { red = true; bump('🟥 ' + short(e.message), n, part.value) }
        } else {
          const cleaned = cleanTextSegment(part.value)
          if (LATEX_IN_TEXT.test(cleaned) || /^\s*\$\s*$/m.test(cleaned)) {
            black = true
            bump('⬛ ' + leak(cleaned), n, cleaned)
          }
        }
      }
    } else {
      try { renderMath(seg.value, seg.type === 'display') } catch (e) { red = true; bump('🟥 ' + short(e.message), n, seg.value) }
    }
  }
  if (red || black) brokenPks.push({ pk: row.pk, field: row.field, red, black })
  if (red) stats.red++
  if (black) stats.black++
  if (!red && !black) { stats.clean++; stats.cleanOcc += n }
}

function short(msg) {
  return String(msg).replace(/^KaTeX parse error:\s*/, '').split(' at position')[0].slice(0, 70)
}
function leak(t) {
  const env = t.match(/\\begin\{([a-zA-Z*]+)\}/)
  if (env) return `середовище {${env[1]}}`
  if (/^\s*\$\s*$/m.test(t)) return '$ на власному рядку'
  const c = [...new Set([...t.matchAll(/\\([a-zA-Z]+)/g)].map((m) => m[1]))].slice(0, 3)
  return `команда поза $…$ (${c.join(', ')})`
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : '—')
console.log('\n=== G-KATEX крок 3: ПІСЛЯ ===')
console.log(`фрагментів: ${stats.fragments}`)
console.log(`чисті:      ${stats.clean} (${pct(stats.clean, stats.fragments)})`)
console.log(`🟥 червоні:  ${stats.red}`)
console.log(`⬛ чорні:    ${stats.black}`)

const sorted = [...classes.entries()].sort((a, b) => b[1].occ - a[1].occ)
console.log(`\nзалишок класів: ${sorted.length}\n`)
for (const [cls, e] of sorted.slice(0, 20)) {
  console.log(`  ${String(e.occ).padStart(5)} | ${cls}`)
  console.log(`        ${e.example.slice(0, 110)}`)
}
fs.writeFileSync(OUT, JSON.stringify({ stats, classes: sorted.map(([cls, e]) => ({ cls, ...e })) }, null, 2))
// Ключі зламаних задач — щоб бекенд міг перевірити гіпотезу власника про дроби.
fs.writeFileSync(path.resolve('tools/gate_katex/broken_pks.json'),
  JSON.stringify(brokenPks, null, 2))
console.log(`\n→ ${OUT}`)
