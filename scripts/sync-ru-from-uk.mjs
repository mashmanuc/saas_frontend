#!/usr/bin/env node
/**
 * Sync Russian i18n keys from Ukrainian
 * 
 * Порівнює uk.json і ru.json та додає відсутні ключі в ru.json.
 * Використовує машинний переклад для значень (placeholder).
 * 
 * Usage: 
 *   node scripts/sync-ru-from-uk.mjs              # Всі блоки
 *   node scripts/sync-ru-from-uk.mjs --block=nav  # Тільки навігація
 *   node scripts/sync-ru-from-uk.mjs --critical   # Тільки критичні ключі
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const LOCALES_DIR = path.resolve(__dirname, '../src/i18n/locales')
const UK_PATH = path.join(LOCALES_DIR, 'uk.json')
const RU_PATH = path.join(LOCALES_DIR, 'ru.json')

// Блоки для поетапної синхронізації
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
}

// Критичні ключі (UI елементи що користувач бачить одразу)
const CRITICAL_PREFIXES = [
  'nav.',
  'sidebar.',
  'dashboard.greeting',
  'dashboard.stats',
  'dashboard.todaySchedule',
  'dashboard.quickActions',
  'dashboard.newInquiries',
  'dashboard.studentsPage',
  'dashboard.tutor.emptyState',
  'dashboard.student.emptyState',
  'menu.',
  'auth.login',
  'auth.register',
  'common.save',
  'common.cancel',
  'common.delete',
  'common.edit',
  'common.close',
  'loader.loading',
  'error.',
  'button.',
]

// Простий словник для автоматичного перекладу ключових слів
const AUTO_TRANSLATE = {
  // Загальні
  'Головна': 'Главная',
  'Налаштування': 'Настройки',
  'Профіль': 'Профиль',
  'Розклад': 'Расписание',
  'Повідомлення': 'Сообщения',
  'Запити': 'Запросы',
  'Учні': 'Ученики',
  'Тьютори': 'Репетиторы',
  'Фінанси': 'Финансы',
  'Безпека': 'Безопасность',
  'Мова': 'Язык',
  'Тема': 'Тема',
  'Вийти': 'Выйти',
  'Увійти': 'Войти',
  'Зберегти': 'Сохранить',
  'Скасувати': 'Отменить',
  'Видалити': 'Удалить',
  'Редагувати': 'Редактировать',
  'Додати': 'Добавить',
  'Закрити': 'Закрыть',
  'Відкрити': 'Открыть',
  'Завантажити': 'Загрузить',
  'Пошук': 'Поиск',
  'Фільтр': 'Фильтр',
  'Сортувати': 'Сортировать',
  'Всі': 'Все',
  'Немає': 'Нет',
  'Так': 'Да',
  'Ні': 'Нет',
  'Помилка': 'Ошибка',
  'Успіх': 'Успех',
  'Увага': 'Внимание',
  'Інформація': 'Информация',
  'Завантаження': 'Загрузка',
  'Очікування': 'Ожидание',
  'Активний': 'Активный',
  'Неактивний': 'Неактивный',
  'Новий': 'Новый',
  'Старий': 'Старый',
  // Специфічні для платформи
  'Мої учні': 'Мои ученики',
  'Мій розклад': 'Мое расписание',
  'База знань': 'База знаний',
  'Швидкі дії': 'Быстрые действия',
  'Нові запити': 'Новые запросы',
  'Доброго ранку': 'Доброе утро',
  'Добрий день': 'Добрый день',
  'Добрий вечір': 'Добрый вечер',
  'Ласкаво просимо': 'Добро пожаловать',
  'Знайти тьютора': 'Найти репетитора',
  'Створити урок': 'Создать урок',
  'Календар': 'Календарь',
  'Уроків сьогодні': 'Уроков сегодня',
  'Активних учнів': 'Активных учеников',
  'Нових запитів': 'Новых запросов',
  'Баланс': 'Баланс',
  'Майбутніх уроків': 'Будущих уроков',
  'Непрочитаних': 'Непрочитанных',
  'На сьогодні уроків не заплановано': 'На сегодня уроков не запланировано',
  'Весь розклад': 'Все расписание',
  'Всі запити': 'Все запросы',
  'Прийняти': 'Принять',
  'Відхилити': 'Отклонить',
  'хоче вивчати': 'хочет изучать',
  'Мої учні': 'Мои ученики',
  'Керуйте вашими учнями, запитами та комунікацією': 'Управляйте вашими учениками, запросами и коммуникацией',
  'Почніть свій шлях тьютора': 'Начните свой путь репетитора',
  'Заповніть профіль і відкрийте доступність — учні вже чекають!': 'Заполните профиль и откройте доступность — ученики уже ждут!',
  'Заповнити профіль': 'Заполнить профіль',
  'Знайдіть свого першого тьютора і почніть навчання': 'Найдите своего первого репетитора и начните обучение',
  'Мій профіль': 'Мой профиль',
  'Меню користувача': 'Меню пользователя',
  'Налаштування та профіль': 'Настройки и профиль',
  'Головна навігація': 'Главная навигация',
  'Згорнути меню': 'Свернуть меню',
  'Розгорнути меню': 'Развернуть меню',
  'Закрити меню': 'Закрыть меню',
  'нових': 'новых',
  'Основне': 'Основное',
  'Навчання': 'Обучение',
  'Бізнес': 'Бизнес',
  'Система': 'Система',
  'Дошка': 'Доска',
  'Сповіщення': 'Уведомления',
  'Класи': 'Классы',
}

function autoTranslate(ukText) {
  // Спроба автоперекладу
  for (const [uk, ru] of Object.entries(AUTO_TRANSLATE)) {
    if (ukText === uk) return ru
  }
  
  // Якщо не знайдено точного збігу, повертаємо з позначкою
  return `[TODO-RU] ${ukText}`
}

function getAllKeys(obj, prefix = '') {
  const keys = []
  
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...getAllKeys(value, fullKey))
    } else {
      keys.push({ path: fullKey, value })
    }
  }
  
  return keys
}

function getValueByPath(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj)
}

function setValueByPath(obj, path, value) {
  const keys = path.split('.')
  const lastKey = keys.pop()
  const target = keys.reduce((current, key) => {
    // Якщо ключ не існує або є примітивом (string/number), створюємо об'єкт
    if (!current[key] || typeof current[key] !== 'object' || Array.isArray(current[key])) {
      current[key] = {}
    }
    return current[key]
  }, obj)
  target[lastKey] = value
}

function isCriticalKey(keyPath) {
  return CRITICAL_PREFIXES.some(prefix => keyPath.startsWith(prefix))
}

function shouldIncludeKey(keyPath, blockFilter, criticalOnly) {
  if (criticalOnly) {
    return isCriticalKey(keyPath)
  }
  
  if (blockFilter) {
    const blockPrefixes = BLOCKS[blockFilter]
    if (!blockPrefixes) {
      console.error(`❌ Невідомий блок: ${blockFilter}`)
      console.log(`Доступні блоки: ${Object.keys(BLOCKS).join(', ')}`)
      process.exit(1)
    }
    return blockPrefixes.some(prefix => keyPath.startsWith(prefix))
  }
  
  return true // Всі ключі
}

function main() {
  // Парсимо аргументи
  const args = process.argv.slice(2)
  const blockArg = args.find(arg => arg.startsWith('--block='))
  const criticalOnly = args.includes('--critical')
  const blockFilter = blockArg ? blockArg.split('=')[1] : null
  
  console.log('🔍 Читаю uk.json та ru.json...\n')
  
  const ukData = JSON.parse(fs.readFileSync(UK_PATH, 'utf-8'))
  const ruData = JSON.parse(fs.readFileSync(RU_PATH, 'utf-8'))
  
  const ukKeys = getAllKeys(ukData)
  const missingKeys = []
  const addedKeys = []
  const skippedKeys = []
  
  console.log(`📊 Всього ключів в uk.json: ${ukKeys.length}`)
  
  if (criticalOnly) {
    console.log('⚡ Режим: тільки критичні ключі (UI)')
  } else if (blockFilter) {
    console.log(`📦 Режим: блок "${blockFilter}"`)
    console.log(`   Префікси: ${BLOCKS[blockFilter].join(', ')}`)
  } else {
    console.log('📦 Режим: всі блоки')
  }
  console.log()
  
  // Перевіряємо кожен ключ з uk.json
  for (const { path, value } of ukKeys) {
    const ruValue = getValueByPath(ruData, path)
    
    if (ruValue === undefined) {
      // Перевіряємо чи потрібно додавати цей ключ
      if (!shouldIncludeKey(path, blockFilter, criticalOnly)) {
        skippedKeys.push(path)
        continue
      }
      
      missingKeys.push({ path, value })
      
      // Додаємо ключ в ru.json
      const translatedValue = typeof value === 'string' 
        ? autoTranslate(value)
        : value
      
      setValueByPath(ruData, path, translatedValue)
      addedKeys.push({ path, original: value, translated: translatedValue })
    }
  }
  
  console.log(`❌ Відсутніх ключів в ru.json: ${missingKeys.length}`)
  
  if (skippedKeys.length > 0) {
    console.log(`⏭️  Пропущено (не входять в фільтр): ${skippedKeys.length}`)
  }
  console.log()
  
  if (missingKeys.length === 0) {
    console.log('✅ Всі ключі синхронізовані! ru.json повністю відповідає uk.json')
    return
  }
  
  if (addedKeys.length === 0) {
    console.log('✅ Немає ключів для додавання в поточному фільтрі')
    return
  }
  
  // Виводимо список доданих ключів (обмежуємо до 50 для читабельності)
  const displayLimit = 50
  console.log(`📝 Додані ключі (показано ${Math.min(addedKeys.length, displayLimit)} з ${addedKeys.length}):\n`)
  
  for (const { path, original, translated } of addedKeys.slice(0, displayLimit)) {
    const needsTranslation = translated.startsWith('[TODO-RU]')
    const marker = needsTranslation ? '⚠️ ' : '✅ '
    console.log(`${marker}${path}`)
    console.log(`   UK: "${original}"`)
    console.log(`   RU: "${translated}"`)
    console.log()
  }
  
  if (addedKeys.length > displayLimit) {
    console.log(`... та ще ${addedKeys.length - displayLimit} ключів\n`)
  }
  
  // Зберігаємо оновлений ru.json
  const ruJson = JSON.stringify(ruData, null, 2)
  fs.writeFileSync(RU_PATH, ruJson + '\n', 'utf-8')
  
  const todoCount = addedKeys.filter(k => k.translated.startsWith('[TODO-RU]')).length
  const autoCount = addedKeys.length - todoCount
  
  console.log('\n✅ Файл ru.json оновлено!')
  console.log(`   Додано ключів: ${addedKeys.length}`)
  console.log(`   Автоматично перекладено: ${autoCount}`)
  console.log(`   Потребують ручного перекладу: ${todoCount}`)
  
  if (skippedKeys.length > 0) {
    console.log(`   Пропущено (фільтр): ${skippedKeys.length}`)
  }
  
  if (todoCount > 0) {
    console.log('\n⚠️  Знайдіть ключі з префіксом [TODO-RU] в ru.json та перекладіть їх вручно')
  }
  
  // Підказка для наступного кроку
  if (blockFilter || criticalOnly) {
    console.log('\n💡 Підказка: Запустіть скрипт з іншим блоком для синхронізації інших ключів')
    console.log(`   Доступні блоки: ${Object.keys(BLOCKS).join(', ')}`)
  }
}

main()
