import fs from 'node:fs'
import path from 'node:path'

const translations = [
  ['conflict.resolution.override', 'Перевизначити попри конфлікт'],
  ['conflict.resolution.skip', 'Пропустити цей слот'],
  ['conflict.resolution.updateTemplate', 'Оновити шаблон'],
  ['conflict.resolveAnyway', 'Вирішити все одно'],
  ['conflict.student', 'Учень'],
  ['conflict.types.bookedOverlap', 'Перекриття з уроком'],
  ['conflict.types.slotOverlap', 'Перекриття зі слотом'],
  ['conflict.types.templateOverlap', 'Конфлікт із шаблоном'],
  ['conflict.warningTitle', 'Попередження'],
  ['lessons.calendar.createLesson.comment', 'Коментар для себе'],
  ['lessons.calendar.createLesson.commentPlaceholder', 'Що потрібно врахувати під час уроку?'],
  ['lessons.calendar.createLesson.conflictDetected', 'Виявлено часовий конфлікт'],
  ['lessons.calendar.createLesson.create', 'Створити урок'],
  ['lessons.calendar.createLesson.createAnyway', 'Створити попри конфлікт'],
  ['lessons.calendar.createLesson.duration', 'Тривалість'],
  ['lessons.calendar.createLesson.hourLabel', 'Година'],
  ['lessons.calendar.createLesson.lessonType', 'Тип уроку'],
  ['lessons.calendar.createLesson.lessonsLeft', 'уроків залишилось'],
  ['lessons.calendar.createLesson.minuteLabel', 'Хвилина'],
  ['lessons.calendar.createLesson.regularity', 'Регулярність'],
  ['lessons.calendar.createLesson.repeatCount', 'Кількість повторів'],
  ['lessons.calendar.createLesson.repeatMode', 'Режим повторення'],
  ['lessons.calendar.createLesson.repeatUntil', 'Повторювати до'],
  ['lessons.calendar.createLesson.searchStudent', 'Знайти учня або замовлення'],
  ['lessons.calendar.createLesson.selectStudent', "Обрати учня"],
  ['lessons.calendar.createLesson.selectType', 'Оберіть тип'],
  ['lessons.calendar.createLesson.selectedTime', 'Час початку уроку'],
  ['lessons.calendar.createLesson.seriesPartialSuccess', 'Створено {created} уроків, пропущено {skipped} через конфлікти'],
  ['lessons.calendar.createLesson.seriesSuccess', 'Створено {count} уроків у серії'],
  ['lessons.calendar.createLesson.skipConflicts', 'Пропустити конфлікти'],
  ['lessons.calendar.createLesson.student', 'Учень / замовлення'],
  ['lessons.calendar.createLesson.studentComment', 'Нотатка для учня'],
  ['lessons.calendar.createLesson.studentCommentPlaceholder', 'Буде видно учню у нагадуваннях'],
  ['lessons.calendar.createLesson.timeHint', 'Вкажіть точний час у вашому часовому поясі'],
  ['lessons.calendar.createLesson.title', 'Створення уроку'],
  ['lessons.calendar.createLesson.tutorComment', 'Внутрішня нотатка'],
  ['lessons.calendar.createLesson.tutorCommentPlaceholder', 'Бачите лише ви'],
  ['lessons.calendar.errors.cannotDelete', 'Цей урок не можна видалити'],
  ['lessons.calendar.errors.createFailed', 'Не вдалося створити урок. Спробуйте пізніше.'],
  ['lessons.calendar.errors.deleteFailed', 'Не вдалося видалити урок'],
  ['lessons.calendar.errors.invalidDatetime', 'Некоректний часовий слот'],
  ['lessons.calendar.errors.invalidDuration', 'Оберіть дозволену тривалість'],
  ['lessons.calendar.errors.invalidLessonType', 'Оберіть дійсний тип уроку'],
  ['lessons.calendar.errors.invalidOrder', 'Оберіть дійсного учня або замовлення'],
  ['lessons.calendar.errors.invalidTime', 'Оберіть час у майбутньому (до 6 міс.)'],
  ['lessons.calendar.errors.loadFailed', 'Не вдалося завантажити дані уроку'],
  ['lessons.calendar.errors.notFound', 'Ресурс не знайдено'],
  ['lessons.calendar.errors.orderInactive', 'Це замовлення неактивне'],
  ['lessons.calendar.errors.permissionDenied', 'Недостатньо прав для дії'],
  ['lessons.calendar.errors.rateLimitExceeded', 'Забагато запитів. Зачекайте.'],
  ['lessons.calendar.errors.serverError', 'Помилка сервера. Спробуйте пізніше.'],
  ['lessons.calendar.errors.studentNotFound', 'Учня не знайдено'],
  ['lessons.calendar.errors.timeOverlap', 'Цей час перекривається з іншим уроком'],
  ['lessons.calendar.errors.unknown', 'Щось пішло не так. Спробуйте пізніше.'],
  ['lessons.calendar.errors.updateFailed', 'Не вдалося оновити урок'],
  ['lessons.calendar.errors.validationError', 'Перевірте виділені поля'],
  ['marketplace.profile.reviews.rating', 'Оцінка'],
  ['marketplace.profile.reviews.ratingLabel', 'Оцінка'],
  ['marketplace.profile.reviews.reviewsEmpty', 'Ще немає відгуків'],
  ['marketplace.profile.reviews.reviewsLoadError', 'Не вдалося завантажити відгуки'],
  ['marketplace.profile.reviews.reviewsLoadMore', 'Показати більше відгуків'],
  ['marketplace.weekdays.friday', 'Пʼятниця'],
  ['marketplace.weekdays.monday', 'Понеділок'],
  ['marketplace.weekdays.saturday', 'Субота'],
  ['marketplace.weekdays.short.fri', 'Пт'],
  ['marketplace.weekdays.short.mon', 'Пн'],
  ['marketplace.weekdays.short.sat', 'Сб'],
  ['marketplace.weekdays.short.sun', 'Нд'],
  ['marketplace.weekdays.short.thu', 'Чт'],
  ['marketplace.weekdays.short.tue', 'Вт'],
  ['marketplace.weekdays.short.wed', 'Ср'],
  ['marketplace.weekdays.sunday', 'Неділя'],
  ['marketplace.weekdays.thursday', 'Четвер'],
  ['marketplace.weekdays.tuesday', 'Вівторок'],
  ['marketplace.weekdays.wednesday', 'Середа'],
  ['matches.bookLesson', 'Забронювати урок'],
  ['matches.tabs.bookings', 'Бронювання'],
  ['matches.tabs.calendar', 'Календар'],
  ['matches.tabs.chat', 'Чат'],
  ['matches.tabs.details', 'Деталі'],
  ['profile.actions.redo', 'Повторити'],
  ['profile.actions.redoError', 'Не вдалося повторити дію'],
  ['profile.actions.redoSuccess', 'Дію повторено'],
  ['profile.actions.reset', 'Скинути'],
  ['profile.actions.undo', 'Скасувати'],
  ['profile.actions.undoError', 'Не вдалося скасувати дію'],
  ['profile.actions.undoSuccess', 'Дію скасовано'],
  ['profile.security.mfa.copyManualCode', 'Скопіювати код налаштування'],
  ['profile.security.mfa.manualCodeCopied', 'Код налаштування скопійовано'],
  ['profile.security.mfa.manualCodeLabel', 'Код ручного налаштування'],
  ['profile.security.mfa.viewManualCode', 'Показати код налаштування'],
  ['userProfile.eventModal.confirmDelete', 'Підтвердження видалення'],
  ['userProfile.eventModal.confirmDeleteMessage', 'Видалити урок з {student}? Скасувати не вдасться.'],
  ['userProfile.eventModal.delete', 'Видалити урок'],
  ['userProfile.eventModal.edit', 'Редагувати'],
  ['userProfile.eventModal.editTime', 'Час уроку'],
  ['userProfile.eventModal.title', 'Деталі уроку'],
  ['userProg.en', 'Англійська'],
  ['userProg.label', 'Мова'],
  ['userProg.uk', 'Українська']
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
console.log(`[apply-uk-extra-batch5] Updated ${translations.length} keys in uk.json`)
