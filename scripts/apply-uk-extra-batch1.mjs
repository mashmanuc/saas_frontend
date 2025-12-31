import fs from 'node:fs'
import path from 'node:path'

const translations = [
  ['analytics.activity.batchEdit', 'Пакетне редагування {count} слотів'],
  ['analytics.activity.conflictDetected', 'Виявлено конфлікт'],
  ['analytics.activity.slotEdited', 'Слот №{id} відредаговано'],
  ['analytics.availableSlots', 'Доступні слоти'],
  ['analytics.avgDuration', 'Середня тривалість'],
  ['analytics.blockedSlots', 'Заблоковані слоти'],
  ['analytics.bookedSlots', 'Заброньовані слоти'],
  ['analytics.conflictAnalysis', 'Аналіз конфліктів'],
  ['analytics.editOperations', 'Операції редагування'],
  ['analytics.failedEdits', 'Невдалі редагування'],
  ['analytics.loading', 'Завантаження аналітики...'],
  ['analytics.period.custom', 'Власний період'],
  ['analytics.period.month', 'Місяць'],
  ['analytics.period.today', 'Сьогодні'],
  ['analytics.period.week', 'Тиждень'],
  ['analytics.recentActivity', 'Остання активність'],
  ['analytics.status.error', 'Помилка'],
  ['analytics.status.success', 'Успіх'],
  ['analytics.status.warning', 'Попередження'],
  ['analytics.strategyDistribution', 'Розподіл стратегій'],
  ['analytics.successfulEdits', 'Успішні редагування'],
  ['analytics.time.daysAgo', '{count} дн. тому'],
  ['analytics.time.hoursAgo', '{count} год. тому'],
  ['analytics.time.justNow', 'Щойно'],
  ['analytics.time.minutesAgo', '{count} хв. тому'],
  ['analytics.title', 'Аналітика слотів'],
  ['analytics.totalConflicts', 'Усього конфліктів'],
  ['analytics.totalEdits', 'Усього редагувань'],
  ['analytics.totalSlots', 'Усього слотів'],
  ['availability.calendar.noSlots', 'Немає слотів'],
  ['availability.calendar.selected', 'Обрано'],
  ['availability.editor.addBlackout', 'Додати недоступну дату'],
  ['availability.editor.addOverride', 'Додати перевизначення'],
  ['availability.editor.addSlot', 'Додати слот'],
  ['availability.editor.blackoutDates', 'Недоступні дати'],
  ['availability.editor.copyWeek', 'Скопіювати тиждень'],
  ['availability.editor.overrides', 'Перевизначення'],
  ['availability.editor.preview', 'Попередній перегляд'],
  ['availability.editor.weeklyTemplate', 'Щотижневий шаблон'],
  ['booking.inviteStudent', 'Запросити нового учня'],
  ['booking.noStudentsFound', 'Учнів не знайдено'],
  ['booking.selectStudent', 'Виберіть учня'],
  ['booking.timeline.by', 'Від: {actor}'],
  ['booking.timeline.empty', 'Історія порожня'],
  ['booking.timeline.events.canceled', 'Скасовано'],
  ['booking.timeline.events.confirmed', 'Підтверджено'],
  ['booking.timeline.events.created', 'Створено'],
  ['booking.timeline.requestId', 'ID запиту'],
  ['booking.timeline.title', 'Історія бронювань'],
  ['booking.typeToSearch', 'Введіть щонайменше 2 символи'],
  ['calendar.analyticsDescription', 'Відстежуйте, як змінюються відкриті слоти щотижня.'],
  ['calendar.analyticsTitle', 'Аналітика доступності'],
  ['calendar.cache.staleLabel', "Показуємо кешовані дані. Натисніть 'Повторити', щоб оновити."],
  ['calendar.calendar.analyticsDescription', 'Відстежуйте, як змінюються відкриті слоти щотижня.'],
  ['calendar.calendar.analyticsTitle', 'Аналітика доступності'],
  ['calendar.calendar.cache.staleLabel', "Показуємо кешовані дані. Натисніть 'Повторити', щоб оновити."],
  ['calendar.calendar.draftNotice', 'Чернетка. Не забудьте застосувати зміни.'],
  ['calendar.calendar.emptyState.noAvailability.action', 'Налаштувати доступність'],
  ['calendar.calendar.emptyState.noAvailability.description', 'Налаштуйте розклад, щоб приймати бронювання від учнів'],
  ['calendar.calendar.emptyState.noAvailability.title', 'Доступність не налаштована'],
  ['calendar.calendar.errors.blockFailed', 'Не вдалося заблокувати слот'],
  ['calendar.calendar.errors.loadFailed', 'Не вдалося завантажити календар'],
  ['calendar.calendar.footer.copied', 'Скопійовано!'],
  ['calendar.calendar.footer.copy', 'Скопіювати'],
  ['calendar.calendar.footer.your_lesson_link', 'Ваш лінк на урок'],
  ['calendar.calendar.guide.availableSlot', 'Доступний слот'],
  ['calendar.calendar.guide.blockedSlot', 'Заблокований слот'],
  ['calendar.calendar.guide.bookedLesson', 'Заброньований урок'],
  ['calendar.calendar.guide.checkboxAvailability', 'Показати або сховати слоти доступності'],
  ['calendar.calendar.guide.checkboxLessons', 'Показати або сховати заброньовані уроки'],
  ['calendar.calendar.guide.checkboxes', 'Фільтри-чекбокси'],
  ['calendar.calendar.guide.colors', 'Легенда кольорів'],
  ['calendar.calendar.guide.createSlotDesc', 'Натисніть «Додати слот» або потягніть по сітці, щоб створити доступність.'],
  ['calendar.calendar.guide.editSlotDesc', 'Виберіть будь-який слот, щоб змінити час або тривалість. Для пакетних змін користуйтесь панеллю.'],
  ['calendar.calendar.guide.helpIcon', 'Потрібна допомога?'],
  ['calendar.calendar.guide.helpIconDesc', 'Натисніть іконку «?» у верхній панелі, щоб відкрити довідку або підтримку.'],
  ['calendar.calendar.guide.howToCreate', 'Як створити слоти'],
  ['calendar.calendar.guide.howToEdit', 'Як редагувати слоти'],
  ['calendar.calendar.guide.intro', 'Усе, що потрібно для керування доступністю та уроками в одному місці.'],
  ['calendar.calendar.guide.limits', 'Ліміти та поради'],
  ['calendar.calendar.guide.maxDuration', 'Слоти довші за 3 години можуть розділятися для кращої видимості.'],
  ['calendar.calendar.guide.navigation', 'Навігація'],
  ['calendar.calendar.guide.navigationDesc', 'Використовуйте стрілки або гарячі клавіші для переходу між тижнями. «Сьогодні» повертає поточний тиждень.'],
  ['calendar.calendar.guide.noDuplicates', 'Уникайте дубльованих слотів, що перекриваються.'],
  ['calendar.calendar.guide.noOverlap', 'Перекриття уроків і доступності блокується автоматично.'],
  ['calendar.calendar.guide.setupButton', 'Кнопка налаштування'],
  ['calendar.calendar.guide.setupButtonDesc', '«Встановити години» відкриває редактор доступності з повним контролем.'],
  ['calendar.calendar.guide.title', 'Гайд по календарю'],
  ['calendar.calendar.header.color_legend', 'Легенда кольорів'],
  ['calendar.calendar.header.mark_free_time', 'Позначити вільний час'],
  ['calendar.calendar.header.reminder', 'Підтримуйте календар актуальним, щоб учні могли бронювати.'],
  ['calendar.calendar.header.video_guide', 'Відео-гайд'],
  ['calendar.calendar.justNow', 'щойно'],
  ['calendar.calendar.lastSyncLabel', 'Остання синхронізація: {datetime}'],
  ['calendar.calendar.legend.availability', 'Доступність'],
  ['calendar.calendar.legend.blocked_time', 'Заблокований час'],
  ['calendar.calendar.legend.first_lesson', 'Перше заняття'],
  ['calendar.calendar.legend.lesson', 'Уроки'],
  ['calendar.calendar.legend.no_show', 'No-show'],
  ['calendar.calendar.legend.past_time', 'Минулий час'],
  ['calendar.calendar.legend.regular_lesson', 'Звичайне заняття']
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
console.log(`[apply-uk-extra-batch1] Updated ${translations.length} keys in uk.json`)
