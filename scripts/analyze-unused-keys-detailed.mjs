import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const ukPath = path.join(__dirname, '../src/i18n/locales/uk.json')
const uk = JSON.parse(fs.readFileSync(ukPath, 'utf8'))

// Flatten keys
function flattenKeys(obj, prefix = '') {
  let result = []
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      result = result.concat(flattenKeys(value, fullKey))
    } else {
      result.push(fullKey)
    }
  }
  return result
}

const allKeys = flattenKeys(uk)

// Search for key usage in codebase
function searchKeyUsage(key) {
  const srcDir = path.join(__dirname, '../src')
  const files = []
  
  function walkDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        walkDir(fullPath)
      } else if (entry.isFile() && (entry.name.endsWith('.vue') || entry.name.endsWith('.ts') || entry.name.endsWith('.js'))) {
        files.push(fullPath)
      }
    }
  }
  
  walkDir(srcDir)
  
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8')
    if (content.includes(key)) {
      return true
    }
  }
  return false
}

// Classify unused keys
const categories = {
  templateVariables: [],
  billingFeatures: [],
  calendarDomain: [],
  bookingDomain: [],
  classroomDomain: [],
  marketplaceDomain: [],
  authMFA: [],
  commonWeekdays: [],
  tutorDomain: [],
  deprecated: [],
  other: []
}

console.log('Analyzing 810 unused keys...\n')

for (const key of allKeys) {
  const isUsed = searchKeyUsage(key)
  if (isUsed) continue // Skip used keys
  
  // Classify
  if (key.includes('${') || key.includes('{') || key.includes('*')) {
    categories.templateVariables.push(key)
  } else if (key.startsWith('billing.features') || key.startsWith('billing.planDescriptions') || key.startsWith('billing.statuses')) {
    categories.billingFeatures.push(key)
  } else if (key.startsWith('calendar.')) {
    categories.calendarDomain.push(key)
  } else if (key.startsWith('booking.')) {
    categories.bookingDomain.push(key)
  } else if (key.startsWith('classroom.')) {
    categories.classroomDomain.push(key)
  } else if (key.startsWith('marketplace.')) {
    categories.marketplaceDomain.push(key)
  } else if (key.startsWith('auth.mfa')) {
    categories.authMFA.push(key)
  } else if (key.includes('weekday') || key.includes('weekdays')) {
    categories.commonWeekdays.push(key)
  } else if (key.startsWith('tutor.')) {
    categories.tutorDomain.push(key)
  } else if (key.includes('Placeholder') || key.includes('deprecated')) {
    categories.deprecated.push(key)
  } else {
    categories.other.push(key)
  }
}

// Report
console.log('=== UNUSED KEYS CLASSIFICATION ===\n')
console.log(`Template Variables (${categories.templateVariables.length}):`)
console.log(categories.templateVariables.slice(0, 10).join('\n'))
if (categories.templateVariables.length > 10) console.log(`... and ${categories.templateVariables.length - 10} more\n`)

console.log(`\nBilling Features (${categories.billingFeatures.length}):`)
console.log(categories.billingFeatures.slice(0, 10).join('\n'))
if (categories.billingFeatures.length > 10) console.log(`... and ${categories.billingFeatures.length - 10} more\n`)

console.log(`\nCalendar Domain (${categories.calendarDomain.length}):`)
console.log(categories.calendarDomain.slice(0, 10).join('\n'))
if (categories.calendarDomain.length > 10) console.log(`... and ${categories.calendarDomain.length - 10} more\n`)

console.log(`\nBooking Domain (${categories.bookingDomain.length}):`)
console.log(categories.bookingDomain.slice(0, 10).join('\n'))
if (categories.bookingDomain.length > 10) console.log(`... and ${categories.bookingDomain.length - 10} more\n`)

console.log(`\nClassroom Domain (${categories.classroomDomain.length}):`)
console.log(categories.classroomDomain.slice(0, 10).join('\n'))
if (categories.classroomDomain.length > 10) console.log(`... and ${categories.classroomDomain.length - 10} more\n`)

console.log(`\nMarketplace Domain (${categories.marketplaceDomain.length}):`)
console.log(categories.marketplaceDomain.slice(0, 10).join('\n'))
if (categories.marketplaceDomain.length > 10) console.log(`... and ${categories.marketplaceDomain.length - 10} more\n`)

console.log(`\nTutor Domain (${categories.tutorDomain.length}):`)
console.log(categories.tutorDomain.slice(0, 10).join('\n'))
if (categories.tutorDomain.length > 10) console.log(`... and ${categories.tutorDomain.length - 10} more\n`)

console.log(`\nDeprecated/Placeholders (${categories.deprecated.length}):`)
console.log(categories.deprecated.slice(0, 10).join('\n'))
if (categories.deprecated.length > 10) console.log(`... and ${categories.deprecated.length - 10} more\n`)

console.log(`\nOther (${categories.other.length}):`)
console.log(categories.other.slice(0, 20).join('\n'))
if (categories.other.length > 20) console.log(`... and ${categories.other.length - 20} more\n`)

// Save report
const report = {
  timestamp: new Date().toISOString(),
  totalUnused: Object.values(categories).reduce((sum, arr) => sum + arr.length, 0),
  categories: Object.fromEntries(
    Object.entries(categories).map(([name, keys]) => [name, { count: keys.length, keys }])
  )
}

fs.writeFileSync(
  path.join(__dirname, '../i18n-unused-analysis.json'),
  JSON.stringify(report, null, 2)
)

console.log('\n✓ Report saved to i18n-unused-analysis.json')
