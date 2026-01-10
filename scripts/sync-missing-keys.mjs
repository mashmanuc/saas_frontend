import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const localesDir = path.join(root, 'src', 'i18n', 'locales')
const reportPath = path.join(root, 'i18n-check-report.json')

if (!fs.existsSync(reportPath)) {
  console.error('[sync-missing-keys] ERROR: i18n-check-report.json not found. Run "npm run i18n:check -- --report" first.')
  process.exit(1)
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
const ukData = JSON.parse(fs.readFileSync(path.join(localesDir, 'uk.json'), 'utf-8'))
const enData = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf-8'))

function getNestedValue(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key]
    } else {
      return undefined
    }
  }
  return current
}

function setNestedValue(obj, keyPath, value) {
  const keys = keyPath.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
}

function deleteNestedKey(obj, keyPath) {
  const keys = keyPath.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!(key in current) || typeof current[key] !== 'object') {
      return false
    }
    current = current[key]
  }
  const lastKey = keys[keys.length - 1]
  if (lastKey in current) {
    delete current[lastKey]
    return true
  }
  return false
}

const enReport = report.locales.en
if (!enReport) {
  console.error('[sync-missing-keys] ERROR: No en locale report found')
  process.exit(1)
}

let addedCount = 0
let removedCount = 0

console.log(`[sync-missing-keys] Processing ${enReport.missing.length} missing keys...`)
for (const missingKey of enReport.missing) {
  const ukValue = getNestedValue(ukData, missingKey)
  if (ukValue !== undefined) {
    setNestedValue(enData, missingKey, ukValue)
    addedCount++
    if (addedCount <= 10) {
      console.log(`  + Added: ${missingKey}`)
    }
  } else {
    console.warn(`  ! Warning: Key "${missingKey}" not found in uk.json`)
  }
}

if (addedCount > 10) {
  console.log(`  ... and ${addedCount - 10} more`)
}

console.log(`\n[sync-missing-keys] Processing ${enReport.extra.length} extra keys...`)
for (const extraKey of enReport.extra) {
  if (deleteNestedKey(enData, extraKey)) {
    removedCount++
    if (removedCount <= 10) {
      console.log(`  - Removed: ${extraKey}`)
    }
  }
}

if (removedCount > 10) {
  console.log(`  ... and ${removedCount - 10} more`)
}

fs.writeFileSync(
  path.join(localesDir, 'en.json'),
  JSON.stringify(enData, null, 2) + '\n',
  'utf-8'
)

console.log(`\n[sync-missing-keys] ✓ Sync complete:`)
console.log(`  Added: ${addedCount} keys`)
console.log(`  Removed: ${removedCount} keys`)
console.log(`\nRun "npm run i18n:check" to verify.`)
