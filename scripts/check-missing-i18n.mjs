#!/usr/bin/env node
/**
 * Перевірка відсутніх ключів в ru.json по блоках
 * Показує статистику без додавання ключів
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales')
const UK_PATH = path.join(LOCALES_DIR, 'uk.json')
const RU_PATH = path.join(LOCALES_DIR, 'ru.json')

const BLOCKS = {
  nav: ['nav', 'sidebar', 'menu'],
  dashboard: ['dashboard', 'stats', 'greeting', 'todaySchedule', 'quickActions', 'newInquiries', 'studentsPage'],
  auth: ['auth', 'login', 'register', 'password', 'verification'],
  profile: ['profile', 'tutor', 'student', 'settings', 'account'],
  booking: ['booking', 'calendar', 'availability', 'lesson', 'lessonLinks'],
  marketplace: ['marketplace', 'filters', 'search', 'card'],
  chat: ['chat', 'messages', 'negotiation'],
  notifications: ['notifications', 'bell', 'push'],
  billing: ['billing', 'payment', 'subscription', 'contacts'],
  common: ['common', 'button', 'form', 'validation', 'error', 'loader', 'modal'],
  learning: ['learningContent', 'template', 'knowledge'],
  winterboard: ['winterboard', 'board', 'solo'],
  staff: ['staff', 'admin'],
  other: [], // Всі інші ключі
}

function getAllKeys(obj, prefix = '') {
  const keys = []
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  
  return keys
}

function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function getBlockForKey(keyPath) {
  for (const [blockName, prefixes] of Object.entries(BLOCKS)) {
    if (blockName === 'other') continue
    if (prefixes.some(prefix => keyPath.startsWith(prefix))) {
      return blockName
    }
  }
  return 'other'
}

function main() {
  console.log('🔍 Аналіз відсутніх ключів в ru.json...\n')
  
  const ukData = JSON.parse(fs.readFileSync(UK_PATH, 'utf-8'))
  const ruData = JSON.parse(fs.readFileSync(RU_PATH, 'utf-8'))
  
  const ukKeys = getAllKeys(ukData)
  const missingByBlock = {}
  
  // Ініціалізуємо лічильники
  for (const blockName of Object.keys(BLOCKS)) {
    missingByBlock[blockName] = []
  }
  
  // Перевіряємо кожен ключ
  for (const keyPath of ukKeys) {
    const ruValue = getValueByPath(ruData, keyPath)
    
    if (ruValue === undefined) {
      const block = getBlockForKey(keyPath)
      missingByBlock[block].push(keyPath)
    }
  }
  
  // Виводимо статистику
  const totalMissing = Object.values(missingByBlock).reduce((sum, arr) => sum + arr.length, 0)
  
  console.log(`📊 Всього ключів в uk.json: ${ukKeys.length}`)
  console.log(`❌ Відсутніх в ru.json: ${totalMissing}\n`)
  
  if (totalMissing === 0) {
    console.log('✅ Всі ключі синхронізовані!')
    return
  }
  
  console.log('📦 Відсутні ключі по блоках:\n')
  
  // Сортуємо блоки по кількості відсутніх ключів
  const sortedBlocks = Object.entries(missingByBlock)
    .filter(([_, keys]) => keys.length > 0)
    .sort((a, b) => b[1].length - a[1].length)
  
  for (const [blockName, missingKeys] of sortedBlocks) {
    const prefixes = BLOCKS[blockName].length > 0 
      ? BLOCKS[blockName].join(', ') 
      : 'інші ключі'
    
    console.log(`${blockName.padEnd(15)} ${String(missingKeys.length).padStart(4)} ключів  (${prefixes})`)
    
    // Показуємо перші 3 приклади
    if (missingKeys.length > 0) {
      const examples = missingKeys.slice(0, 3)
      for (const key of examples) {
        console.log(`                     └─ ${key}`)
      }
      if (missingKeys.length > 3) {
        console.log(`                     └─ ... та ще ${missingKeys.length - 3}`)
      }
    }
    console.log()
  }
  
  console.log('\n💡 Для синхронізації запустіть:')
  console.log('   npm run i18n:sync-ru -- --block=<назва_блоку>')
  console.log('\nАбо синхронізуйте всі блоки одразу:')
  console.log('   npm run i18n:sync-ru')
}

main()
