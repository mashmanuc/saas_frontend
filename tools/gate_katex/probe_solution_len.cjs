// Чи влізе розбір у бюджет контексту Інтегралика (MAX_BOARD_CTX_CHARS = 3000).
const fs = require('fs')
const path = require('path')

const lines = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')

const lens = []
for (const l of lines) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  if (r.field === 'solution') lens.push(r.text.length)
}
lens.sort((a, b) => a - b)
const q = (p) => lens[Math.floor(lens.length * p)]

console.log('розборів у банку:', lens.length)
console.log('  медіана:', q(0.5), 'символів')
console.log('  75-й перцентиль:', q(0.75))
console.log('  90-й:', q(0.9))
console.log('  максимум:', lens[lens.length - 1])
console.log('\nбюджет усього контексту дошки: 3000 символів')
console.log('тобто повний розбір медіанної довжини з’їдає',
  (100 * q(0.5) / 3000).toFixed(0) + '% бюджету')
