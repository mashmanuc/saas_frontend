// Прогін УСІХ формул із прода крізь справжній конвеєр рендера.
//
// Не «здається, працює», а число: скільки сегментів KaTeX не бере і які класи
// дефектів лишились.
//
// ЯК КОРИСТУВАТИСЬ:
//   1) на проді:  python manage.py dump_math_segments > segments.json
//      (команда в backend/apps/winterboard/management/commands/)
//   2) тут:       npx vite-node tools/sweep_math.mjs
//
// Заведено 2026-09-25 на вимогу власника: «ти чекаєш, поки вилізе знов
// залупа?». Прогін відповідає на це числом, а не обіцянкою.
import { readFileSync } from 'node:fs'
import katex from 'katex'

const { normalizeSourceText, toKatexCompatible, looksLikeProse } = await import(
  '../src/utils/katexCompat.ts'
)
// Той самий ремонт, що стоїть у сегментері карток (contentRenderer): інакше
// прогін міряв би не те, що бачить користувач.
const { repairCtrlInInlineMath } = await import(
  '../src/modules/learning-content/utils/contentRenderer.ts'
)

const segs = JSON.parse(readFileSync(process.argv[2] || 'segments.json', 'utf8'))

const classes = new Map()
const add = (cls, seg, extra = '') => {
  if (!classes.has(cls)) classes.set(cls, { count: 0, weight: 0, samples: [] })
  const c = classes.get(cls)
  c.count += 1
  c.weight += seg.n
  if (c.samples.length < 3) c.samples.push(`${seg.t.slice(0, 110)}${extra ? ' || ' + extra : ''}`)
}

let ok = 0
for (const seg of segs) {
  const text = normalizeSourceText(seg.t)
  const isDisplay = text.startsWith('$$')
  const inner = (isDisplay ? text.replace(/^\$\$|\$\$$/g, '') : text.replace(/^\$|\$$/g, '')).trim()
  if (looksLikeProse(inner)) { add('проза в доларах (показуємо текстом)', seg); continue }

  const tex = toKatexCompatible(isDisplay ? inner : repairCtrlInInlineMath(inner))
  try {
    katex.renderToString(tex, { throwOnError: true, strict: false, displayMode: isDisplay })
  } catch (e) {
    add(`KaTeX не бере: ${String(e.message).replace(/ at position.*/, '').slice(0, 60)}`, seg)
    continue
  }
  // Рендериться — але чи те, що треба?
  if (/[\x08\x0c\t\r\n]/.test(tex)) add('керуючий символ лишився', seg)
  else if (/\\text\{[^{}]*\\[a-zA-Z]/.test(tex)) add('команда всередині \\text{}', seg)
  else if (/(?<!\\)\b(sqrt|frac|cdot|times|sum)\b/.test(tex)) add('команда словом без бекслеша', seg, tex.slice(0, 60))
  else if (/\^\s*\{?\s*[oо]\s*\}?(?![a-zA-Zа-яіїєґ])/.test(tex)) add('градус латинською/кириличною «о»', seg)
  else ok += 1
}

console.log(`сегментів: ${segs.length}, чисто: ${ok}`)
const rows = [...classes.entries()].sort((a, b) => b[1].weight - a[1].weight)
for (const [cls, c] of rows) {
  console.log(`\n[${c.count} унік. / ${c.weight} входжень] ${cls}`)
  for (const s of c.samples) console.log('   ', JSON.stringify(s))
}
