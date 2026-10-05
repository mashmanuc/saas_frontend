/**
 * Лендінг /start очима новачка (обхід 2026-10-05; власник: «роби пакет до 15-го» — наступний
 * рекламний пост 15.10). Що зупиняло людину ще до реєстрації:
 *   • «Зараз у закритому бета-тестуванні — запрошуємо перших шкіл…» читалось як «без запрошення
 *     не пустять», а ціни не було ніде. Тепер під кнопкою — текст про безкоштовну бету, який
 *     власник затвердив для «Мого плану» (2026-09-29), дослівно.
 *   • вгорі лише «Увійти» — кнопки реєстрації не було;
 *   • дві кнопки реєстрації звучали по-різному («Вести уроки на M4SH» / «Створити свій простір»).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import landingSource from '../RoleSelectionView.vue?raw'

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push }),
}))
vi.mock('@/i18n', () => ({ setLocale: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { get: vi.fn().mockResolvedValue({}) } }))
vi.mock('@/modules/winterboard/components/public/EyePlayer.vue', () => ({
  __esModule: true,
  default: defineComponent({ setup: () => () => h('div') }),
}))

import RoleSelectionView from '../RoleSelectionView.vue'

class SilentIO {
  observe() {}
  unobserve() {}
  takeRecords() { return [] }
  disconnect() {}
}

beforeEach(() => {
  push.mockReset()
  vi.stubGlobal('IntersectionObserver', SilentIO)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

async function mountLanding() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  const w = mount(RoleSelectionView, {
    global: {
      plugins: [i18n],
      stubs: { 'router-link': RouterLinkStub, LandingTrigCircle: true, LandingNmt3d: true, ProjectSupportLink: true },
    },
  })
  await flushPromises()
  return w
}

type Dict = { roleSelection: Record<string, unknown>; billing: { earlyAccess: Record<string, string> } }
const LOCALES = [['uk', uk], ['en', en], ['ru', ru]] as const

/** Перше речення: до першої крапки, за якою пробіл або кінець рядка. */
function firstSentence(text: string): string {
  const m = text.match(/^.*?\.(?=\s|$)/)
  return m ? m[0] : text
}

describe('лендінг: про гроші й доступ — затверджений текст, а не «закрите бета»', () => {
  it.each(LOCALES)('%s: рядок під кнопкою = заголовок картки «Мій план» + її перше речення', (_l, dict) => {
    const d = dict as unknown as Dict
    const ea = d.billing.earlyAccess
    expect(d.roleSelection.betaNotice).toBe(`${ea.cardTitle}. ${firstSentence(ea.cardText)}`)
  })

  it.each(LOCALES)('%s: ні «закритого» бета, ні «запрошуємо»', (_l, dict) => {
    const notice = String((dict as unknown as Dict).roleSelection.betaNotice)
    expect(notice).not.toMatch(/закрит|closed|закрыт/i)
    expect(notice).not.toMatch(/запрошуємо|welcoming|приглашаем/i)
  })

  it('на сторінці рядок стоїть у першому екрані, під головною кнопкою', async () => {
    const w = await mountLanding()
    const hero = w.find('.hero-text')
    expect(hero.find('.beta-notice').text()).toBe(uk.roleSelection.betaNotice)
    expect(hero.html().indexOf('hero-cta-primary')).toBeLessThan(hero.html().indexOf('beta-notice'))
  })
})

describe('лендінг: реєстрація вгорі й один напис на всіх кнопках', () => {
  it('у шапці поруч з «Увійти» — кнопка реєстрації, вона веде на форму вчителя', async () => {
    const w = await mountLanding()
    const nav = w.find('nav.nav-header')
    const signup = nav.find('[data-test="nav-signup"]')
    expect(signup.exists()).toBe(true)
    expect(signup.text()).toBe(uk.roleSelection.hero.ctaTutor)
    expect(nav.find('.nav-link-login').text()).toBe(uk.roleSelection.nav.login)
    await signup.trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/auth/register/tutor', query: {} })
  })

  it('шапка, перший екран і картка — один і той самий напис', async () => {
    const w = await mountLanding()
    const labels = [
      w.find('[data-test="nav-signup"]').text(),
      w.find('.hero-cta-primary').text(),
      w.find('.card-button').text(),
    ]
    expect(new Set(labels)).toEqual(new Set([uk.roleSelection.hero.ctaTutor]))
  })

  it('старого ключа «Створити свій простір» немає ні в коді, ні в перекладах', () => {
    expect(landingSource).not.toContain('roleSelection.tutor.cta')
    for (const [, dict] of LOCALES) {
      const tutor = (dict as unknown as Dict).roleSelection.tutor as Record<string, string>
      expect(tutor.cta).toBeUndefined()
    }
  })

  it('ru: кнопка кличе вести уроки, а не «стать репетитором»', () => {
    expect(ru.roleSelection.hero.ctaTutor).toBe('Вести уроки на M4SH')
  })

  it('на вузькому телефоні кнопку в шапці ховаємо, «Увійти» лишається (P0 2026-09-02)', () => {
    const narrow = landingSource.match(/@media \(max-width: (\d+)px\) \{\s*\.nav-link-signup \{\s*display: none;/)
    expect(narrow, 'правило, що ховає кнопку реєстрації в шапці на вузькому екрані').not.toBeNull()
    expect(landingSource).not.toMatch(/\.nav-link-login\s*\{\s*display:\s*none/)
  })
})
