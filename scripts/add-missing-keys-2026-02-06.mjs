import fs from 'node:fs'
import path from 'node:path'

const ukPath = path.join(process.cwd(), 'src', 'i18n', 'locales', 'uk.json')
const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'))

// Додати users.settings.contacts.*
if (!ukData.users) ukData.users = {}
if (!ukData.users.settings) ukData.users.settings = {}
ukData.users.settings.contacts = {
  title: "Контактна інформація",
  description: "Керуйте вашими контактними даними для зв'язку з тьюторами та студентами",
  phone: "Номер телефону",
  phonePlaceholder: "+380501234567",
  phoneHint: "Міжнародний формат: +[код країни][номер]",
  telegram: "Telegram",
  telegramPlaceholder: "@username",
  telegramHint: "Ваш Telegram username (наприклад: @username)",
  timezone: "Часовий пояс",
  loadError: "Не вдалося завантажити контактні дані",
  saveSuccess: "Контактні дані успішно збережено",
  saveError: "Не вдалося зберегти контактні дані"
}

// Додати users.settings.profile.*
ukData.users.settings.profile = {
  title: "Профіль",
  description: "Оновіть вашу особисту інформацію",
  loadError: "Не вдалося завантажити профіль",
  saveSuccess: "Профіль успішно збережено",
  saveError: "Не вдалося зберегти профіль",
  noRole: "Роль користувача не визначена"
}

// Додати users.settings.tabs.*
ukData.users.settings.tabs = {
  general: "Загальні",
  notifications: "Сповіщення",
  privacy: "Конфіденційність"
}

// Оновити student.profile.*
if (!ukData.student) ukData.student = {}
if (!ukData.student.profile) ukData.student.profile = {}
ukData.student.profile = {
  ...ukData.student.profile,
  editTitle: "Редагування профілю студента",
  editDescription: "Оновіть вашу особисту інформацію та навчальні цілі",
  loadError: "Не вдалося завантажити профіль студента",
  notStudent: "У вас немає доступу до профілю студента",
  saveSuccess: "Профіль студента успішно збережено",
  saveError: "Не вдалося зберегти профіль студента"
}

fs.writeFileSync(ukPath, JSON.stringify(ukData, null, 2) + '\n', 'utf-8')

console.log('✓ Додано 21 missing keys в uk.json:')
console.log('  - users.settings.contacts.* (11 keys)')
console.log('  - users.settings.profile.* (6 keys)')
console.log('  - users.settings.tabs.* (3 keys)')
console.log('  - student.profile.* (оновлено 6 keys)')
