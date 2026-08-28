/**
 * Як у банку записують градуси — і скільки з того НЕ рендериться.
 *
 * Знахідка власника 2026-08-28, урок «Трикутники»: у варіантах відповіді
 * стоїть сирий текст `90^{o}` замість «90°». В умові й теорії при цьому
 * «180°» показується правильно — тобто записів кілька, і поводяться вони
 * по-різному.
 *
 * Дві причини можливі, і вони потребують різних фіксів:
 *   • `^{o}` — це взагалі НЕ градус, а верхній індекс із латинської «o»
 *     (правильно `^\circ`), тож навіть у справжньому LaTeX вийшло б не те;
 *   • навколо немає `$…$`, тож у нашому конвеєрі це просто текст.
 */
const fs = require('fs')
const path = require('path')

const lines = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')

const FORMS = {
  '^{o} — латинська «о» у фігурних': /\^\{o\}/,
  '^o — латинська «о» без дужок': /\^o(?![a-zA-Z{])/,
  '^\\circ — правильний LaTeX': /\^\\?\{?\\circ/,
  '° — готовий символ': /°/,
  '^{\\circ} — правильний, у дужках': /\^\{\\circ\}/,
}

const counts = {}
const undelimited = {}
const examples = {}

for (const key of Object.keys(FORMS)) { counts[key] = 0; undelimited[key] = 0 }

for (const l of lines) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  for (const [name, re] of Object.entries(FORMS)) {
    if (!re.test(r.text)) continue
    counts[name] += r.n
    // Чи стоїть форма ПОЗА математикою: рахуємо роздільники до першого збігу.
    const at = r.text.search(re)
    const delims = (r.text.slice(0, at).match(/\$\$|\$/g) || []).length
    if (delims % 2 === 0) {
      undelimited[name] += r.n
      if (!examples[name]) examples[name] = r.text.slice(Math.max(0, at - 40), at + 40)
    }
  }
}

console.log(`${'форма запису'.padEnd(36)} ${'усього'.padStart(8)} ${'поза $…$'.padStart(10)}`)
console.log('-'.repeat(58))
for (const name of Object.keys(FORMS)) {
  console.log(`${name.padEnd(36)} ${String(counts[name]).padStart(8)} ${String(undelimited[name]).padStart(10)}`)
}
console.log('\nприклади поза математикою:')
for (const [n, ex] of Object.entries(examples)) {
  console.log(`  ${n}\n     …${ex.replace(/\s+/g, ' ')}…`)
}
