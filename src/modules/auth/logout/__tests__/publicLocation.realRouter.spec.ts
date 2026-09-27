/**
 * Б-36 (2026-09-27): що вважається «публічною сторінкою» — за СПРАВЖНІМ роутером.
 *
 * Протухла сесія на публічній сторінці знімається мовчки, людину лишаємо на місці
 * (`isTabOnPublicPage` у `apiClient` і `authStore`). Тест звіряє з метаданими маршрутів
 * `src/router/index.js`, а не з копією: посилання з листа (скидання пароля,
 * підтвердження email) і публічний запис мають лишатися, сторінки з даними — ні.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { isPublicLocation } from '../sessionEndedView'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

describe('Б-36 · публічні адреси за справжнім роутером', () => {
  it.each([
    '/auth/reset-password?uid=1&token=abc',
    '/auth/verify-email?token=abc',
    '/auth/forgot-password',
    '/auth/login?redirect=/tutor',
    '/start',
    '/winterboard/public/abc123',
  ])('%s — публічна: сесія не потрібна, людину не виводимо', { timeout: 120_000 }, async (href) => {
    const { default: router } = await import('@/router/index.js')
    expect(isPublicLocation(router, href)).toBe(true)
  })

  it.each([
    '/tutor',
    '/winterboard/11111111-1111-4111-8111-111111111111',
  ])('%s — сторінка з даними: протухла сесія веде на вхід, як і раніше', { timeout: 120_000 }, async (href) => {
    const { default: router } = await import('@/router/index.js')
    expect(isPublicLocation(router, href)).toBe(false)
  })
})
