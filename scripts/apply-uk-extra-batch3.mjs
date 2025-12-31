import fs from 'node:fs'
import path from 'node:path'

const translations = [
  ['calendar.marketplace.slotEditor.deleteSuccess', 'Слот успішно видалено'],
  ['calendar.marketplace.slotEditor.errors.endBeforeStart', 'Час завершення має бути після початку'],
  ['calendar.marketplace.slotEditor.overrideReason', 'Причина перевизначення'],
  ['calendar.marketplace.slotEditor.overrideReasonPlaceholder', 'Опишіть причину зміни цього слоту...'],
  ['calendar.marketplace.slotEditor.saveError', 'Не вдалося зберегти слот'],
  ['calendar.marketplace.slotEditor.saveSuccess', 'Слот успішно збережено'],
  ['calendar.marketplace.slotEditor.saving', 'Зберігаємо...'],
  ['calendar.marketplace.slotEditor.strategies.override.description', 'Змінити слот попри конфлікти'],
  ['calendar.marketplace.slotEditor.strategies.override.title', 'Перевизначити'],
  ['calendar.marketplace.slotEditor.strategies.update_slot.description', 'Оновити лише цей конкретний слот'],
  ['calendar.marketplace.slotEditor.strategies.update_slot.title', 'Оновити слот'],
  ['calendar.marketplace.slotEditor.strategies.update_template.description', 'Оновити шаблон доступності для майбутніх слотів'],
  ['calendar.marketplace.slotEditor.strategies.update_template.title', 'Оновити шаблон'],
  ['calendar.marketplace.slotEditor.strategy', 'Стратегія редагування'],
  ['calendar.marketplace.slotEditor.timeRange', 'Часовий діапазон'],
  ['calendar.marketplace.slotEditor.title', 'Редагувати слот'],
  ['calendar.marketplace.status.available', 'Доступний'],
  ['calendar.marketplace.status.blocked', 'Заблокований'],
  ['calendar.marketplace.status.booked', 'Заброньований'],
  ['calendar.marketplace.timeRange.end', 'Кінець'],
  ['calendar.marketplace.timeRange.errors.endBeforeStart', 'Час завершення не може бути раніше початку'],
  ['calendar.marketplace.timeRange.errors.tooLong', 'Максимальна тривалість — {max} хвилин'],
  ['calendar.marketplace.timeRange.errors.tooShort', 'Мінімальна тривалість — {min} хвилин'],
  ['calendar.marketplace.timeRange.options.000', '00:00'],
  ['calendar.marketplace.timeRange.options.030', '00:30'],
  ['calendar.marketplace.timeRange.options.100', '01:00'],
  ['calendar.marketplace.timeRange.options.1000', '10:00'],
  ['calendar.marketplace.timeRange.options.1030', '10:30'],
  ['calendar.marketplace.timeRange.options.1100', '11:00'],
  ['calendar.marketplace.timeRange.options.1130', '11:30'],
  ['calendar.marketplace.timeRange.options.1200', '12:00'],
  ['calendar.marketplace.timeRange.options.1230', '12:30'],
  ['calendar.marketplace.timeRange.options.130', '01:30'],
  ['calendar.marketplace.timeRange.options.1300', '13:00'],
  ['calendar.marketplace.timeRange.options.1330', '13:30'],
  ['calendar.marketplace.timeRange.options.1400', '14:00'],
  ['calendar.marketplace.timeRange.options.1430', '14:30'],
  ['calendar.marketplace.timeRange.options.1500', '15:00'],
  ['calendar.marketplace.timeRange.options.1530', '15:30'],
  ['calendar.marketplace.timeRange.options.1600', '16:00'],
  ['calendar.marketplace.timeRange.options.1630', '16:30'],
  ['calendar.marketplace.timeRange.options.1700', '17:00'],
  ['calendar.marketplace.timeRange.options.1730', '17:30'],
  ['calendar.marketplace.timeRange.options.1800', '18:00'],
  ['calendar.marketplace.timeRange.options.1830', '18:30'],
  ['calendar.marketplace.timeRange.options.1900', '19:00'],
  ['calendar.marketplace.timeRange.options.1930', '19:30'],
  ['calendar.marketplace.timeRange.options.200', '02:00'],
  ['calendar.marketplace.timeRange.options.2000', '20:00'],
  ['calendar.marketplace.timeRange.options.2030', '20:30'],
  ['calendar.marketplace.timeRange.options.2100', '21:00'],
  ['calendar.marketplace.timeRange.options.2130', '21:30'],
  ['calendar.marketplace.timeRange.options.2200', '22:00'],
  ['calendar.marketplace.timeRange.options.2230', '22:30'],
  ['calendar.marketplace.timeRange.options.230', '02:30'],
  ['calendar.marketplace.timeRange.options.2300', '23:00'],
  ['calendar.marketplace.timeRange.options.2330', '23:30'],
  ['calendar.marketplace.timeRange.options.300', '03:00'],
  ['calendar.marketplace.timeRange.options.330', '03:30'],
  ['calendar.marketplace.timeRange.options.400', '04:00'],
  ['calendar.marketplace.timeRange.options.430', '04:30'],
  ['calendar.marketplace.timeRange.options.500', '05:00'],
  ['calendar.marketplace.timeRange.options.530', '05:30'],
  ['calendar.marketplace.timeRange.options.600', '06:00'],
  ['calendar.marketplace.timeRange.options.630', '06:30'],
  ['calendar.marketplace.timeRange.options.700', '07:00'],
  ['calendar.marketplace.timeRange.options.730', '07:30'],
  ['calendar.marketplace.timeRange.options.800', '08:00'],
  ['calendar.marketplace.timeRange.options.830', '08:30'],
  ['calendar.marketplace.timeRange.options.900', '09:00'],
  ['calendar.marketplace.timeRange.options.930', '09:30'],
  ['calendar.marketplace.timeRange.start', 'Початок'],
  ['calendar.minutesAgo', '{count} хв тому'],
  ['calendar.notifications.availabilityUpdated', 'Розклад оновлено'],
  ['calendar.notifications.slotBooked', '{student} забронював(-ла) слот о {time}'],
  ['calendar.oneMinuteAgo', 'хвилину тому'],
  ['calendar.pendingJobs', 'Синхронізація календаря триває…'],
  ['calendar.slotBecameUnavailable', 'Обраний слот більше недоступний'],
  ['calendar.subjects.available', 'Доступно тьюторів: {count}'],
  ['calendar.syncStatus.error', 'Помилка синхронізації'],
  ['calendar.syncStatus.synced', 'Синхронізовано'],
  ['calendar.syncStatus.syncing', 'Синхронізуємо...'],
  ['calendar.timeRange.end', 'Кінець'],
  ['calendar.timeRange.errors.endBeforeStart', 'Час завершення не може бути раніше початку'],
  ['calendar.timeRange.errors.tooLong', 'Максимальна тривалість — {max} хвилин'],
  ['calendar.timeRange.errors.tooShort', 'Мінімальна тривалість — {min} хвилин'],
  ['calendar.timeRange.options.000', '00:00'],
  ['calendar.timeRange.options.030', '00:30'],
  ['calendar.timeRange.options.100', '01:00'],
  ['calendar.timeRange.options.1000', '10:00'],
  ['calendar.timeRange.options.1030', '10:30'],
  ['calendar.timeRange.options.1100', '11:00'],
  ['calendar.timeRange.options.1130', '11:30'],
  ['calendar.timeRange.options.1200', '12:00'],
  ['calendar.timeRange.options.1230', '12:30'],
  ['calendar.timeRange.options.130', '01:30'],
  ['calendar.timeRange.options.1300', '13:00'],
  ['calendar.timeRange.options.1330', '13:30'],
  ['calendar.timeRange.options.1400', '14:00'],
  ['calendar.timeRange.options.1430', '14:30'],
  ['calendar.timeRange.options.1500', '15:00'],
  ['calendar.timeRange.options.1530', '15:30'],
  ['calendar.timeRange.options.1600', '16:00'],
  ['calendar.timeRange.options.1630', '16:30'],
  ['calendar.timeRange.options.1700', '17:00'],
  ['calendar.timeRange.options.1730', '17:30'],
  ['calendar.timeRange.options.1800', '18:00'],
  ['calendar.timeRange.options.1830', '18:30'],
  ['calendar.timeRange.options.1900', '19:00'],
  ['calendar.timeRange.options.1930', '19:30'],
  ['calendar.timeRange.options.200', '02:00'],
  ['calendar.timeRange.options.2000', '20:00'],
  ['calendar.timeRange.options.2030', '20:30'],
  ['calendar.timeRange.options.2100', '21:00'],
  ['calendar.timeRange.options.2130', '21:30'],
  ['calendar.timeRange.options.2200', '22:00'],
  ['calendar.timeRange.options.2230', '22:30'],
  ['calendar.timeRange.options.230', '02:30'],
  ['calendar.timeRange.options.2300', '23:00'],
  ['calendar.timeRange.options.2330', '23:30'],
  ['calendar.timeRange.options.300', '03:00'],
  ['calendar.timeRange.options.330', '03:30'],
  ['calendar.timeRange.options.400', '04:00'],
  ['calendar.timeRange.options.430', '04:30'],
  ['calendar.timeRange.options.500', '05:00'],
  ['calendar.timeRange.options.530', '05:30'],
  ['calendar.timeRange.options.600', '06:00'],
  ['calendar.timeRange.options.630', '06:30'],
  ['calendar.timeRange.options.700', '07:00'],
  ['calendar.timeRange.options.730', '07:30'],
  ['calendar.timeRange.options.800', '08:00'],
  ['calendar.timeRange.options.830', '08:30'],
  ['calendar.timeRange.options.900', '09:00'],
  ['calendar.timeRange.options.930', '09:30']
]

const localesDir = path.join(process.cwd(), 'src', 'i18n', 'locales')
const ukPath = path.join(localesDir, 'uk.json')
const ukData = JSON.parse(fs.readFileSync(ukPath, 'utf-8'))

function setValue(obj, keyPath, value) {
  const parts = keyPath.split('.')
  let cursor = obj
  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i]
    if (i === parts.length - 1) {
      cursor[part] = value
      return
    }
    if (!cursor[part] || typeof cursor[part] !== 'object') {
      cursor[part] = {}
    }
    cursor = cursor[part]
  }
}

for (const [key, value] of translations) {
  setValue(ukData, key, value)
}

fs.writeFileSync(ukPath, JSON.stringify(ukData, null, 2) + '\n')
console.log(`[apply-uk-extra-batch3] Updated ${translations.length} keys in uk.json`)
