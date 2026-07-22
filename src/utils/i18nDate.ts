// SSOT локалі для форматування дат/часу.
//
// Повертає активну локаль інтерфейсу, щоб toLocaleDateString /
// toLocaleTimeString / toLocaleString / Intl.DateTimeFormat віддавали дату
// мовою інтерфейсу (uk/en/…), а не браузерною локаллю (undefined) чи жорстко
// зашитим 'uk-UA'. Використовуй скрізь замість хардкоду локалі у date-форматтерах.
import { i18n } from '@/i18n'

const FALLBACK_LOCALE = 'uk'

/**
 * Активна i18n-локаль для Intl-форматтерів (напр. 'uk', 'en', 'de').
 *
 * Реактивна при виклику всередині computed/шаблону — читає
 * i18n.global.locale (ref у composition-режимі), тож при зміні мови
 * дати переформатовуються автоматично.
 */
export function activeLocale(): string {
  try {
    const loc = (i18n as any)?.global?.locale
    const value = typeof loc === 'string' ? loc : loc?.value
    return value || FALLBACK_LOCALE
  } catch {
    return FALLBACK_LOCALE
  }
}
