import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const reportPath = path.join(root, 'i18n-check-report.json')
const localesDir = path.join(root, 'src', 'i18n', 'locales')

if (!fs.existsSync(reportPath)) {
  console.error('[cleanup-unused-keys] ERROR: i18n-check-report.json not found. Run "npm run i18n:check -- --report" first.')
  process.exit(1)
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf-8'))
const unusedKeys = report.usage?.unusedKeys || []

if (unusedKeys.length === 0) {
  console.log('[cleanup-unused-keys] ✓ No unused keys found.')
  process.exit(0)
}

console.log(`[cleanup-unused-keys] Found ${unusedKeys.length} unused keys.`)

// Категоризація ключів
const categories = {
  placeholders: [],
  legacy: [],
  safe: [],
  risky: []
}

for (const key of unusedKeys) {
  if (key.includes('${')) {
    categories.placeholders.push(key)
  } else if (key.startsWith('tutor.invitedStudents') || key.startsWith('limits.types')) {
    categories.legacy.push(key)
  } else if (key.startsWith('common.') || key.startsWith('nav.')) {
    categories.risky.push(key)
  } else {
    categories.safe.push(key)
  }
}

console.log('\n[cleanup-unused-keys] Categories:')
console.log(`  Placeholders (${categories.placeholders.length}): template keys with \${} - KEEP`)
console.log(`  Legacy (${categories.legacy.length}): old/deprecated keys - SAFE TO REMOVE`)
console.log(`  Safe (${categories.safe.length}): domain-specific unused keys - REVIEW`)
console.log(`  Risky (${categories.risky.length}): common/nav keys - KEEP (might be used dynamically)`)

console.log('\n[cleanup-unused-keys] Recommendation:')
console.log('  - Keep placeholders and risky keys')
console.log('  - Review safe keys manually')
console.log('  - Remove legacy keys if confirmed')

console.log('\n[cleanup-unused-keys] To proceed with cleanup, implement deletion logic.')
console.log('[cleanup-unused-keys] For now, this is a dry-run analysis only.')

process.exit(0)
