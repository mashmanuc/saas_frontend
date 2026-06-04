/**
 * Застосовує патч перекладів до ru.json.
 * Вхід: scripts/ru-translations-patch.json — плаский об'єкт { "dot.key": "translation" }
 * Результат: оновлений src/i18n/locales/ru.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, '../src/i18n/locales')
const patchPath = join(__dirname, 'ru-translations-patch.json')

const ru = JSON.parse(readFileSync(join(localesDir, 'ru.json'), 'utf8'))
const patch = JSON.parse(readFileSync(patchPath, 'utf8'))

function setByPath(obj, path, value) {
  const keys = path.split('.')
  let cur = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (cur[k] == null || typeof cur[k] !== 'object') {
      cur[k] = {}
    }
    cur = cur[k]
  }
  cur[keys[keys.length - 1]] = value
}

let applied = 0
let skipped = 0

for (const [key, value] of Object.entries(patch)) {
  if (value == null || value === '') {
    skipped++
    continue
  }
  setByPath(ru, key, value)
  applied++
}

writeFileSync(join(localesDir, 'ru.json'), JSON.stringify(ru, null, 2) + '\n', 'utf8')
console.log(`✓ Applied ${applied} translations to ru.json (skipped ${skipped} empty/null)`)
