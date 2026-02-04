import fs from 'node:fs'
import path from 'node:path'

const ukPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'uk.json')
const enPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'en.json')

const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'))
const enData = JSON.parse(fs.readFileSync(enPath, 'utf-8'))

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

function setNestedKey(obj, path, value) {
  const parts = path.split('.')
  let current = obj
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]
    if (!current[part] || typeof current[part] !== 'object') {
      current[part] = {}
    }
    current = current[part]
  }
  
  current[parts[parts.length - 1]] = value
}

const ukFlat = flattenKeys(ukData)
const enFlat = flattenKeys(enData)

// Знайти missing keys в en.json
const missingKeys = []
for (const [key] of ukFlat) {
  if (!enFlat.has(key)) {
    missingKeys.push(key)
  }
}

console.log(`Found ${missingKeys.length} missing keys in en.json`)

// Додати missing keys з placeholder перекладами
let addedCount = 0
for (const key of missingKeys) {
  const ukValue = ukFlat.get(key)
  // Використовуємо UK значення як placeholder для EN
  setNestedKey(enData, key, ukValue)
  addedCount++
}

fs.writeFileSync(enPath, JSON.stringify(enData, null, 2) + '\n', 'utf-8')

console.log(`✓ Added ${addedCount} missing keys to en.json`)
