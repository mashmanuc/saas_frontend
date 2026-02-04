import fs from 'node:fs'
import path from 'node:path'

const enPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'en.json')
const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'))

// Видалити 4 extra keys
function deleteNestedKey(obj, path) {
  const parts = path.split('.')
  let current = obj
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!current[part]) return false
    current = current[part]
  }
  
  const lastPart = parts[parts.length - 1]
  if (current[lastPart] !== undefined) {
    delete current[lastPart]
    return true
  }
  return false
}

const extraKeys = [
  'calendar.availability.calendar.notConfigured',
  'calendar.availability.calendar.title',
  'common.ok',
  'lessons.calendar.infoNote'
]

let removedCount = 0
for (const key of extraKeys) {
  if (deleteNestedKey(enData, key)) {
    console.log(`✓ Removed: ${key}`)
    removedCount++
  } else {
    console.log(`✗ Not found: ${key}`)
  }
}

// Очистити порожні об'єкти
function cleanEmptyObjects(obj) {
  for (const key in obj) {
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      cleanEmptyObjects(obj[key])
      if (Object.keys(obj[key]).length === 0) {
        delete obj[key]
      }
    }
  }
}

cleanEmptyObjects(enData)

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n', 'utf-8')

console.log(`\n✓ Removed ${removedCount} extra keys from en.json`)
