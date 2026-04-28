#!/usr/bin/env node
/**
 * Інспекція ru.json відносно uk.json (без модифікацій).
 *
 * Показує:
 *  - кількість ключів у обох файлах
 *  - відсутні ключі в ru.json
 *  - "зайві" ключі в ru.json (яких уже немає в uk.json)
 *  - ключі-плейсхолдери [TODO-RU] / [TODO]
 *  - ключі де ru === uk (можливо неперекладене)
 *  - ключі з кириличними українськими маркерами (і/є/ї/ґ/'-апостроф) — імовірно UA-текст залишений у ru
 *  - type mismatch (string vs object і т.п.)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales')
const UK_PATH = path.join(LOCALES_DIR, 'uk.json')
const RU_PATH = path.join(LOCALES_DIR, 'ru.json')

// Українські маркери, яких НЕМАЄ в російській мові
const UA_ONLY_CHARS = /[іїєґІЇЄҐ]/
// Російські маркери, яких НЕМАЄ в українській
const RU_ONLY_CHARS = /[ыэъЫЭЪ]/

function flatten(obj, prefix = '', acc = new Map()) {
  if (obj === null || obj === undefined) {
    acc.set(prefix, obj)
    return acc
  }
  if (typeof obj !== 'object' || Array.isArray(obj)) {
    acc.set(prefix, obj)
    return acc
  }
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    flatten(v, p, acc)
  }
  return acc
}

function isMeaningfulString(v) {
  if (typeof v !== 'string') return false
  const s = v.trim()
  if (!s) return false
  // короткі суто-цифрові / суто-символьні значення (іконки, числа) ігноруємо
  if (/^[\d\s\.\-\+%:/@#]+$/.test(s)) return false
  return true
}

function looksLikeUkrainian(s) {
  return UA_ONLY_CHARS.test(s)
}
function looksLikeRussian(s) {
  return RU_ONLY_CHARS.test(s)
}

function main() {
  const uk = JSON.parse(fs.readFileSync(UK_PATH, 'utf-8'))
  const ru = JSON.parse(fs.readFileSync(RU_PATH, 'utf-8'))

  const ukFlat = flatten(uk)
  const ruFlat = flatten(ru)

  const missingInRu = []
  const extraInRu = []
  const typeMismatch = []
  const todoMarkers = []
  const sameAsUk = []
  const ukLeftInRu = []
  const emptyInRu = []

  for (const [key, ukVal] of ukFlat) {
    if (!ruFlat.has(key)) {
      missingInRu.push({ key, ukVal })
      continue
    }
    const ruVal = ruFlat.get(key)

    if (typeof ukVal !== typeof ruVal) {
      typeMismatch.push({ key, ukType: typeof ukVal, ruType: typeof ruVal })
      continue
    }

    if (typeof ruVal === 'string') {
      const trimmed = ruVal.trim()

      if (trimmed === '' && typeof ukVal === 'string' && ukVal.trim() !== '') {
        emptyInRu.push({ key, ukVal })
        continue
      }

      if (/\[TODO(-RU)?\]/i.test(ruVal)) {
        todoMarkers.push({ key, ruVal, ukVal })
        continue
      }

      if (
        isMeaningfulString(ukVal) &&
        isMeaningfulString(ruVal) &&
        ruVal === ukVal &&
        looksLikeUkrainian(ukVal)
      ) {
        sameAsUk.push({ key, val: ruVal })
        continue
      }

      if (
        isMeaningfulString(ruVal) &&
        looksLikeUkrainian(ruVal) &&
        !looksLikeRussian(ruVal)
      ) {
        ukLeftInRu.push({ key, ruVal, ukVal })
      }
    }
  }

  for (const key of ruFlat.keys()) {
    if (!ukFlat.has(key)) extraInRu.push(key)
  }

  const total = ukFlat.size
  const need =
    missingInRu.length +
    todoMarkers.length +
    sameAsUk.length +
    ukLeftInRu.length +
    emptyInRu.length +
    typeMismatch.length

  console.log('═══════════════════════════════════════════════')
  console.log('  i18n inspection: uk.json ↔ ru.json')
  console.log('═══════════════════════════════════════════════')
  console.log(`UK keys:                     ${ukFlat.size}`)
  console.log(`RU keys:                     ${ruFlat.size}`)
  console.log(`Missing in RU:               ${missingInRu.length}`)
  console.log(`Extra in RU (not in UK):     ${extraInRu.length}`)
  console.log(`Type mismatch:               ${typeMismatch.length}`)
  console.log(`[TODO-RU] markers:           ${todoMarkers.length}`)
  console.log(`Empty strings in RU:         ${emptyInRu.length}`)
  console.log(`RU === UK (untranslated):    ${sameAsUk.length}`)
  console.log(`UA chars left in RU value:   ${ukLeftInRu.length}`)
  console.log('───────────────────────────────────────────────')
  console.log(`Total to fix:                ${need} / ${total}`)
  console.log('═══════════════════════════════════════════════\n')

  const SHOW = 25
  const dump = (title, arr, fmt) => {
    if (!arr.length) return
    console.log(`\n── ${title} (показано ${Math.min(arr.length, SHOW)} з ${arr.length}) ──`)
    arr.slice(0, SHOW).forEach(fmt)
    if (arr.length > SHOW) console.log(`  …та ще ${arr.length - SHOW}`)
  }

  dump('MISSING IN RU', missingInRu, ({ key, ukVal }) =>
    console.log(`  ${key}\n    UK: ${JSON.stringify(ukVal)}`),
  )
  dump('TODO-RU MARKERS', todoMarkers, ({ key, ruVal }) =>
    console.log(`  ${key} → ${JSON.stringify(ruVal)}`),
  )
  dump('UA TEXT LEFT IN RU', ukLeftInRu, ({ key, ruVal }) =>
    console.log(`  ${key} → ${JSON.stringify(ruVal)}`),
  )
  dump('RU === UK', sameAsUk, ({ key, val }) =>
    console.log(`  ${key} → ${JSON.stringify(val)}`),
  )
  dump('EMPTY IN RU', emptyInRu, ({ key, ukVal }) =>
    console.log(`  ${key}  (UK: ${JSON.stringify(ukVal)})`),
  )
  dump('TYPE MISMATCH', typeMismatch, ({ key, ukType, ruType }) =>
    console.log(`  ${key}  uk=${ukType} ru=${ruType}`),
  )
  dump('EXTRA IN RU', extraInRu, (k) => console.log(`  ${k}`))

  // Save report JSON for tooling
  const report = {
    generatedAt: new Date().toISOString(),
    counts: {
      ukKeys: ukFlat.size,
      ruKeys: ruFlat.size,
      missingInRu: missingInRu.length,
      extraInRu: extraInRu.length,
      typeMismatch: typeMismatch.length,
      todoMarkers: todoMarkers.length,
      emptyInRu: emptyInRu.length,
      sameAsUk: sameAsUk.length,
      ukLeftInRu: ukLeftInRu.length,
    },
    missingInRu: missingInRu.map((x) => x.key),
    todoMarkers: todoMarkers.map((x) => x.key),
    sameAsUk: sameAsUk.map((x) => x.key),
    ukLeftInRu: ukLeftInRu.map((x) => x.key),
    emptyInRu: emptyInRu.map((x) => x.key),
    typeMismatch,
    extraInRu,
  }
  const reportPath = path.join(__dirname, 'i18n-ru-report.json')
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`\n📄 Звіт: ${path.relative(process.cwd(), reportPath)}`)
}

main()
