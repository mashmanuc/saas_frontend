// Витяг усіх імен команд, які розуміє KaTeX, — щоб ремонт побитого LaTeX
// спирався на реальний словник рушія, а не на список, дописаний руками.
import { readFileSync, writeFileSync } from 'node:fs'

const src = readFileSync('node_modules/katex/dist/katex.mjs', 'utf8')
const names = new Set()
for (const m of src.matchAll(/"\\\\([a-zA-Z]{2,20})"/g)) names.add(m[1])
for (const m of src.matchAll(/'\\\\([a-zA-Z]{2,20})'/g)) names.add(m[1])

const sorted = [...names].sort()
writeFileSync('katex_commands.json', JSON.stringify(sorted))
console.log('команд:', sorted.length)
console.log('перевірка:', ['frac', 'sqrt', 'nu', 'times', 'beta', 'begin', 'rho']
  .map((c) => `${c}:${names.has(c)}`).join(' '))
