// Скільки фрагментів використовують роздільники \( \) і \[ \] замість $.
// Через файл — шелл їв бекслеші й давав SyntaxError на самому регексі.
const fs = require('fs')
const path = require('path')
const lines = fs.readFileSync(
  path.resolve(__dirname, '../../../backend/tools/gate_katex/corpus.jsonl'), 'utf-8').split('\n')

const RE_PAREN = /\\\(/
const RE_BRACK = /\\\[/
let paren = 0, brack = 0, pOcc = 0, bOcc = 0, tot = 0

for (const l of lines) {
  if (!l.trim()) continue
  const r = JSON.parse(l)
  tot++
  if (RE_PAREN.test(r.text)) { paren++; pOcc += r.n }
  if (RE_BRACK.test(r.text)) { brack++; bOcc += r.n }
}
console.log('фрагментів усього:', tot)
console.log('з \\( … \\):', paren, '| входжень', pOcc)
console.log('з \\[ … \\]:', brack, '| входжень', bOcc)
