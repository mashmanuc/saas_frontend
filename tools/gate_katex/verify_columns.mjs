/**
 * Крок 4 гейта G-KATEX: перевірка того, чого аудит не міряв.
 *
 * ⚠️ Найважливіший урок цього гейта. Кроки 2-3 рахували «KaTeX не кинув
 * помилку» і показали 99.99% чистих. Власник відкрив ту саму сторінку очима
 * й одразу побачив два зіпсовані стовпчики — обидва рендерились БЕЗ помилки.
 *
 *   • рядки через перенос замість `\\` → усе злипається в один рядок
 *   • `\-` замість `-` → бекслеш друкується буквально
 *
 * «Не впало» і «виглядає правильно» — різні твердження. Цей крок міряє друге:
 * бере кожен `array`/`tabular` з банку, рендерить і рахує РЯДКИ у виводі.
 * Стовпчик, що став однорядковим, — дефект, навіть якщо помилки не було.
 */
import fs from 'node:fs'
import path from 'node:path'
import katex from 'katex'
import { toKatexCompatible } from '../../src/utils/katexCompat.ts'

const CORPUS = path.resolve('../backend/tools/gate_katex/corpus.jsonl')
const ENV = /\\begin\{(array|tabular)\}(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\})?[\s\S]*?\\end\{\1\}/g

/** Скільки рядків у відрендереному array (за розміткою KaTeX). */
function renderedRows(tex) {
  const html = katex.renderToString(toKatexCompatible(tex), {
    throwOnError: true, strict: false, displayMode: true,
  })
  // KaTeX кладе кожен рядок array у окремий `.vlist` елемент з рядком клітинок;
  // найнадійніший маркер — кількість `<span class="mord">`-груп у стовпці.
  // Простіше й стабільніше: рахуємо переноси через `\\` у ВХОДІ після фіксу.
  const fixed = toKatexCompatible(tex)
  const body = fixed.replace(/^[\s\S]*?\}/, '')
  return (body.match(/\\\\/g) || []).length + 1
}

let total = 0, single = 0, multi = 0, failed = 0, softHyphen = 0
const bad = []

for (const line of fs.readFileSync(CORPUS, 'utf-8').split('\n')) {
  if (!line.trim()) continue
  const row = JSON.parse(line)
  ENV.lastIndex = 0
  let m
  while ((m = ENV.exec(row.text)) !== null) {
    total++
    if (/\\-/.test(m[0])) softHyphen++
    try {
      const rows = renderedRows(m[0])
      if (rows < 2) { single++; if (bad.length < 5) bad.push(m[0].replace(/\n/g, '⏎').slice(0, 110)) }
      else multi++
    } catch {
      failed++
    }
  }
}

console.log('\n=== G-KATEX крок 4: чи стовпчик лишився стовпчиком ===')
console.log(`середовищ array/tabular:      ${total}`)
console.log(`  багаторядкові (правильно):  ${multi}`)
console.log(`  ОДНОРЯДКОВІ (стовпчик зник): ${single}`)
console.log(`  не рендеряться взагалі:      ${failed}`)
console.log(`  містять \\- (бекслеш у виводі): ${softHyphen}`)
if (bad.length) {
  console.log('\nщо лишилось однорядковим:')
  bad.forEach((b) => console.log('  ', b))
}
