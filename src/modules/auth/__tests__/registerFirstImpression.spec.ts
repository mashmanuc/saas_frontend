/**
 * Реєстрація вчителя й екран «перевірте пошту» очима новачка (обхід 2026-10-05; власник:
 * «роби пакет до 15-го»). Що зупиняло:
 *   • оферта говорить про підписку й списання — людина боялась, що підписується на платне;
 *   • вимоги до пароля з'являлись лише після відмови сервера;
 *   • кнопка «Зареєструватися» сіра, і не сказано чому (бракує галочки згоди);
 *   • після реєстрації — чекав листа, не здогадувався зазирнути в «Спам».
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { createRouter, createMemoryHistory } from 'vue-router'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import RegisterTutorView from '../views/RegisterTutorView.vue'
import CheckEmailView from '../views/CheckEmailView.vue'

const trackRegisterOpen = vi.hoisted(() => vi.fn())
vi.mock('@/utils/siteVisit', () => ({ trackRegisterOpen }))

const mounted: VueWrapper[] = []
afterEach(() => { while (mounted.length) mounted.pop()!.unmount() })

async function mountView(component: object, path: string) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  const w = mount(component, {
    global: {
      plugins: [pinia, i18n, router],
      stubs: { OnboardingModal: true, GoogleSignInButton: true },
    },
  })
  mounted.push(w)
  return w
}

describe('реєстрація вчителя: перше враження', () => {
  it('над згодою з офертою — «Під час бети M4SH безкоштовний.» (текст «Мого плану»)', async () => {
    const w = await mountView(RegisterTutorView, '/auth/register/tutor')
    const line = w.find('[data-testid="register-beta-free"]')
    expect(line.text()).toBe(uk.billing.earlyAccess.subtitle)
    const html = w.html()
    expect(html.indexOf('register-beta-free')).toBeLessThan(html.indexOf('/legal/tutor-offer'))
  })

  it('вимоги до пароля видно одразу, до будь-якої помилки', async () => {
    const w = await mountView(RegisterTutorView, '/auth/register/tutor')
    expect(w.text()).toContain(uk.auth.register.passwordRules)
  })

  it('поки немає галочки згоди — кнопка сіра і сказано, чого бракує; з галочкою — рядок зникає', async () => {
    const w = await mountView(RegisterTutorView, '/auth/register/tutor')
    const submit = w.find('button[type="submit"]')
    expect(submit.attributes('disabled')).toBeDefined()
    expect(w.find('[data-testid="register-consent-needed"]').text()).toBe(uk.auth.register.consentNeeded)

    await w.find('input[type="checkbox"]').setValue(true)
    expect(w.find('[data-testid="register-consent-needed"]').exists()).toBe(false)
    expect(w.find('button[type="submit"]').attributes('disabled')).toBeUndefined()
  })
})

describe('подія «відкрили форму» для staff (власник 2026-10-05)', () => {
  it('відкриття форми реєстрації вчителя — рівно одна подія; екран пошти — жодної', async () => {
    trackRegisterOpen.mockClear()
    await mountView(RegisterTutorView, '/auth/register/tutor')
    expect(trackRegisterOpen).toHaveBeenCalledTimes(1)

    trackRegisterOpen.mockClear()
    await mountView(CheckEmailView, '/auth/check-email?email=olena%40example.com')
    expect(trackRegisterOpen).not.toHaveBeenCalled()
  })
})

describe('екран «перевірте пошту»', () => {
  it('підказує зазирнути в «Спам»', async () => {
    const w = await mountView(CheckEmailView, '/auth/check-email?email=olena%40example.com&account_type=tutor')
    expect(w.find('[data-testid="check-email-spam-hint"]').text()).toBe(uk.auth.checkEmail.spamHint)
  })
})

describe('нові тексти — у всіх трьох мовах', () => {
  const UA_ONLY = /[іїєґІЇЄҐ]/
  it.each([['en', en], ['ru', ru]] as const)('%s: є, і без українських літер', (_l, dict) => {
    const texts = [
      dict.auth.register.passwordRules,
      dict.auth.register.consentNeeded,
      dict.auth.checkEmail.spamHint,
      dict.billing.earlyAccess.subtitle,
    ]
    for (const s of texts) {
      expect(typeof s === 'string' && s.length > 5).toBe(true)
      expect(s).not.toMatch(UA_ONLY)
    }
  })
})
