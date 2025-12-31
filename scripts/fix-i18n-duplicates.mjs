import fs from 'node:fs'
import path from 'node:path'

const LOCALES_DIR = path.join(process.cwd(), 'src', 'i18n', 'locales')

function mergeDuplicateKeys(obj, seen = new Set(), path = '') {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    return obj
  }

  const result = {}
  const keys = Object.keys(obj)
  
  for (const key of keys) {
    const currentPath = path ? `${path}.${key}` : key
    
    if (result[key] !== undefined) {
      console.log(`[fix-duplicates] Merging duplicate key: ${currentPath}`)
      if (typeof result[key] === 'object' && typeof obj[key] === 'object') {
        result[key] = { ...result[key], ...obj[key] }
      }
    } else {
      result[key] = mergeDuplicateKeys(obj[key], seen, currentPath)
    }
  }
  
  return result
}

function fixLocaleFile(locale) {
  const filePath = path.join(LOCALES_DIR, `${locale}.json`)
  
  if (!fs.existsSync(filePath)) {
    console.log(`[fix-duplicates] Skipping ${locale}.json - file not found`)
    return
  }
  
  console.log(`[fix-duplicates] Processing ${locale}.json...`)
  
  const raw = fs.readFileSync(filePath, 'utf-8')
  const data = JSON.parse(raw)
  
  const fixed = mergeDuplicateKeys(data)
  
  fs.writeFileSync(filePath, JSON.stringify(fixed, null, 2) + '\n', 'utf-8')
  console.log(`[fix-duplicates] ✓ Fixed ${locale}.json`)
}

const locales = ['uk', 'en', 'pl', 'de']

for (const locale of locales) {
  fixLocaleFile(locale)
}

console.log('\n[fix-duplicates] Done!')
