/**
 * Витягує .result.translations з output-файлу workflow і зберігає як патч.
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const outputPath = process.argv[2]
const raw = JSON.parse(readFileSync(outputPath, 'utf8'))
const translations = raw.result?.translations

if (!translations) {
  console.error('No translations found in output')
  process.exit(1)
}

const patchPath = join(__dirname, 'ru-translations-patch.json')
writeFileSync(patchPath, JSON.stringify(translations, null, 2) + '\n', 'utf8')
console.log(`Saved ${Object.keys(translations).length} translations → scripts/ru-translations-patch.json`)
