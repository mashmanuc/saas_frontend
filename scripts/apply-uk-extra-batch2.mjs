import fs from 'node:fs'
import path from 'node:path'

const translations = [
  ['calendar.calendar.legend.title', 'Легенда кольорів'],
  ['calendar.calendar.marketplace.availability.cta', 'Забронювати урок'],
  ['calendar.calendar.marketplace.availability.empty', 'Наразі немає вільних слотів'],
  ['calendar.calendar.marketplace.availability.error', 'Не вдалося завантажити доступність'],
  ['calendar.calendar.marketplace.availability.nextWeek', 'Наступний тиждень'],
  ['calendar.calendar.marketplace.availability.prevWeek', 'Попередній тиждень'],
  ['calendar.calendar.marketplace.availability.retry', 'Повторити'],
  ['calendar.calendar.marketplace.availability.title', 'Доступні слоти'],
  ['calendar.calendar.marketplace.availability.weekRange', '{start} – {end}'],
  ['calendar.calendar.minutesAgo', '{count} хв тому'],
  ['calendar.calendar.no_show.comment_optional', 'Коментар (опційно)'],
  ['calendar.calendar.no_show.comment_placeholder', 'Додайте додаткову інформацію...'],
  ['calendar.calendar.no_show.confirm', 'Підтвердити'],
  ['calendar.calendar.no_show.description', 'Поясніть, чому учень не прийшов на урок'],
  ['calendar.calendar.no_show.reasons.other', 'Інша причина'],
  ['calendar.calendar.no_show.reasons.student_absent', 'Учень не зʼявився'],
  ['calendar.calendar.no_show.reasons.student_late', 'Учень запізнився більше ніж на 15 хв'],
  ['calendar.calendar.no_show.reasons.technical_issues', 'Технічні проблеми'],
  ['calendar.calendar.no_show.select_reason', 'Оберіть причину no-show'],
  ['calendar.calendar.notifications.availabilityUpdated', 'Розклад оновлено'],
  ['calendar.calendar.notifications.slotBooked', '{student} забронював(-ла) слот о {time}'],
  ['calendar.calendar.oneMinuteAgo', 'хвилину тому'],
  ['calendar.calendar.pendingJobs', 'Виконується синхронізація календаря…'],
  ['calendar.calendar.realtime.status.connected', 'Підключено в реальному часі'],
  ['calendar.calendar.realtime.status.disconnected', 'Зʼєднання втрачено. Відновлюємо...'],
  ['calendar.calendar.realtime.status.retrying', 'Відновлюємо зʼєднання...'],
  ['calendar.calendar.regularity.once_a_week', 'Раз на тиждень'],
  ['calendar.calendar.regularity.single', 'Разово'],
  ['calendar.calendar.regularity.twice_a_week', 'Двічі на тиждень'],
  ['calendar.calendar.sidebar.noUpcoming', 'Немає майбутніх уроків'],
  ['calendar.calendar.sidebar.status.paid', 'Оплачено'],
  ['calendar.calendar.sidebar.status.unpaid', 'Не оплачено'],
  ['calendar.calendar.sidebar.today', 'Сьогодні'],
  ['calendar.calendar.sidebar.tomorrow', 'Завтра'],
  ['calendar.calendar.sidebar.upcomingLessons', 'Найближчі уроки'],
  ['calendar.calendar.slotBecameUnavailable', 'Обраний слот більше недоступний'],
  ['calendar.calendar.syncStatus.error', 'Помилка синхронізації'],
  ['calendar.calendar.syncStatus.synced', 'Синхронізовано'],
  ['calendar.calendar.syncStatus.syncing', 'Синхронізуємо...'],
  ['calendar.calendar.warnings.disconnected', 'Зʼєднання втрачено. Перевірте мережу або оновіть сторінку.'],
  ['calendar.calendar.warnings.offline', 'Ви офлайн. Спробуйте ще раз.'],
  ['calendar.calendar.weekNavigation.availableHours', '{hours} год доступні'],
  ['calendar.calendar.weekNavigation.backToCalendar', 'Повернутися до календаря'],
  ['calendar.calendar.weekNavigation.createSlot', 'Додати слот'],
  ['calendar.calendar.weekNavigation.goToFirstAvailable', 'До першого доступного слоту'],
  ['calendar.calendar.weekNavigation.nextWeek', 'Наступний тиждень'],
  ['calendar.calendar.weekNavigation.noAvailability', 'На цей тиждень доступність ще не налаштована'],
  ['calendar.calendar.weekNavigation.prevWeek', 'Попередній тиждень'],
  ['calendar.calendar.weekNavigation.setupAvailability', 'Встановити години'],
  ['calendar.calendar.weekNavigation.showGuide', 'Показати гайд'],
  ['calendar.calendar.weekNavigation.today', 'Сьогодні'],
  ['calendar.calendar.weekOf', 'Тиждень {date}'],
  ['calendar.draftNotice', 'Чернетка. Не забудьте застосувати зміни.'],
  ['calendar.errors.blockFailed', 'Не вдалося заблокувати слот'],
  ['calendar.errors.loadFailed', 'Не вдалося завантажити календар'],
  ['calendar.justNow', 'щойно'],
  ['calendar.lastSyncLabel', 'Остання синхронізація: {datetime}'],
  ['calendar.marketplace.availability.cta', 'Забронювати урок'],
  ['calendar.marketplace.availability.empty', 'Наразі немає вільних слотів'],
  ['calendar.marketplace.availability.error', 'Не вдалося завантажити доступність'],
  ['calendar.marketplace.availability.nextWeek', 'Наступний тиждень'],
  ['calendar.marketplace.availability.prevWeek', 'Попередній тиждень'],
  ['calendar.marketplace.availability.retry', 'Повторити'],
  ['calendar.marketplace.availability.title', 'Доступні слоти'],
  ['calendar.marketplace.availability.weekRange', '{start} – {end}'],
  ['calendar.marketplace.blockSlot.block', 'Заблокувати слот'],
  ['calendar.marketplace.blockSlot.blocking', 'Блокуємо слот...'],
  ['calendar.marketplace.blockSlot.error', 'Не вдалося заблокувати слот'],
  ['calendar.marketplace.blockSlot.errors.cannotBlockBooked', 'Неможливо заблокувати вже заброньований слот'],
  ['calendar.marketplace.blockSlot.errors.cannotBlockPast', 'Неможливо заблокувати слот у минулому'],
  ['calendar.marketplace.blockSlot.reason', 'Причина блокування'],
  ['calendar.marketplace.blockSlot.reasonPlaceholder', 'Опишіть, чому блокуєте цей час (опційно)...'],
  ['calendar.marketplace.blockSlot.success', 'Слот успішно заблоковано'],
  ['calendar.marketplace.blockSlot.title', 'Заблокувати часовий слот'],
  ['calendar.marketplace.blockSlot.warning', 'Це зробить час недоступним для бронювання. Учні не зможуть записатися на цей період.'],
  ['calendar.marketplace.createSlot.conflictsDetected', 'Виявлено конфлікти'],
  ['calendar.marketplace.createSlot.create', 'Створити слот'],
  ['calendar.marketplace.createSlot.creating', 'Створюємо слот...'],
  ['calendar.marketplace.createSlot.error', 'Не вдалося створити слот'],
  ['calendar.marketplace.createSlot.success', 'Слот створено'],
  ['calendar.marketplace.createSlot.timeRange', 'Часовий діапазон'],
  ['calendar.marketplace.createSlot.title', 'Створити новий слот'],
  ['calendar.marketplace.jobStatus.failed.details', 'Спробуйте ще раз або зверніться в підтримку'],
  ['calendar.marketplace.jobStatus.failed.title', 'Не вдалося згенерувати'],
  ['calendar.marketplace.jobStatus.pending.details', 'Ваш розклад обробляється'],
  ['calendar.marketplace.jobStatus.pending.title', 'Готуємо доступність...'],
  ['calendar.marketplace.jobStatus.retry', 'Повторна генерація...'],
  ['calendar.marketplace.jobStatus.retryError', 'Не вдалося повторити генерацію. Спробуйте пізніше.'],
  ['calendar.marketplace.jobStatus.running.details', 'Це може зайняти до 30 секунд'],
  ['calendar.marketplace.jobStatus.running.title', 'Генеруємо доступні слоти...'],
  ['calendar.marketplace.jobStatus.success.details', 'Створено {created} слотів, видалено {deleted} старих'],
  ['calendar.marketplace.jobStatus.success.title', 'Доступність оновлено!'],
  ['calendar.marketplace.slotEditor.batchError', 'Помилка пакетного оновлення'],
  ['calendar.marketplace.slotEditor.batchPartialSuccess', 'Оновлено {success} слотів, помилок: {error}'],
  ['calendar.marketplace.slotEditor.batchSuccess', 'Усі слоти успішно оновлено'],
  ['calendar.marketplace.slotEditor.conflictError', 'Виявлено конфлікт. Вирішіть їх перед збереженням.'],
  ['calendar.marketplace.slotEditor.conflictPersists', 'Конфлікт не зник. Перезавантажте сторінку та спробуйте ще раз.'],
  ['calendar.marketplace.slotEditor.delete', 'Видалити'],
  ['calendar.marketplace.slotEditor.deleteConfirm', 'Ви впевнені, що хочете видалити цей слот?'],
  ['calendar.marketplace.slotEditor.deleteError', 'Не вдалося видалити слот']
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
console.log(`[apply-uk-extra-batch2] Updated ${translations.length} keys in uk.json`)
