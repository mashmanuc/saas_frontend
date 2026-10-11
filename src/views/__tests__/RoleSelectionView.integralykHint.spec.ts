/**
 * Інтегралик на /start у самій сторінці (ТЗ TZ_START_INTEGRALYK_HINTS_2026-10-11 §1.3, §5):
 *   • кнопка в панельці веде ТУДИ Ж, куди головна кнопка лендінгу, — з тим самим `redirect`,
 *     без нових `utm_*`/`ref`;
 *   • компонент підключено одним рядком, решта сторінки — без змін;
 *   • охорона (`guard-selector`) справді вказує на кнопки першого екрана й нижні посилання сторінки
 *     (друга кнопка теж: на 375×667 фраза над фігуркою лягала на її кут — тоді чекає прокрутки).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h, nextTick } from 'vue'
import uk from '@/i18n/locales/uk.json'
import landingSource from '../RoleSelectionView.vue?raw'
import hintSource from '../LandingIntegralykHint.vue?raw'

const push = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({ query: { redirect: '/workspace' } as Record<string, unknown> }))
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push }),
}))
vi.mock('@/i18n', () => ({ setLocale: vi.fn() }))
vi.mock('@/api/client', () => ({ default: { get: vi.fn().mockResolvedValue({}) } }))
vi.mock('@/utils/siteVisit', () => ({ trackIntegralykTap: vi.fn() }))
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

let wrapper: VueWrapper | null = null

async function settle() {
  for (let i = 0; i < 6; i++) await nextTick()
}

async function mountLanding() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  wrapper = mount(RoleSelectionView, {
    attachTo: document.body,
    global: {
      plugins: [i18n],
      stubs: {
        'router-link': RouterLinkStub, LandingTrigCircle: true, LandingNmt3d: true, ProjectSupportLink: true,
        transition: true,
      },
    },
  })
  await settle()
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  push.mockReset()
  route.query = { redirect: '/workspace' }
  sessionStorage.clear()
  vi.stubGlobal('IntersectionObserver', SilentIO)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('Інтегралик на сторінці /start', () => {
  it('кнопка панельки веде туди ж, куди головна кнопка, з тим самим redirect і без нових міток', async () => {
    const w = await mountLanding()
    await w.find('.hero-cta-primary').trigger('click')
    expect(push).toHaveBeenCalledTimes(1)
    const mainTarget = push.mock.calls[0][0]
    expect(mainTarget).toEqual({ path: '/auth/register/tutor', query: { redirect: '/workspace' } })

    vi.advanceTimersByTime(2000)
    await settle()
    await w.find('[data-test="integralyk-figure"]').trigger('click')
    await w.find('[data-test="integralyk-cta"]').trigger('click')
    expect(push).toHaveBeenCalledTimes(2)
    expect(push.mock.calls[1][0]).toEqual(mainTarget)
    expect(Object.keys(push.mock.calls[1][0].query)).toEqual(['redirect']) // жодних utm_*/ref
  })

  it('без redirect — так само порожній query, як у головної кнопки', async () => {
    route.query = {}
    const w = await mountLanding()
    vi.advanceTimersByTime(2000)
    await settle()
    await w.find('[data-test="integralyk-figure"]').trigger('click')
    await w.find('[data-test="integralyk-cta"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ path: '/auth/register/tutor', query: {} })
  })

  it('напис кнопки панельки = напис головної кнопки', async () => {
    const w = await mountLanding()
    vi.advanceTimersByTime(2000)
    await settle()
    await w.find('[data-test="integralyk-figure"]').trigger('click')
    expect(w.find('[data-test="integralyk-cta"]').text()).toBe(w.find('.hero-cta-primary').text())
  })

  it('фігурка над шапкою сторінки: перетягнута під шапку, вона б зникла (місце запам\'ятовується)', () => {
    const zOf = (src: string, selector: string) => {
      const block = src.slice(src.indexOf(`${selector} {`))
      return Number(block.slice(0, block.indexOf('}')).match(/z-index:\s*(\d+)/)?.[1])
    }
    const header = zOf(landingSource, '.nav-header')
    expect(header).toBeGreaterThan(0)
    expect(zOf(hintSource, '.lih')).toBeGreaterThan(header)
  })

  it('підключено одним рядком; охорона вказує на справжню головну кнопку й нижні посилання', async () => {
    const usages = landingSource.match(/<LandingIntegralykHint\b[^>]*\/>/g) ?? []
    expect(usages).toHaveLength(1)
    expect(usages[0]).toMatch(/@register="selectTutor"/)
    const selector = usages[0].match(/guard-selector="([^"]+)"/)?.[1] ?? ''
    expect(selector).toContain('.hero-cta-primary')
    expect(selector).toContain('.hero-cta-ghost')

    const w = await mountLanding()
    const guarded = document.querySelectorAll(selector)
    const main = w.find('.hero-cta-primary').element
    expect([...guarded]).toContain(main)
    expect([...guarded]).toContain(w.find('.hero-cta-ghost').element)
    expect([...guarded].some((el) => el.classList.contains('landing-footer-links'))).toBe(true)
  })
})
