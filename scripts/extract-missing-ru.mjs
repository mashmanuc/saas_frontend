/**
 * Витягує значення відсутніх RU ключів з uk.json.
 * Результат — scripts/missing-ru-values.json
 */

import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '../src/i18n/locales')

const uk = JSON.parse(readFileSync(join(root, 'uk.json'), 'utf8'))
const report = JSON.parse(readFileSync(join(__dirname, 'i18n-ru-report.json'), 'utf8'))

function getByPath(obj, path) {
  return path.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj)
}

const result = {}
for (const key of report.missingInRu) {
  result[key] = getByPath(uk, key)
}

writeFileSync(join(__dirname, 'missing-ru-values.json'), JSON.stringify(result, null, 2), 'utf8')
console.log(`Extracted ${Object.keys(result).length} keys → scripts/missing-ru-values.json`)
