import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

function isObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v)
}

function flattenKeys(obj, prefix = '') {
  const out = new Set()

  if (!isObject(obj)) return out

  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k
    out.add(next)

    if (isObject(v)) {
      for (const child of flattenKeys(v, next)) out.add(child)
    }
  }

  return out
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8')
  return JSON.parse(raw)
}

function diffKeys(a, b) {
  const missing = []
  for (const key of a) {
    if (!b.has(key)) missing.push(key)
  }
  return missing.sort()
}

function main() {
  const root = process.cwd()
  const ukPath = path.join(root, 'src', 'i18n', 'locales', 'uk.json')
  const enPath = path.join(root, 'src', 'i18n', 'locales', 'en.json')

  const uk = readJson(ukPath)
  const en = readJson(enPath)

  const ukKeys = flattenKeys(uk)
  const enKeys = flattenKeys(en)

  const missingInEn = diffKeys(ukKeys, enKeys)
  const missingInUk = diffKeys(enKeys, ukKeys)

  if (missingInEn.length === 0 && missingInUk.length === 0) {
    console.log('[i18n-check] OK: uk/en keys are consistent')
    return
  }

  console.error('[i18n-check] FAILED: i18n keys mismatch')

  if (missingInEn.length > 0) {
    console.error(`\nMissing in en.json (${missingInEn.length}):`)
    for (const k of missingInEn) console.error(`- ${k}`)
  }

  if (missingInUk.length > 0) {
    console.error(`\nMissing in uk.json (${missingInUk.length}):`)
    for (const k of missingInUk) console.error(`- ${k}`)
  }

  process.exit(1)
}

main()
