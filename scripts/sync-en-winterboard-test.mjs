#!/usr/bin/env node
/**
 * Синхронізує en.json з uk.json для winterboard.test.*
 * Додає 21 missing, видаляє 7 extra
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UK_PATH = path.resolve(__dirname, '../src/i18n/locales/uk.json')
const EN_PATH = path.resolve(__dirname, '../src/i18n/locales/en.json')

const ukData = JSON.parse(fs.readFileSync(UK_PATH, 'utf8'))
const enData = JSON.parse(fs.readFileSync(EN_PATH, 'utf8'))

// Додати 21 missing keys з uk.json
const MISSING_IN_EN = {
  'winterboard.test.dragToMatch': 'Drag to match',
  'winterboard.test.dragToOrder': 'Drag to order',
  'winterboard.test.match': 'Match',
  'winterboard.test.order': 'Order',
  'winterboard.test.placeholder': 'Enter answer...',
  'winterboard.test.selectOption': 'Select option',
  'winterboard.test.selectMultiple': 'Select options',
  'winterboard.test.results.addOption': '+ option',
  'winterboard.test.results.addPair': '+ Add pair',
  'winterboard.test.results.delete': 'Delete',
  'winterboard.test.results.duplicate': 'Duplicate',
  'winterboard.test.results.gapAnswers': 'Gap answers',
  'winterboard.test.results.lock': 'Lock',
  'winterboard.test.results.unlock': 'Unlock',
  'winterboard.test.results.matchingPairs': 'Matching pairs',
  'winterboard.test.results.leftItem': 'Left column',
  'winterboard.test.results.rightItem': 'Right column',
  'winterboard.test.results.points': 'Points',
  'winterboard.test.results.position': 'Position',
  'winterboard.test.results.template': 'Template (use ___ for gaps)',
  'winterboard.test.results.templatePlaceholder': 'The capital of France is ___',
}

// Видалити 7 extra keys (не існують в uk.json)
const EXTRA_IN_EN = [
  'winterboard.classroomHub.sessions',
  'winterboard.test.edit',
  'winterboard.test.grade',
  'winterboard.test.preview',
  'winterboard.test.props.inputType',
  'winterboard.test.props.points',
  'winterboard.test.props.position',
]

function setNestedKey(obj, path, value) {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!current[key]) current[key] = {}
    current = current[key]
  }
  current[keys[keys.length - 1]] = value
}

function deleteNestedKey(obj, path) {
  const keys = path.split('.')
  let current = obj
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i]
    if (!current[key]) return false
    current = current[key]
  }
  delete current[keys[keys.length - 1]]
  return true
}

console.log('[sync-en] Синхронізую en.json з uk.json...')

// Додаю missing keys
let added = 0
for (const [key, value] of Object.entries(MISSING_IN_EN)) {
  setNestedKey(enData, key, value)
  added++
}
console.log(`[sync-en] Додано ${added} ключів`)

// Видаляю extra keys
let removed = 0
for (const key of EXTRA_IN_EN) {
  if (deleteNestedKey(enData, key)) {
    removed++
  }
}
console.log(`[sync-en] Видалено ${removed} ключів`)

fs.writeFileSync(EN_PATH, JSON.stringify(enData, null, 2) + '\n', 'utf8')
console.log('[sync-en] ✅ Готово')
