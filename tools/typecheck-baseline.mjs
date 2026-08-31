#!/usr/bin/env node
/**
 * Чи стало ГІРШЕ з типами — відповідь однією командою.
 *
 * Навіщо: `npm run typecheck` падає на передіснуючому боргу, тож його код
 * завершення нічого не каже про твою зміну. На практиці це означало
 * грепати вивід за іменем власного файлу після кожної правки — тобто
 * питати «моє чи не моє» вручну і покладатись на те, що не помилишся.
 *
 * Тут борг ЗАФІКСОВАНО пофайлово й посигнатурно, а не сховано:
 *   • нова діагностика   → вихід 1, названа поіменно;
 *   • зникла діагностика → вихід 0 і порада оновити знімок;
 *   • без змін           → вихід 0.
 *
 * Це не «дозвіл на червоне». Борг лишається видним числом і списком, а
 * ширшого допуску немає: сигнатура — це файл + код TS + текст, тому
 * замінити одну помилку іншою в тому самому файлі непомітно не вийде.
 *
 * ⚠️ Свідомо БЕЗ рядків і стовпців у ключі: додаси рядок вище — і всі
 * діагностики файлу «стануть новими». Ключ має рухатись разом із кодом,
 * інакше знімок доведеться оновлювати після кожної правки, і він швидко
 * перетвориться на «оновлю, щоб замовкло».
 *
 *   node tools/typecheck-baseline.mjs            # перевірити
 *   node tools/typecheck-baseline.mjs --update   # перезаписати знімок
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SNAPSHOT = resolve(ROOT, 'tools/typecheck-baseline.json')
const UPDATE = process.argv.includes('--update')

/** `src/a/b.vue(12,5): error TS2345: текст…` */
const LINE = /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.*)$/

function collect() {
  let out = ''
  try {
    out = execSync('npx vue-tsc --noEmit', { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' })
  } catch (e) {
    // vue-tsc виходить ненульовим саме тоді, коли є діагностики — це
    // очікуваний шлях, а не збій запуску
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }

  const found = new Map()
  for (const raw of out.split(/\r?\n/)) {
    const m = LINE.exec(raw.trim())
    if (!m) continue
    const [, file, , , code, message] = m
    // текст обрізаємо: TS вивалює величезні дампи типів, і повний текст
    // робив би ключ ламким без користі для впізнавання
    const key = `${file.replace(/\\/g, '/')} ${code} ${message.replace(/\s+/g, ' ').slice(0, 100)}`
    found.set(key, (found.get(key) ?? 0) + 1)
  }
  return found
}

const found = collect()
const total = [...found.values()].reduce((a, b) => a + b, 0)

if (UPDATE) {
  const snapshot = {
    note: 'Знімок ВІДОМОГО боргу типів. Оновлювати лише свідомо, з поясненням у комміті.',
    updated: new Date().toISOString().slice(0, 10),
    total,
    signatures: Object.fromEntries([...found.entries()].sort(([a], [b]) => a.localeCompare(b))),
  }
  writeFileSync(SNAPSHOT, `${JSON.stringify(snapshot, null, 1)}\n`, 'utf-8')
  console.log(`знімок оновлено: ${total} діагностик`)
  process.exit(0)
}

if (!existsSync(SNAPSHOT)) {
  console.error('немає знімка — спершу `node tools/typecheck-baseline.mjs --update`')
  process.exit(1)
}

const base = JSON.parse(readFileSync(SNAPSHOT, 'utf-8')).signatures ?? {}

const worse = []
const better = []
for (const [key, n] of found) {
  const was = base[key] ?? 0
  if (n > was) worse.push(`${key}${was ? `  (було ${was}, стало ${n})` : ''}`)
}
for (const [key, n] of Object.entries(base)) {
  const now = found.get(key) ?? 0
  if (now < n) better.push(`${key}${now ? `  (було ${n}, стало ${now})` : ''}`)
}

const baseTotal = Object.values(base).reduce((a, b) => a + b, 0)
console.log(`=== ТИПИ: борг ${baseTotal} → зараз ${total} ===`)

if (worse.length) {
  console.log(`\n❌ НОВІ діагностики: ${worse.length}`)
  for (const w of worse) console.log(`   ${w}`)
}
if (better.length) {
  console.log(`\n✅ Зникли: ${better.length}`)
  for (const b of better.slice(0, 10)) console.log(`   ${b}`)
  console.log('   → якщо це навмисно, онови знімок: --update')
}
if (!worse.length && !better.length) console.log('\n   без змін — твоя правка типів не погіршила')

process.exit(worse.length ? 1 : 0)
