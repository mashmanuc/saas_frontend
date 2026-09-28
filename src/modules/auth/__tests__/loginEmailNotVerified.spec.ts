/**
 * Б-112 — вхід до підтвердження пошти.
 *
 * Бекенд віддає `email_not_verified` лише після ПРАВИЛЬНОГО пароля
 * (apps/users/api/serializers_v1_auth.py, LoginSerializer). Сторінка входу показувала
 * на цей код «Невірний email або пароль» — новий учитель думав, що забув пароль.
 * Тепер — окремий текст; кнопка повторного листа лишається, як була.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import uk from '@/i18n/locales/uk.json'
import LoginView from '../views/LoginView.vue'
import { useAuthStore } from '../store/authStore'

const mounted: VueWrapper[] = []
afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

async function mountLogin(code: string | null, email = '') {
  const pinia = createPinia()
  setActivePinia(pinia)
  const auth = useAuthStore()
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/auth/login')
  await router.isReady()
  const w = mount(LoginView, {
    global: {
      plugins: [pinia, i18n, router],
      stubs: { OnboardingModal: true, WebAuthnPrompt: true, UnlockConfirmModal: true, GoogleSignInButton: true },
    },
  })
  mounted.push(w)
  if (email) await w.find('[data-testid="login-email-input"] input, input[data-testid="login-email-input"]').setValue(email)
  auth.lastErrorCode = code
  await nextTick()
  return w
}

const inline = (w: VueWrapper) => w.find('[data-testid="login-inline-error"]')

describe('Б-112: вхід до підтвердження пошти', () => {
  it('email_not_verified → «Пошту ще не підтверджено…», а не «Невірний email або пароль»', async () => {
    const w = await mountLogin('email_not_verified')
    expect(inline(w).text()).toBe(
      'Пошту ще не підтверджено. Відкрийте лист від M4SH і натисніть посилання — або надішліть лист ще раз.',
    )
    expect(inline(w).text()).not.toContain('Невірний email або пароль')
  })

  it('кнопка повторного листа на місці (не чіпали)', async () => {
    const w = await mountLogin('email_not_verified', 'olena@example.com')
    expect(w.text()).toContain(uk.auth.login.resendVerifyCta)
  })

  it('invalid_credentials — як і було: «Невірний email або пароль»', async () => {
    const w = await mountLogin('invalid_credentials')
    expect(inline(w).text()).toBe(uk.auth.login.errors.invalidCredentials)
  })
})
