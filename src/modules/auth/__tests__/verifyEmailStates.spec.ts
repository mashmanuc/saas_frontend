/**
 * Б-113 — сторінка підтвердження пошти.
 *
 * Повторний клік по листу (або вже підтверджена пошта) і застаріле/невірне посилання
 * показували вікно «Помилка сервера / Тимчасова помилка». Бекенд їх розрізняє
 * (`already_verified`, `invalid_token` — V1AuthVerifyEmailView), тож тепер:
 *   · already_verified → «Пошту вже підтверджено — можна входити» + «Увійти», без вікна;
 *   · invalid_token    → «Посилання застаріло» + поле пошти й «Надіслати лист підтвердження ще раз»;
 *   · решта помилок    → вікно, як і було. Логіку підтвердження не чіпали.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '@/i18n/locales/uk.json'

const verifyEmail = vi.fn()
const resendVerifyEmail = vi.fn()
const ensureCsrfToken = vi.fn()
vi.mock('../api/authApi', () => ({ default: { verifyEmail: (...a: unknown[]) => verifyEmail(...a), resendVerifyEmail: (...a: unknown[]) => resendVerifyEmail(...a) } }))
vi.mock('../store/authStore', () => ({ useAuthStore: () => ({ ensureCsrfToken: (...a: unknown[]) => ensureCsrfToken(...a) }) }))
vi.mock('vue-router', () => ({ useRoute: () => ({ query: { token: 't0k' } }) }))

import VerifyEmailView from '../views/VerifyEmailView.vue'

const mounted: VueWrapper[] = []
afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })
beforeEach(() => {
  verifyEmail.mockReset(); resendVerifyEmail.mockReset()
  ensureCsrfToken.mockReset(); ensureCsrfToken.mockResolvedValue(undefined)
})

async function mountView() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
  const w = mount(VerifyEmailView, {
    global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } },
    attachTo: document.body,
  })
  mounted.push(w)
  await flushPromises()
  return w
}

const apiError = (status: number, error: string) => Object.assign(new Error(error), { response: { status, data: { error } } })
const modalText = () => document.body.textContent ?? ''

describe('Б-113: сторінка підтвердження пошти', () => {
  it('перший клік — «Email підтверджено», вікна помилки немає', async () => {
    verifyEmail.mockResolvedValue({ status: 'ok' })
    const w = await mountView()
    expect(w.text()).toContain(uk.auth.verifyEmail.success)
    expect(modalText()).not.toContain(uk.errors.http.serverError)
  })

  it('повторний клік (already_verified) — «Пошту вже підтверджено — можна входити», без «Помилка сервера»', async () => {
    verifyEmail.mockRejectedValue(apiError(400, 'already_verified'))
    const w = await mountView()
    expect(w.find('[data-testid="verify-ok"]').text()).toContain('Пошту вже підтверджено — можна входити')
    expect(w.text()).toContain(uk.auth.verifyEmail.loginCta)
    expect(modalText()).not.toContain(uk.errors.http.serverError)
    expect(modalText()).not.toContain(uk.auth.requestErrors.temporary)
  })

  it('застаріле/невірне посилання (invalid_token) — «Посилання застаріло» і новий лист просто тут', async () => {
    verifyEmail.mockRejectedValue(apiError(400, 'invalid_token'))
    resendVerifyEmail.mockResolvedValue({ status: 'ok' })
    const w = await mountView()
    const form = w.find('[data-testid="verify-expired"]')
    expect(form.text()).toContain('Посилання застаріло')
    expect(modalText()).not.toContain(uk.errors.http.serverError)
    await w.find('[data-testid="verify-resend-email"] input, input[data-testid="verify-resend-email"]').setValue('olena@example.com')
    await form.trigger('submit')
    await flushPromises()
    expect(resendVerifyEmail).toHaveBeenCalledTimes(1)
    // зі старого листа приходять у новому браузері — спершу CSRF-кука, інакше сервер відповідає 422
    expect(ensureCsrfToken).toHaveBeenCalledTimes(1)
    expect(ensureCsrfToken.mock.invocationCallOrder[0]).toBeLessThan(resendVerifyEmail.mock.invocationCallOrder[0])
    const payload = resendVerifyEmail.mock.calls[0][0] as { email: string; verify_url?: string }
    expect(payload.email).toBe('olena@example.com')
    expect(payload.verify_url ?? '/auth/verify-email?token={token}').toContain('/auth/verify-email?token={token}')
    expect(w.find('[data-testid="verify-resend-done"]').text()).toBe(uk.auth.checkEmail.success)
  })

  it('інша помилка (500) — як і було: вікно «Помилка сервера» з «Тимчасова помилка»', async () => {
    verifyEmail.mockRejectedValue(apiError(500, 'server_error'))
    const w = await mountView()
    expect(w.find('[data-testid="verify-ok"]').exists()).toBe(false)
    expect(w.find('[data-testid="verify-expired"]').exists()).toBe(false)
    expect(modalText()).toContain(uk.auth.requestErrors.temporary)
  })
})
