/**
 * Пакет білінгу 2026-10-07 (власник: «так, добивай білінг»): відмови чекауту людською мовою.
 *
 * Сервер відмовляє ДО рахунку ще у двох випадках — чинний доступ від команди M4SH (Б-79,
 * `active_staff_grant`) і продовження далі ніж на 12 місяців (Б-100, `renewal_cap_exceeded`).
 * Відповідь пласка: { error: '<службовий текст англійською>', code, until }. Раніше
 * `parseDomainError` повертав сам рядок — код губився, і вчитель бачив загальне «Помилка».
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const post = vi.fn()
vi.mock('@/utils/apiClient', () => ({ apiClient: { post: (...a: unknown[]) => post(...a), get: vi.fn() } }))
vi.mock('@/utils/i18nDate', () => ({ activeLocale: () => 'uk-UA' }))

import { startCheckout } from '../../api/billingApi'
import { checkoutErrorText } from '../checkoutErrors'

const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}|${JSON.stringify(params)}` : key)

async function refusal(data: unknown, status = 409) {
  post.mockRejectedValueOnce(Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } }))
  try {
    await startCheckout('pro')
  } catch (err) {
    return err as any
  }
  throw new Error('startCheckout мав відмовити')
}

beforeEach(() => post.mockReset())

describe('parseDomainError — обидві форми відповіді сервера', () => {
  it('пласка відмова: код і `until` не губляться, службовий англійський текст людині не йде', async () => {
    const err = await refusal({ error: 'Access granted by the M4SH team is active until 2027-01-15', code: 'active_staff_grant', until: '2027-01-15T10:00:00+00:00' })
    expect(err.code).toBe('active_staff_grant')
    expect(err.message).toBe('')
    expect(err.details.until).toBe('2027-01-15T10:00:00+00:00')
  })

  it('вкладена форма — як і була: об\'єкт помилки сервера', async () => {
    const err = await refusal({ error: { code: 'VALIDATION_ERROR', message: 'Невірний план', fields: {} } }, 400)
    expect(err).toEqual({ code: 'VALIDATION_ERROR', message: 'Невірний план', fields: {} })
  })

  it('пласка без коду — невідома, без службового тексту (вітрина бере свій)', async () => {
    const err = await refusal({ error: 'Something went wrong' }, 400)
    expect(err.code).toBe('unknown_error')
    expect(err.message).toBe('')
  })

  it('без відповіді (мережа) — як і було: повідомлення помилки', async () => {
    post.mockRejectedValueOnce(new Error('Network Error'))
    await expect(startCheckout('pro')).rejects.toMatchObject({ code: 'unknown_error', message: 'Network Error' })
  })
})

describe('checkoutErrorText — що бачить людина', () => {
  it('доступ від команди — з датою; без дати — без неї', () => {
    expect(checkoutErrorText({ code: 'active_staff_grant', details: { until: '2027-01-15T10:00:00+00:00' } }, t))
      .toBe('billing.errors.activeStaffGrant|{"date":"15 січня 2027 р."}')
    expect(checkoutErrorText({ code: 'active_staff_grant', details: {} }, t)).toBe('billing.errors.activeStaffGrantNoDate')
  })

  it('продовження далі ніж на 12 місяців — з датою; зіпсована дата — без неї', () => {
    expect(checkoutErrorText({ code: 'renewal_cap_exceeded', details: { until: '2027-03-01T00:00:00+00:00' } }, t))
      .toMatch(/^billing\.errors\.renewalCapExceeded\|/)
    expect(checkoutErrorText({ code: 'renewal_cap_exceeded', details: { until: 'не дата' } }, t)).toBe('billing.errors.renewalCapExceededNoDate')
  })

  it('старі коди — ті самі тексти, що й були; великими літерами — теж', () => {
    expect(checkoutErrorText({ code: 'sales_disabled' }, t)).toBe('billing.errors.salesDisabled')
    expect(checkoutErrorText({ code: 'SALES_DISABLED' }, t)).toBe('billing.errors.salesDisabled')
    expect(checkoutErrorText({ code: 'ALREADY_SUBSCRIBED_SAME_TIER' }, t)).toBe('billing.errors.sameTierAlready')
  })

  it('невідомий код чи не об\'єкт — null: вітрина лишає свій запасний текст', () => {
    expect(checkoutErrorText({ code: 'checkout_not_allowed' }, t)).toBeNull()
    expect(checkoutErrorText('рядок', t)).toBeNull()
    expect(checkoutErrorText(undefined, t)).toBeNull()
  })

  it('тексти є в uk/en/ru', () => {
    for (const loc of ['uk', 'en', 'ru']) {
      const json = JSON.parse(fs.readFileSync(path.resolve(__dirname, `../../../../i18n/locales/${loc}.json`), 'utf-8'))
      for (const k of ['activeStaffGrant', 'activeStaffGrantNoDate', 'renewalCapExceeded', 'renewalCapExceededNoDate']) {
        expect(json.billing.errors[k], `${loc}: ${k}`).toBeTruthy()
      }
      expect(json.billing.errors.activeStaffGrant).toContain('{date}')
      expect(json.billing.errors.renewalCapExceeded).toContain('{date}')
    }
  })
})
