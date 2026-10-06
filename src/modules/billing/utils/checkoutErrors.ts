/**
 * Тексти відмов чекауту — одні для обох вітрин (AccountBillingView, PlansView).
 *
 * Пакет білінгу 2026-10-07 (власник: «так, добивай білінг»): сервер відмовляє ДО рахунку ще в
 * двох випадках — у людини чинний доступ від команди M4SH (Б-79, `active_staff_grant`) і
 * продовження вийшло б за 12 місяців наперед (Б-100, `renewal_cap_exceeded`); в обох `until` —
 * до коли доступ уже є. Без цих текстів учитель бачив би загальне «Помилка при створенні
 * checkout сесії» без пояснення.
 *
 * Невідомий код — `null`: кожна вітрина лишає свій запасний текст, як і було.
 */
import { activeLocale } from '@/utils/i18nDate'

type Translate = (key: string, params?: Record<string, unknown>) => string

function untilDate(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString(activeLocale(), { day: 'numeric', month: 'long', year: 'numeric' })
}

export function checkoutErrorText(err: any, t: Translate): string | null {
  const code = String(err?.code || '').toLowerCase()
  const until = untilDate(err?.details?.until)
  switch (code) {
    case 'sales_disabled':
      return t('billing.errors.salesDisabled')
    case 'already_subscribed_same_tier':
      return t('billing.errors.sameTierAlready')
    case 'active_staff_grant':
      return until ? t('billing.errors.activeStaffGrant', { date: until }) : t('billing.errors.activeStaffGrantNoDate')
    case 'renewal_cap_exceeded':
      return until ? t('billing.errors.renewalCapExceeded', { date: until }) : t('billing.errors.renewalCapExceededNoDate')
    default:
      return null
  }
}
