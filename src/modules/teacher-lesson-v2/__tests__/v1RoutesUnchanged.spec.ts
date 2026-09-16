/**
 * TLV2-01 · V1 не змінюється (паспорт TLV2-00 §7, K7, K11).
 *
 * `src/router/index.js` без блоків `// >>> TLV2-01 … // <<< TLV2-01` мусить бути побайтово
 * продовим (`cd6bdde7`), а маршрути winterboard (`src/modules/winterboard/router.ts`) — без
 * жодної зміни. Маршрут V2 не збігається з жодним шляхом V1.
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { TEACHER_LESSON_V2_HOME, TEACHER_LESSON_V2_PATH, teacherLessonV2Routes } from '../routes'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
const sha256 = (text: string) => createHash('sha256').update(text, 'utf8').digest('hex')
const TLV2_BLOCK = /^[ \t]*\/\/ >>> TLV2-01[\s\S]*?^[ \t]*\/\/ <<< TLV2-01[^\n]*\n/gm

/**
 * sha256 файлів V1 поза блоками TLV2-01 (`git show <коміт>:<файл> | sha256sum`).
 *
 * `router/index.js` — на `0312b841` (V-D3.1): прод `cd6bdde7` + лише DEV-маршрут лабораторії
 * капсули `...devOnlyRoutes(import.meta.env.DEV)`, перенесений у TLV2-03 за словом власника.
 * У production-збірці цей масив порожній. Було `6ea9478c…` (чистий `cd6bdde7`).
 */
const V1_BASELINE = {
  'router/index.js': '75ab57010e0118403e95be4e4e89d70d3c28fdb6603a5ebe0d2de589cfa7b07d',
  'modules/winterboard/router.ts': 'c7d76cc77cf08df8d50244920480e742e7fdeebdf368e0b3be45424884de7b62',
}

describe('K7 · K11 · маршрути V1 без змін', () => {
  it('router/index.js поза блоками TLV2-01 — продові байти', () => {
    const text = read('router/index.js')
    expect(text.match(/\/\/ >>> TLV2-01/g)).toHaveLength(2)
    expect(sha256(text.replace(TLV2_BLOCK, ''))).toBe(V1_BASELINE['router/index.js'])
  })

  it('маршрути winterboard — продові байти', () => {
    expect(sha256(read('modules/winterboard/router.ts'))).toBe(V1_BASELINE['modules/winterboard/router.ts'])
  })

  it('маршрут V2 підключено рівно раз і він не збігається з жодним шляхом V1', () => {
    const index = read('router/index.js')
    expect(index.match(/\.\.\.teacherLessonV2Routes,/g)).toHaveLength(1)
    const v1Paths = new Set(
      [...`${index.replace(TLV2_BLOCK, '')}\n${read('modules/winterboard/router.ts')}`.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]),
    )
    expect(teacherLessonV2Routes.map((r) => [r.path, r.name])).toEqual([[TEACHER_LESSON_V2_PATH, TEACHER_LESSON_V2_HOME]])
    expect(v1Paths.has(TEACHER_LESSON_V2_PATH)).toBe(false)
    expect(v1Paths.has(TEACHER_LESSON_V2_PATH.slice(1))).toBe(false)
  })
})
