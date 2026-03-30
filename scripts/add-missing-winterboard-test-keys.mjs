#!/usr/bin/env node
/**
 * Додає відсутні winterboard.test.* та winterboard.properties.* ключі
 * Phase 39 i18n cleanup
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const UK_PATH = path.resolve(__dirname, '../src/i18n/locales/uk.json')
const EN_PATH = path.resolve(__dirname, '../src/i18n/locales/en.json')

// Відсутні ключі з i18n:check
const MISSING_KEYS_UK = {
  'winterboard.test.props.labelQuestion': 'Питання',
  'winterboard.test.props.labelPlaceholder': 'Введіть питання...',
  'winterboard.test.props.correctAnswer': 'Правильна відповідь',
  'winterboard.test.props.textType': 'Текст',
  'winterboard.test.props.numberType': 'Число',
  'winterboard.test.props.caseSensitive': 'Враховувати регістр',
  'winterboard.test.props.options': 'Варіанти відповідей',
  'winterboard.test.props.addOption': '+ Додати варіант',
  'winterboard.test.props.optionsCheckCorrect': 'Варіанти (позначте правильні)',
  'winterboard.test.props.template': 'Шаблон (використовуйте ___ для пропусків)',
  'winterboard.test.props.templatePlaceholder': 'Столиця Франції — ___',
  'winterboard.test.props.gapAnswers': 'Відповіді на пропуски',
  'winterboard.test.props.matchingPairs': 'Пари відповідностей',
  'winterboard.test.props.leftItem': 'Ліва колонка',
  'winterboard.test.props.rightItem': 'Права колонка',
  'winterboard.test.props.addPair': '+ Додати пару',
  'winterboard.test.props.duplicate': 'Дублювати',
  'winterboard.test.props.unlock': 'Розблокувати',
  'winterboard.test.props.lock': 'Заблокувати',
  'winterboard.test.props.delete': 'Видалити',
  'winterboard.properties.width': 'Ширина',
  'winterboard.test.chooseAnswer': 'Оберіть відповідь',
  'winterboard.test.inputPlaceholder': 'Введіть відповідь...',
  'winterboard.test.answer': 'Відповідь',
  'winterboard.test.checkAnswer': 'Перевірити',
  'winterboard.test.results.title': 'Результати',
  'winterboard.test.results.pts': 'балів',
  'winterboard.test.results.close': 'Закрити',
  'winterboard.test.results.question': 'Питання',
  'winterboard.test.launchTest': 'Запустити тест',
  'winterboard.test.livePhase': 'Активна фаза',
  'winterboard.test.submitGrade': 'Виставити оцінку',
  'winterboard.test.backToEdit': 'Повернутися до редагування',
  'winterboard.test.reviewPhase': 'Фаза перегляду',
  'winterboard.test.retryTest': 'Спробувати ще раз',
  'winterboard.test.exitTest': 'Вийти з тесту',
  'winterboard.test.dropdown': 'Випадаючий список',
  'winterboard.test.gapFill': 'Заповнення пропусків',
  'winterboard.test.matching': 'Відповідність',
}

const MISSING_KEYS_EN = {
  'winterboard.test.props.labelQuestion': 'Question',
  'winterboard.test.props.labelPlaceholder': 'Enter question...',
  'winterboard.test.props.correctAnswer': 'Correct answer',
  'winterboard.test.props.textType': 'Text',
  'winterboard.test.props.numberType': 'Number',
  'winterboard.test.props.caseSensitive': 'Case sensitive',
  'winterboard.test.props.options': 'Answer options',
  'winterboard.test.props.addOption': '+ Add option',
  'winterboard.test.props.optionsCheckCorrect': 'Options (check correct)',
  'winterboard.test.props.template': 'Template (use ___ for gaps)',
  'winterboard.test.props.templatePlaceholder': 'The capital of France is ___',
  'winterboard.test.props.gapAnswers': 'Gap answers',
  'winterboard.test.props.matchingPairs': 'Matching pairs',
  'winterboard.test.props.leftItem': 'Left column',
  'winterboard.test.props.rightItem': 'Right column',
  'winterboard.test.props.addPair': '+ Add pair',
  'winterboard.test.props.duplicate': 'Duplicate',
  'winterboard.test.props.unlock': 'Unlock',
  'winterboard.test.props.lock': 'Lock',
  'winterboard.test.props.delete': 'Delete',
  'winterboard.properties.width': 'Width',
  'winterboard.test.chooseAnswer': 'Choose answer',
  'winterboard.test.inputPlaceholder': 'Enter answer...',
  'winterboard.test.answer': 'Answer',
  'winterboard.test.checkAnswer': 'Check',
  'winterboard.test.results.title': 'Results',
  'winterboard.test.results.pts': 'pts',
  'winterboard.test.results.close': 'Close',
  'winterboard.test.results.question': 'Question',
  'winterboard.test.launchTest': 'Launch test',
  'winterboard.test.livePhase': 'Live phase',
  'winterboard.test.submitGrade': 'Submit grade',
  'winterboard.test.backToEdit': 'Back to edit',
  'winterboard.test.reviewPhase': 'Review phase',
  'winterboard.test.retryTest': 'Retry test',
  'winterboard.test.exitTest': 'Exit test',
  'winterboard.test.dropdown': 'Dropdown',
  'winterboard.test.gapFill': 'Gap fill',
  'winterboard.test.matching': 'Matching',
}

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

function addMissingKeys(filePath, missingKeys) {
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  
  let added = 0
  for (const [key, value] of Object.entries(missingKeys)) {
    setNestedKey(data, key, value)
    added++
  }
  
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8')
  return added
}

console.log('[add-missing-keys] Додаю відсутні winterboard.test.* ключі...')

const ukAdded = addMissingKeys(UK_PATH, MISSING_KEYS_UK)
console.log(`[add-missing-keys] uk.json: додано ${ukAdded} ключів`)

const enAdded = addMissingKeys(EN_PATH, MISSING_KEYS_EN)
console.log(`[add-missing-keys] en.json: додано ${enAdded} ключів`)

console.log('[add-missing-keys] ✅ Готово')
