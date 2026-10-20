/**
 * Прохід «очима вчителя 60 років» (2026-10-19) → власник 2026-10-20: «роби».
 * Після посилання в листі людину знову просили ввести пошту й пароль. Тепер:
 *   · «Перевірте пошту» запам'ятовує адресу на цьому пристрої (7 днів, без пароля);
 *   · «Пошту підтверджено» каже, що лишилось увійти й пошта вже вписана;
 *   · сторінка входу підставляє пошту в поле; після входу — стирає.
 * Тексти — «пошта», а не англійське «email».
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import uk from '@/i18n/locales/uk.json'
import { clearPendingEmail, readPendingEmail, rememberPendingEmail } from '../pendingEmail'

const mounted: VueWrapper[] = []
afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })
beforeEach(() => clearPendingEmail())

describe('пошта з реєстрації — лише на цьому пристрої, 7 днів', () => {
  it('запам’ятати → прочитати → стерти; порожнє не пише; через 8 днів — не діє', () => {
    rememberPendingEmail('  olena@example.com ', 1000)
    expect(readPendingEmail(2000)).toBe('olena@example.com')
    expect(readPendingEmail(1000 + 8 * 24 * 3600 * 1000)).toBe('')
    clearPendingEmail()
    expect(readPendingEmail()).toBe('')
    rememberPendingEmail('')
    expect(readPendingEmail()).toBe('')
  })
})

describe('«Перевірте пошту» запам’ятовує адресу', () => {
  it('сторінка після реєстрації кладе пошту з адреси сторінки на цей пристрій', async () => {
    setActivePinia(createPinia())
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
    await router.push('/auth/check-email?email=olena%40example.com')
    await router.isReady()
    const CheckEmailView = (await import('../views/CheckEmailView.vue')).default
    const w = mount(CheckEmailView, { global: { plugins: [i18n, router], stubs: { OnboardingModal: true } } })
    mounted.push(w)
    await flushPromises()
    expect(readPendingEmail()).toBe('olena@example.com')
  })
})

describe('тексти — «пошта», не «email»', () => {
  it('«Перевірте пошту», «Пошту підтверджено», кнопка в листі названа так само, як у листі', () => {
    expect(uk.auth.checkEmail.title).toBe('Перевірте пошту')
    expect(uk.auth.checkEmail.description).toContain('«Підтвердити пошту»')
    expect(uk.auth.checkEmail.description).not.toContain('для входу')
    expect(uk.auth.verifyEmail.success).toBe('Пошту підтверджено')
  })
})

describe('сторінка входу підставляє пошту', () => {
  async function mountLogin() {
    const pinia = createPinia()
    setActivePinia(pinia)
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } })
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
    await router.push('/auth/login')
    await router.isReady()
    const LoginView = (await import('../views/LoginView.vue')).default
    const w = mount(LoginView, {
      global: {
        plugins: [pinia, i18n, router],
        stubs: { OnboardingModal: true, WebAuthnPrompt: true, UnlockConfirmModal: true, GoogleSignInButton: true },
      },
    })
    mounted.push(w)
    await flushPromises()
    return w
  }
  const emailInput = (w: VueWrapper) =>
    w.find('[data-testid="login-email-input"] input, input[data-testid="login-email-input"]').element as HTMLInputElement

  it('щойно зареєструвались на цьому пристрої — пошта вже в полі', async () => {
    rememberPendingEmail('olena@example.com')
    const w = await mountLogin()
    expect(emailInput(w).value).toBe('olena@example.com')
  })

  it('нічого не запам’ятано — поле порожнє, як було', async () => {
    const w = await mountLogin()
    expect(emailInput(w).value).toBe('')
  })
})

describe('«Пошту підтверджено» — лишилось увійти', () => {
  it('пошта з реєстрації відома — рядок «пошта … уже вписана — введіть пароль»; невідома — без рядка', async () => {
    vi.resetModules()
    vi.doMock('../api/authApi', () => ({ default: { verifyEmail: vi.fn().mockResolvedValue({ status: 'ok' }), resendVerifyEmail: vi.fn() } }))
    vi.doMock('../store/authStore', () => ({ useAuthStore: () => ({ ensureCsrfToken: vi.fn().mockResolvedValue(undefined) }) }))
    vi.doMock('vue-router', () => ({ useRoute: () => ({ query: { token: 't0k' } }) }))
    const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
    const mountVerify = async () => {
      const View = (await import('../views/VerifyEmailView.vue')).default
      const w = mount(View, { global: { plugins: [i18n], stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
      mounted.push(w)
      await flushPromises()
      return w
    }
    const pending = await import('../pendingEmail')
    pending.rememberPendingEmail('olena@example.com')
    const known = await mountVerify()
    expect(known.get('[data-testid="verify-login-hint"]').text())
      .toBe('Лишилось увійти: пошта olena@example.com уже вписана — введіть пароль.')
    pending.clearPendingEmail()
    const unknown = await mountVerify()
    expect(unknown.find('[data-testid="verify-login-hint"]').exists()).toBe(false)
    vi.doUnmock('../api/authApi'); vi.doUnmock('../store/authStore'); vi.doUnmock('vue-router')
  })
})
