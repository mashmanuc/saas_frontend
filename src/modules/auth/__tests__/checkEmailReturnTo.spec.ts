/**
 * Б-154 (2026-10-07): людина, що прийшла реєструватися з дошки чи уроку (?redirect=…), після
 * «Надіслати повторно» на «Перевірте email» мусить повернутися туди ж, а не в кабінет.
 * Реєстрація клала адресу лише в ПЕРШИЙ лист; повторний будувався з `/tutor/profile`, і посилання
 * «Повернутися до входу» теж її губило (той самий клас, що постмортем першого юзера 07-29).
 */
import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory, type Router } from 'vue-router'
import uk from '@/i18n/locales/uk.json'
import RegisterTutorView from '../views/RegisterTutorView.vue'
import CheckEmailView from '../views/CheckEmailView.vue'

const api = vi.hoisted(() => ({
  register: vi.fn(async () => ({ status: 'ok' })),
  resendVerifyEmail: vi.fn(async () => ({ status: 'ok' })),
}))
vi.mock('../api/authApi', () => ({ default: api }))
vi.mock('@/utils/siteVisit', () => ({ trackRegisterOpen: vi.fn() }))

const RETURN_TO = '/winterboard/public/abc'
// RouterLink у тестовому оточенні підмінено простим <a to="…"> — адресу читаємо з `to`
const loginTo = (w: VueWrapper) => w.find('a[to^="/auth/login"]').attributes('to')
const mounted: VueWrapper[] = []
afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })
beforeEach(() => { api.register.mockClear(); api.resendVerifyEmail.mockClear() })

async function mountView(component: object, path: string): Promise<{ w: VueWrapper; router: Router }> {
  setActivePinia(createPinia())
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } })
  const stub = { template: '<div />' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/check-email', name: 'auth-check-email', component: stub },
      { path: '/:p(.*)*', component: stub },
    ],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(component, {
    global: { plugins: [i18n, router], stubs: { OnboardingModal: true, GoogleSignInButton: true } },
  })
  mounted.push(w)
  return { w, router }
}

/** Значення redirect у verify_url, з яким фронт просить повторний лист. */
async function resendRedirect(w: VueWrapper): Promise<string | null> {
  const btn = w.findAll('button').find((b) => b.text().includes(uk.auth.checkEmail.resend))!
  await btn.trigger('click')
  await flushPromises()
  // Без `.at(-1)`: lib проєкту — до es2022 (vue-tsc, 2026-10-07).
  const calls = api.resendVerifyEmail.mock.calls as unknown[][]
  const payload = calls[calls.length - 1]?.[0] as { verify_url: string }
  return new URL(payload.verify_url.replace('{token}', 'T')).searchParams.get('redirect')
}

describe('Б-154: «Перевірте email» несе адресу повернення', () => {
  it('реєстрація вчителя передає ?redirect на «Перевірте email»', async () => {
    const { w, router } = await mountView(RegisterTutorView, `/auth/register/tutor?redirect=${encodeURIComponent(RETURN_TO)}`)
    await w.find('input[autocomplete="name"]').setValue('Ірина Коваль')
    await w.find('input[autocomplete="email"]').setValue('irina@example.test')
    const pw = w.findAll('input[autocomplete="new-password"]')
    await pw[0].setValue('Teacher-2026!x')
    await pw[1].setValue('Teacher-2026!x')
    await w.find('input[type="checkbox"]').setValue(true)
    await w.find('form').trigger('submit')
    await flushPromises()
    expect(api.register).toHaveBeenCalledTimes(1)
    expect(router.currentRoute.value.name).toBe('auth-check-email')
    expect(router.currentRoute.value.query.redirect).toBe(RETURN_TO)
  })

  it('«Надіслати повторно» і «Повернутися до входу» ведуть туди, звідки прийшли', async () => {
    const { w } = await mountView(CheckEmailView,
      `/auth/check-email?email=irina%40example.test&account_type=tutor&redirect=${encodeURIComponent(RETURN_TO)}`)
    expect(loginTo(w)).toBe(`/auth/login?redirect=${encodeURIComponent(RETURN_TO)}`)
    expect(await resendRedirect(w)).toBe(RETURN_TO)
  })

  it('чужа адреса (//…) не проходить: повторний лист — у роль-дім, вхід — без redirect', async () => {
    const { w } = await mountView(CheckEmailView,
      '/auth/check-email?email=irina%40example.test&account_type=tutor&redirect=%2F%2Fevil.example')
    expect(loginTo(w)).toBe('/auth/login')
    expect(await resendRedirect(w)).toBe('/tutor')
  })

  it('старе посилання без redirect — роль-дім /tutor, як і було (не легасі /tutor/profile)', async () => {
    const { w } = await mountView(CheckEmailView, '/auth/check-email?email=irina%40example.test&account_type=tutor')
    expect(await resendRedirect(w)).toBe('/tutor')
  })
})
