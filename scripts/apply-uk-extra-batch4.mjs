import fs from 'node:fs'
import path from 'node:path'

const translations = [
  ['calendar.timeRange.start', 'Початок'],
  ['calendar.weekOf', 'Тиждень {date}'],
  ['common.accept', 'Прийняти'],
  ['common.addCertification', 'Додати диплом'],
  ['common.back', 'Назад'],
  ['common.birthYearLabel', 'Рік народження'],
  ['common.birthYearPlaceholder', 'наприклад, 1995'],
  ['common.certificationIssuerPlaceholder', 'Видавництво (опційно)'],
  ['common.certificationNamePlaceholder', 'Назва диплому'],
  ['common.certificationPublic', 'Показувати в публічному профілі'],
  ['common.certificationsAdd', 'Додати диплом'],
  ['common.certificationsCreateSuccess', 'Диплом додано'],
  ['common.certificationsDeleteError', 'Не вдалося видалити диплом'],
  ['common.certificationsDeleteSuccess', 'Диплом видалено'],
  ['common.certificationsEmpty', 'Ще немає дипломів'],
  ['common.certificationsFileLabel', 'Файл'],
  ['common.certificationsIssuedYearLabel', 'Рік видачі (опційно)'],
  ['common.certificationsIssuerLabel', 'Організація (опційно)'],
  ['common.certificationsLoadError', 'Не вдалося завантажити дипломи'],
  ['common.certificationsNoFile', 'Файл не обрано'],
  ['common.certificationsRateLimited', 'Забагато запитів. Спробуйте пізніше'],
  ['common.certificationsSelectedFile', 'Обрано: {name}'],
  ['common.certificationsStatusApproved', 'Схвалено'],
  ['common.certificationsStatusPending', 'Очікує модерації'],
  ['common.certificationsStatusRejected', 'Відхилено'],
  ['common.certificationsTitle', 'Дипломи (сертифікати)'],
  ['common.certificationsTitleLabel', 'Назва'],
  ['common.certificationsTooLarge', 'Файл завеликий'],
  ['common.certificationsUnsupportedType', 'Непідтримуваний тип файлу'],
  ['common.certificationsUpdateError', 'Не вдалося оновити диплом'],
  ['common.certificationsUploadButton', 'Обрати файл'],
  ['common.certificationsUploadError', 'Не вдалося завантажити диплом'],
  ['common.certificationsUploading', 'Завантаження…'],
  ['common.certificationsValidationError', 'Перевірте дані диплома'],
  ['common.clear', 'Очистити'],
  ['common.confirmDelete', 'Видалити запис?'],
  ['common.copy', 'Копіювати'],
  ['common.daysAgo', '{count} дн. тому'],
  ['common.decline', 'Відхилити'],
  ['common.exit', 'Вийти'],
  ['common.genderLabel', 'Стать'],
  ['common.genderOptions.female', 'Жіноча'],
  ['common.genderOptions.male', 'Чоловіча'],
  ['common.genderOptions.other', 'Інша'],
  ['common.genderOptions.unspecified', 'Не вказано'],
  ['common.genderPlaceholder', 'напр. Жіноча / Чоловіча / Інша'],
  ['common.hourlyRateLabel', 'Ціна за годину'],
  ['common.hoursAgo', '{count} год тому'],
  ['common.justNow', 'Щойно'],
  ['common.later', 'Пізніше'],
  ['common.loading', 'Завантаження...'],
  ['common.lock', 'Заблокувати'],
  ['common.minutesAgo', '{count} хв тому'],
  ['common.moveDown', 'Перемістити вниз'],
  ['common.moveUp', 'Перемістити вгору'],
  ['common.next', 'Далі'],
  ['common.notSpecified', 'Не вказано'],
  ['common.of', 'з'],
  ['common.open', 'Відкрити'],
  ['common.other', 'Інше'],
  ['common.pricingTitle', 'Тарифи'],
  ['common.privacyTitle', 'Приватність'],
  ['common.rateLimit.features.auth', 'Забагато спроб входу. Зачекайте перед повтором.'],
  ['common.rateLimit.features.drafts', 'Забагато збережень чернетки. Зачекайте перед наступним.'],
  ['common.rateLimit.features.operator', 'Забагато дій оператора. Зачекайте.'],
  ['common.rateLimit.features.telemetry', 'Забагато телеметрії. Оновіть пізніше.'],
  ['common.rateLimit.message', 'Забагато запитів. Зачекайте перед повтором.'],
  ['common.rateLimit.seconds', 'секунд'],
  ['common.rateLimit.title', 'Ліміт запитів перевищено'],
  ['common.rateLimit.tryNow', 'Спробувати зараз'],
  ['common.rateLimit.waiting', 'Очікування...'],
  ['common.refresh', 'Оновити'],
  ['common.remove', 'Видалити'],
  ['common.resend', 'Надіслати ще раз'],
  ['common.retry', 'Повторити'],
  ['common.search', 'Пошук'],
  ['common.showAge', 'Показувати вік у публічному профілі'],
  ['common.showGender', 'Показувати стать у публічному профілі'],
  ['common.showTelegram', 'Показувати Telegram у профілі'],
  ['common.showing', 'Показано'],
  ['common.telegramLabel', 'Telegram'],
  ['common.telegramPlaceholder', 'нікнейм без @'],
  ['common.there', 'там'],
  ['common.trialPriceHint', 'Опційна знижена ціна для першого уроку'],
  ['common.trialPriceLabel', 'Ціна пробного уроку'],
  ['common.trialPricePlaceholder', 'Залиште порожнім, якщо не потрібно'],
  ['common.unlock', 'Розблокувати'],
  ['common.validation.bio', 'Опис обовʼязковий (мін. 10 символів).'],
  ['common.validation.headline', 'Заголовок обовʼязковий (мін. 3 символи).'],
  ['common.validation.hourlyRate', 'Ціна за годину має бути > 0.'],
  ['common.validation.languages', 'Оберіть щонайменше одну мову.'],
  ['common.validation.retrying', 'Зʼєднуємося...'],
  ['common.validation.subjects', 'Оберіть щонайменше один предмет.'],
  ['common.videoHint', 'Посилання на YouTube чи Vimeo з вашою презентацією'],
  ['common.videoTitle', 'Відео-презентація'],
  ['common.videoUrlLabel', 'URL відео'],
  ['common.videoUrlPlaceholder', 'https://youtube.com/watch?v=…'],
  ['conflict.errorTitle', 'Часові конфлікти'],
  ['conflict.lesson', 'Урок'],
  ['conflict.resolution.apply', 'Застосувати рішення']
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
console.log(`[apply-uk-extra-batch4] Updated ${translations.length} keys in uk.json`)
