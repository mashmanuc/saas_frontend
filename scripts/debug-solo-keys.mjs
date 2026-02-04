import fs from 'node:fs'
import path from 'node:path'

const ukPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'uk.json')
const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'))

function flattenKeys(obj, prefix = '', collector = new Map()) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return collector

  for (const [k, v] of Object.entries(obj)) {
    const next = prefix ? `${prefix}.${k}` : k
    
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenKeys(v, next, collector)
    } else {
      collector.set(next, v)
    }
  }

  return collector
}

const allKeys = flattenKeys(ukData)

const testKeys = [
  'soloWorkspace.toolbar.sections.draw',
  'soloWorkspace.toolbar.tools.pen',
  'soloWorkspace.toolbar.shortcuts.pen',
  'marketplace.profile.about.notProvided',
  'marketplace.profile.calendar.notConfigured',
  'common.yes',
  'common.no'
]

console.log('Testing keys existence in uk.json:')
testKeys.forEach(key => {
  const exists = allKeys.has(key)
  console.log(`  ${key}: ${exists ? '✓ EXISTS' : '✗ MISSING'}`)
  if (exists) {
    console.log(`    Value: "${allKeys.get(key)}"`)
  }
})

console.log(`\nTotal keys in uk.json: ${allKeys.size}`)
