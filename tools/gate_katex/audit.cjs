/**
 * Крок 2 гейта G-KATEX: прогнати весь корпус через справжній конвеєр рендера
 * і порахувати, ЩО САМЕ не малюється.
 *
 * Навіщо. Власник: «комплексно без латки — нехай довше, але надійно». Латка
 * лікує те, що трапилось на очі; тут ми спершу дізнаємось повний перелік.
 *
 * Два різні режими провалу, і плутати їх не можна:
 *   ЧЕРВОНИЙ  — сегмент розпізнано як математику, KaTeX його не взяв і
 *               намалював джерело своїм errorColor (throwOnError: false).
 *   ЧОРНИЙ    — сегмент НЕ розпізнано як математику взагалі (немає `$`),
 *               тож LaTeX пішов у текст як є. Помилки немає ніде.
 * На скріншотах власника були обидва, і причини в них РІЗНІ.
 */
const fs = require('fs')
const path = require('path')
const katex = require('katex')

const CORPUS = path.resolve(__dirname, '../../../backend/tools/gate_katex/corpus.jsonl')
const OUT = path.resolve(__dirname, 'report.json')
const RENDERER = path.resolve(__dirname, '../../src/modules/learning-content/utils/contentRenderer.ts')

// ── Сегментер: дослівна копія contentRenderer.ts:36 ────────────────────────
// Копія перевіряється нижче на збіг із джерелом — інакше аудит міряв би не
// той код, що працює у користувача, і ми б цього не помітили.
const SEGMENT_RE_SRC = String.raw`(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)`

function assertSegmenterInSync() {
  const src = fs.readFileSync(RENDERER, 'utf-8')
  if (!src.includes(SEGMENT_RE_SRC)) {
    console.error('СТОП: регекс сегментів розійшовся з contentRenderer.ts.')
    console.error('Аудит міряв би не той код, що працює. Онови SEGMENT_RE_SRC.')
    process.exit(2)
  }
}

function parseSegments(text) {
  const re = new RegExp(SEGMENT_RE_SRC, 'g')
  const out = []
  let last = 0, m
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: text.slice(last, m.index) })
    const raw = m[0]
    out.push(raw.startsWith('$$')
      ? { type: 'display', value: raw.slice(2, -2).trim() }
      : { type: 'inline', value: raw.slice(1, -1).trim() })
    last = m.index + raw.length
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) })
  return out
}

// ── Класифікація ──────────────────────────────────────────────────────────
const LATEX_IN_TEXT = /\\[a-zA-Z]+/       // зворотний слеш + команда
const BEGIN_ENV = /\\begin\{([a-zA-Z*]+)\}/g

/** Коротка, стабільна назва класу помилки — щоб рахувати, а не читати. */
function classifyKatexError(msg) {
  const m = String(msg)
  const known = [
    [/Unknown column alignment: @/, 'array: @{} у колонках'],
    [/Unknown column alignment/, 'array: інша невідома колонка'],
    [/Undefined control sequence: \\(\w+)/, null],   // ім'я підставимо нижче
    [/No such environment: (\w+)/, null],
    [/Expected '\}'/, 'незакрита дужка'],
    [/Expected 'EOF'/, 'зайвий символ після виразу'],
    [/valid only within array environment/, '\\hline поза array'],
    [/Can't use function '(.)' in math mode/, null],
    [/Double superscript/, 'подвійний степінь'],
    [/Double subscript/, 'подвійний індекс'],
  ]
  for (const [re, label] of known) {
    const hit = m.match(re)
    if (!hit) continue
    if (label) return label
    if (re.source.includes('Undefined control sequence')) return `невідома команда \\${hit[1]}`
    if (re.source.includes('No such environment')) return `немає середовища {${hit[1]}}`
    if (re.source.includes("in math mode")) return `символ '${hit[1]}' не для формул`
  }
  return 'інше: ' + m.replace(/^KaTeX parse error:\s*/, '').split(' at position')[0].slice(0, 60)
}

/** Що саме лишилось сирим текстом. */
function classifyLeak(textSeg) {
  const envs = [...textSeg.matchAll(BEGIN_ENV)].map((m) => m[1])
  if (envs.length) return [...new Set(envs)].map((e) => `сире середовище {${e}}`)
  if (/^\s*\$\s*$/m.test(textSeg)) return ['$ на власному рядку (багаторядкова формула)']
  const cmds = [...textSeg.matchAll(/\\([a-zA-Z]+)/g)].map((m) => m[1])
  if (cmds.length) {
    const top = [...new Set(cmds)].slice(0, 3).join(', ')
    return [`сира команда поза $…$ (${top})`]
  }
  return []
}

// ── Прогін ────────────────────────────────────────────────────────────────
assertSegmenterInSync()

const stats = {
  fragments: 0, occurrences: 0,
  cleanFrag: 0, cleanOcc: 0,
  redFrag: 0, redOcc: 0,
  blackFrag: 0, blackOcc: 0,
}
const classes = new Map()   // клас -> {frag, occ, example}

function bump(cls, n, example) {
  const e = classes.get(cls) || { frag: 0, occ: 0, example: '' }
  e.frag++; e.occ += n
  if (!e.example) e.example = example.slice(0, 160).replace(/\s+/g, ' ')
  classes.set(cls, e)
}

const lines = fs.readFileSync(CORPUS, 'utf-8').split('\n')
for (const line of lines) {
  if (!line.trim()) continue
  const row = JSON.parse(line)
  const n = row.n || 1
  stats.fragments++; stats.occurrences += n

  let red = false, black = false
  for (const seg of parseSegments(row.text)) {
    if (seg.type === 'text') {
      if (LATEX_IN_TEXT.test(seg.value) || /^\s*\$\s*$/m.test(seg.value)) {
        for (const cls of classifyLeak(seg.value)) { black = true; bump('⬛ ' + cls, n, seg.value) }
      }
    } else {
      try {
        katex.renderToString(seg.value, { throwOnError: true, strict: false })
      } catch (err) {
        red = true
        bump('🟥 ' + classifyKatexError(err.message), n, seg.value)
      }
    }
  }
  if (red) { stats.redFrag++; stats.redOcc += n }
  if (black) { stats.blackFrag++; stats.blackOcc += n }
  if (!red && !black) { stats.cleanFrag++; stats.cleanOcc += n }
}

// ── Звіт ──────────────────────────────────────────────────────────────────
const pct = (a, b) => (b ? (100 * a / b).toFixed(2) + '%' : '—')
console.log('\n=== G-KATEX, крок 2: вимір ===')
console.log(`унікальних фрагментів: ${stats.fragments}   входжень: ${stats.occurrences}`)
console.log(`чисті:    ${stats.cleanFrag} (${pct(stats.cleanFrag, stats.fragments)})   входжень ${pct(stats.cleanOcc, stats.occurrences)}`)
console.log(`🟥 червоне: ${stats.redFrag} (${pct(stats.redFrag, stats.fragments)})`)
console.log(`⬛ чорне:   ${stats.blackFrag} (${pct(stats.blackFrag, stats.fragments)})`)

const sorted = [...classes.entries()].sort((a, b) => b[1].occ - a[1].occ)
console.log(`\nкласів дефектів: ${sorted.length}\n`)
console.log('  входжень | фрагм. | клас')
for (const [cls, e] of sorted.slice(0, 30)) {
  console.log(`  ${String(e.occ).padStart(8)} | ${String(e.frag).padStart(6)} | ${cls}`)
}

fs.writeFileSync(OUT, JSON.stringify({
  stats,
  classes: sorted.map(([cls, e]) => ({ cls, ...e })),
}, null, 2), 'utf-8')
console.log(`\n→ ${OUT}`)
