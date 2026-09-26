/**
 * Лендинг, секція «Перегляньте, як проходив урок» — рамка з реальним реплеєм.
 *
 * 2026-09-26, власник зі скриншотом прода: «чи має так виглядати на лендінгу?» — з
 * посиланням рамка мала постійний сірий шар над умовною анімацією й блідий напис, а сама
 * була «картинкою» (role="img"), тож посилання читалки екрана не бачили.
 * 2026-09-27, власник: «я думав там у вікні зразу буде наше око з реплея» — рамка тепер
 * зменшений стартовий екран реплею: картинка дошки цього запису, те саме око, назва,
 * тривалість і сторінки. Рішення B1 від 06-24 (посилання, нова вкладка) — без змін.
 * 2026-09-27 (Б-85): дані афіші — у тому самому кешованому landing-config; окремого
 * запиту за афішею лендинг більше не робить.
 *
 * Стилі тут не перевірити (happy-dom не рахує scoped CSS) — вигляд звірено наживо в
 * браузері. Тест тримає будову і дані: що показано, коли відкат, коли око живе.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import uk from '@/i18n/locales/uk.json'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/i18n', () => ({ setLocale: vi.fn() }))

const get = vi.fn()
vi.mock('@/api/client', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))

// Око — власний тест (eyePlayer.spec.ts); тут лише «воно є і живе чи ні».
// __esModule: лендинг вантажить око через defineAsyncComponent, а той розпаковує default
// лише в ES-модуля — інакше Vue лізе в сам мок по __isTeleport і вітест падає.
vi.mock('@/modules/winterboard/components/public/EyePlayer.vue', () => ({
  __esModule: true,
  default: defineComponent({
    props: { active: Boolean },
    setup: (p) => () => h('div', { class: 'eye-stub', 'data-active': String(p.active) }),
  }),
}))

import RoleSelectionView from '../RoleSelectionView.vue'

// Керований IntersectionObserver: у happy-dom свій ніколи не спрацьовує.
class FakeIO {
  static all: FakeIO[] = []
  constructor(public cb: (entries: Array<{ isIntersecting: boolean }>) => void) {
    FakeIO.all.push(this)
  }
  observe() {}
  unobserve() {}
  takeRecords() { return [] }
  disconnect() {}
  fire(...flags: boolean[]) { this.cb(flags.map((isIntersecting) => ({ isIntersecting }))) }
}
const eyeIO = () => FakeIO.all[0]

const REPLAY = 'https://m4sh.org/winterboard/public/demo-token'
const PREVIEW = {
  title: 'DEMO', page_count: 4, duration_ms: 15 * 60 * 1000,
  thumbnail_url: 'https://images.m4sh.org/winterboard/x/thumbnails/thumb.png',
}

async function mountLanding() {
  const i18n = createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
  const w = mount(RoleSelectionView, {
    global: {
      plugins: [i18n],
      stubs: { 'router-link': RouterLinkStub, LandingTrigCircle: true, LandingNmt3d: true, ProjectSupportLink: true },
    },
  })
  await flushPromises()
  await flushPromises()
  return w
}

// Тіло в дужках навмисно: функцію, яку повертає beforeEach, Vitest викликає як прибирання
// після тесту, а mockReset() повертає сам мок — тоді «прибирання» ще раз смикало б API.
beforeEach(() => {
  get.mockReset()
  FakeIO.all = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Лендинг: рамка демо-реплею — афіша реального уроку', () => {
  it('прев\'ю з landing-config: картинка дошки, око, назва, «15 хв · 4 стор.»; запит один', async () => {
    get.mockResolvedValue({ replay_demo_url: REPLAY, replay_demo_preview: PREVIEW })
    const w = await mountLanding()

    // Б-85: окремого запиту за афішею немає — лише кешований landing-config
    expect(get).toHaveBeenCalledTimes(1)
    expect(get).toHaveBeenCalledWith('/landing-config/')

    const frame = w.find('.replay-frame')
    const img = frame.find('img.replay-poster')
    expect(img.attributes('src')).toBe(PREVIEW.thumbnail_url)
    // Поки картинка вантажиться — анімація лишається (без «порожньої» рамки)
    expect(frame.find('.replay-strokes').exists()).toBe(true)

    await img.trigger('load')
    expect(frame.classes()).toContain('replay-frame--poster')
    expect(frame.find('.replay-strokes').exists()).toBe(false)
    expect(frame.find('.replay-badge').exists()).toBe(false)

    const link = frame.find('a.replay-cta')
    expect(link.attributes('href')).toBe(REPLAY)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toContain('noopener')
    expect(link.attributes('aria-label')).toBe('Подивитись реальний урок: DEMO')
    expect(link.find('.eye-stub').exists()).toBe(true)
    expect(link.find('.replay-cta-title').text()).toBe('DEMO')
    expect(link.find('.replay-cta-meta').text()).toBe('15 хв · 4 стор.')
    expect(link.find('.replay-cta-label').exists()).toBe(false)
    // «Картинкою» рамка з посиланням не є — посилання бачать читалки екрана
    expect(frame.attributes('role')).toBeUndefined()
  })

  it('тривалості чи сторінок немає — підпис без них', async () => {
    get.mockResolvedValue({ replay_demo_url: REPLAY, replay_demo_preview: { ...PREVIEW, duration_ms: 0, page_count: 1 } })
    const w = await mountLanding()
    await w.find('img.replay-poster').trigger('load')
    expect(w.find('.replay-cta-title').text()).toBe('DEMO')
    expect(w.find('.replay-cta-meta').exists()).toBe(false)
  })

  it('картинка не завантажилась — око над анімацією і плашка з підписом', async () => {
    get.mockResolvedValue({ replay_demo_url: REPLAY, replay_demo_preview: PREVIEW })
    const w = await mountLanding()
    await w.find('img.replay-poster').trigger('error')
    const frame = w.find('.replay-frame')
    expect(frame.classes()).not.toContain('replay-frame--poster')
    expect(frame.find('img.replay-poster').exists()).toBe(false)
    expect(frame.find('.replay-strokes').exists()).toBe(true)
    expect(frame.find('.eye-stub').exists()).toBe(true)
    expect(frame.find('.replay-cta-label').text()).toBe('Подивитись реальний урок')
  })

  it('прев\'ю немає (чуже посилання, запис приватний) — око з підписом, посилання працює', async () => {
    get.mockResolvedValue({ replay_demo_url: 'https://www.youtube.com/watch?v=demo', replay_demo_preview: null })
    const w = await mountLanding()
    const frame = w.find('.replay-frame')
    expect(frame.find('img.replay-poster').exists()).toBe(false)
    expect(frame.find('a.replay-cta').attributes('href')).toBe('https://www.youtube.com/watch?v=demo')
    expect(frame.find('.eye-stub').exists()).toBe(true)
    expect(frame.find('.replay-cta-label').text()).toBe('Подивитись реальний урок')
  })

  it('старий бекенд без поля прев\'ю — те саме: око з підписом', async () => {
    get.mockResolvedValue({ replay_demo_url: REPLAY })
    const w = await mountLanding()
    expect(w.find('img.replay-poster').exists()).toBe(false)
    expect(w.find('.eye-stub').exists()).toBe(true)
    expect(w.find('.replay-cta-label').text()).toBe('Подивитись реальний урок')
  })

  it('з посиланням ▶ один — у оці; у плашці зверху лишається лише текст', async () => {
    get.mockResolvedValue({ replay_demo_url: 'https://www.youtube.com/watch?v=demo', replay_demo_preview: null })
    const w = await mountLanding()
    const badge = w.find('.replay-badge')
    expect(badge.text()).toBe('Відтворення дій на дошці')
    expect(badge.find('svg').exists()).toBe(false)
  })
})

describe('Лендинг: око живе лише коли треба', () => {
  const eye = (w: Awaited<ReturnType<typeof mountLanding>>) => w.find('.eye-stub').attributes('data-active')

  it('поки рамку видно — живе; у пачці записів вирішує останній', async () => {
    get.mockResolvedValue({ replay_demo_url: REPLAY, replay_demo_preview: PREVIEW })
    const w = await mountLanding()
    expect(eye(w)).toBe('false')
    eyeIO().fire(true)
    await flushPromises()
    expect(eye(w)).toBe('true')
    eyeIO().fire(true, false) // зайшла й одразу вийшла — око не має жити поза екраном
    await flushPromises()
    expect(eye(w)).toBe('false')
    eyeIO().fire(false, true)
    await flushPromises()
    expect(eye(w)).toBe('true')
  })

  it('людина просила менше руху — око нерухоме', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }))
    get.mockResolvedValue({ replay_demo_url: REPLAY, replay_demo_preview: PREVIEW })
    const w = await mountLanding()
    expect(FakeIO.all).toHaveLength(0)
    expect(eye(w)).toBe('false')
  })

  it('браузер без IntersectionObserver — око нерухоме, афіша є', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    get.mockResolvedValue({ replay_demo_url: REPLAY, replay_demo_preview: PREVIEW })
    const w = await mountLanding()
    expect(w.find('img.replay-poster').exists()).toBe(true)
    expect(eye(w)).toBe('false')
  })
})

describe('Лендинг: без посилання — заглушка як була', () => {
  it('«картинка» з підписом, без посилання й без ока', async () => {
    get.mockResolvedValue({ replay_demo_url: '', replay_demo_preview: null })
    const w = await mountLanding()
    const frame = w.find('.replay-frame')
    expect(frame.attributes('role')).toBe('img')
    expect(frame.attributes('aria-label')).toBe('Відтворення дій на дошці')
    expect(frame.find('a.replay-cta').exists()).toBe(false)
    expect(frame.find('.eye-stub').exists()).toBe(false)
    expect(frame.find('.replay-badge svg').exists()).toBe(true)
  })

  it('налаштування не прочиталось — та сама заглушка, лендинг не падає', async () => {
    get.mockRejectedValue(new Error('offline'))
    const w = await mountLanding()
    const frame = w.find('.replay-frame')
    expect(frame.attributes('role')).toBe('img')
    expect(frame.find('a.replay-cta').exists()).toBe(false)
  })
})
