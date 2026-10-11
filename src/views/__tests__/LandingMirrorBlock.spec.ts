/**
 * Лендінг /start — блок «Дзеркало» з коротким відео крейдяної дошки (2026-10-11).
 *
 * Власник: «роби відео Дзеркала, але так, щоб я міг змінити потім, як кращі зніму».
 * Тримаємо: типове вбудоване відео без налаштування; відео з адмінки (`mirror_video` у
 * landing-config) — замість нього і без дати під ним; ліниве завантаження (src лише коли
 * блок біля екрана); `prefers-reduced-motion` — нічого не вантажиться без ▶; відео з адмінки
 * не відкрилось — тихо типове; браузер не дав грати саме — ▶; пауза для тих, кому рух заважає.
 *
 * Вигляд (сітка, розміри на 375/1366) тут не перевірити — happy-dom не рахує CSS; знімки
 * Playwright — saas_docs/frontend/design-system/landing_shots/mirror_block/.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, RouterLinkStub, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h } from 'vue'
import uk from '@/i18n/locales/uk.json'
import landingSource from '../RoleSelectionView.vue?raw'

vi.mock('vue-router', () => ({
  useRoute: () => ({ query: {} }),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/i18n', () => ({ setLocale: vi.fn() }))

const get = vi.fn()
vi.mock('@/api/client', () => ({ default: { get: (...args: unknown[]) => get(...args) } }))
vi.mock('@/modules/winterboard/components/public/EyePlayer.vue', () => ({
  __esModule: true,
  default: defineComponent({ setup: () => () => h('div') }),
}))

import LandingMirrorBlock from '../LandingMirrorBlock.vue'
import RoleSelectionView from '../RoleSelectionView.vue'

const DEFAULT_VIDEO = '/landing/mirror-drobi.mp4'
const DEFAULT_POSTER = '/landing/mirror-drobi.jpg'
const ADMIN = {
  url: 'https://images.m4sh.org/landing/mirror-kreyda.mp4',
  poster: 'https://images.m4sh.org/landing/mirror-kreyda.jpg',
}

// Керований IntersectionObserver: у happy-dom свій ніколи не спрацьовує.
class FakeIO {
  static all: FakeIO[] = []
  options: IntersectionObserverInit | undefined
  constructor(public cb: (entries: Array<{ isIntersecting: boolean }>) => void, options?: IntersectionObserverInit) {
    this.options = options
    FakeIO.all.push(this)
  }
  observe() {}
  unobserve() {}
  takeRecords() { return [] }
  disconnect() {}
  fire(...flags: boolean[]) { this.cb(flags.map((isIntersecting) => ({ isIntersecting }))) }
}
const io = () => FakeIO.all[0]

let wrapper: VueWrapper | null = null
let play: ReturnType<typeof vi.spyOn>
let pause: ReturnType<typeof vi.spyOn>
let warn: ReturnType<typeof vi.spyOn>

function i18n() {
  return createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk }, missingWarn: false })
}

async function mountBlock() {
  wrapper = mount(LandingMirrorBlock, { global: { plugins: [i18n()] } })
  await flushPromises()
  await flushPromises()
  return wrapper
}

const video = (w: VueWrapper) => w.find('video')
const videoEl = (w: VueWrapper) => video(w).element as HTMLVideoElement

async function enterView(...flags: boolean[]) {
  io().fire(...(flags.length ? flags : [true]))
  await flushPromises()
  await flushPromises()
}

function reduceMotion() {
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce'), media: q }))
}

beforeEach(() => {
  get.mockReset()
  FakeIO.all = []
  vi.stubGlobal('IntersectionObserver', FakeIO)
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: false, media: q }))
  play = vi.spyOn(HTMLMediaElement.prototype, 'play')
  pause = vi.spyOn(HTMLMediaElement.prototype, 'pause')
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Дзеркало на /start: типове відео', () => {
  it('без налаштування — вбудоване відео з дробами, постер, дата під ним; тексти людські', async () => {
    get.mockResolvedValue({ replay_demo_url: '', replay_demo_preview: null, mirror_video: null })
    const w = await mountBlock()

    expect(get).toHaveBeenCalledWith('/landing-config/')
    expect(w.find('h2').text()).toBe('Звичайна дошка з крейдою — теж на уроці в M4SH')
    expect(w.find('.landing-mirror-body').text())
      .toBe("Телефон дивиться на дошку — нові записи самі з'являються на сторінці уроку.")
    expect(w.find('[data-test="landing-mirror-caption"]').text()).toBe('Справжній урок · 9 жовтня 2026')

    const v = video(w)
    expect(v.attributes('poster')).toBe(DEFAULT_POSTER)
    expect(v.attributes('preload')).toBe('none')
    expect(v.attributes()).toHaveProperty('loop')
    expect(v.attributes()).toHaveProperty('playsinline')
    expect(v.attributes()).toHaveProperty('autoplay')
    expect(v.attributes()).toHaveProperty('muted')
    expect(v.attributes()).not.toHaveProperty('controls') // без перемоток
    expect(videoEl(w).muted).toBe(true)
    expect(v.attributes('aria-label')).toBe('Відео: крейдяна дошка на уроці')

    await enterView()
    expect(v.attributes('src')).toBe(DEFAULT_VIDEO)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('старий бекенд без поля mirror_video — так само типове', async () => {
    get.mockResolvedValue({ replay_demo_url: '' })
    const w = await mountBlock()
    await enterView()
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(w.find('[data-test="landing-mirror-caption"]').exists()).toBe(true)
  })

  it('landing-config не прочитано — типове відео і попередження в консолі (не порожній catch)', async () => {
    get.mockRejectedValue(new Error('offline'))
    const w = await mountBlock()
    await enterView()
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('landing-config'), expect.any(Error))
  })
})

describe('Дзеркало на /start: відео з адмінки', () => {
  it('mirror_video задано — його відео й постер, без дати', async () => {
    get.mockResolvedValue({ mirror_video: ADMIN })
    const w = await mountBlock()
    expect(video(w).attributes('poster')).toBe(ADMIN.poster)
    await enterView()
    expect(video(w).attributes('src')).toBe(ADMIN.url)
    expect(w.find('[data-test="landing-mirror-caption"]').exists()).toBe(false)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('без постера — постера немає (типовий кадр з дробами до чужого відео не підставляємо)', async () => {
    get.mockResolvedValue({ mirror_video: { url: ADMIN.url, poster: '' } })
    const w = await mountBlock()
    expect(video(w).attributes('poster')).toBeUndefined()
    await enterView()
    expect(video(w).attributes('src')).toBe(ADMIN.url)
  })

  it.each([
    ['http-адреса', { url: 'http://images.m4sh.org/landing/m.mp4', poster: '' }],
    ['не рядок', { url: 42, poster: '' }],
    ['javascript:', { url: 'javascript:alert(1)', poster: '' }],
    ['не об\'єкт', 'https://images.m4sh.org/landing/m.mp4'],
  ])('невалідне значення (%s) — типове відео', async (_name, mirrorVideo) => {
    get.mockResolvedValue({ mirror_video: mirrorVideo })
    const w = await mountBlock()
    await enterView()
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(video(w).attributes('poster')).toBe(DEFAULT_POSTER)
  })

  it('відео з адмінки не відкрилось — тихо типове (з console.warn), дата з\'являється', async () => {
    get.mockResolvedValue({ mirror_video: ADMIN })
    const w = await mountBlock()
    await enterView()
    expect(video(w).attributes('src')).toBe(ADMIN.url)

    await video(w).trigger('error')
    await flushPromises()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('показуємо типове'), ADMIN.url)
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(video(w).attributes('poster')).toBe(DEFAULT_POSTER)
    expect(w.find('[data-test="landing-mirror-caption"]').exists()).toBe(true)
    expect(play).toHaveBeenCalledTimes(2) // типове грає далі само
  })

  it('файл з адмінки не відкрився (play() → NotSupportedError, як у Chrome) — це не «заборона грати»: ▶ немає, далі грає саме', async () => {
    // Порядок як у специфікації HTML: спершу подія error, потім відмова обіцянки play()
    let rejectPlay!: (e: unknown) => void
    play.mockImplementationOnce(() => new Promise<void>((_, reject) => { rejectPlay = reject }))
    get.mockResolvedValue({ mirror_video: ADMIN })
    const w = await mountBlock()
    await enterView()
    await video(w).trigger('error')
    rejectPlay(Object.assign(new Error('no supported source'), { name: 'NotSupportedError' }))
    await flushPromises()
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(w.find('[data-test="landing-mirror-play"]').exists()).toBe(false)
    await enterView(false) // прогорнули
    expect(w.find('[data-test="landing-mirror-play"]').exists()).toBe(false)
    await enterView(true) // повернулись — грає саме
    expect(play).toHaveBeenCalledTimes(3)
    const ours = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('показуємо ▶'))
    expect(ours).toEqual([])
  })

  it('і типове не відкрилось — лишається постер, без кнопок і без нескінченного кола', async () => {
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    await enterView()
    videoEl(w).pause()
    await video(w).trigger('error')
    await flushPromises()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('типове відео не відкрилось'), DEFAULT_VIDEO)
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(w.find('[data-test="landing-mirror-play"]').exists()).toBe(false)
    expect(w.find('[data-test="landing-mirror-pause"]').exists()).toBe(false)
  })
})

describe('Дзеркало на /start: ліниве завантаження', () => {
  it('поки блок не біля екрана — src немає (1,8 МБ не вантажимо); спостерігач з запасом 200px', async () => {
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    expect(FakeIO.all).toHaveLength(1)
    expect(io().options?.rootMargin).toBe('200px 0px')
    expect(video(w).attributes('src')).toBeUndefined()
    await enterView(false)
    expect(video(w).attributes('src')).toBeUndefined()
    expect(play).not.toHaveBeenCalled()
    await enterView(true, false) // зайшов і одразу вийшов — вирішує останній запис
    expect(video(w).attributes('src')).toBeUndefined()
  })

  it('блок на екрані раніше за landing-config — відео стартує, щойно конфіг прийшов (і саме те)', async () => {
    let resolve!: (v: unknown) => void
    get.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = await mountBlock()
    await enterView()
    expect(video(w).attributes('src')).toBeUndefined() // ще не знаємо, яке відео
    resolve({ mirror_video: ADMIN })
    await flushPromises()
    await flushPromises()
    expect(video(w).attributes('src')).toBe(ADMIN.url)
    expect(play).toHaveBeenCalledTimes(1)
  })

  it('прогорнули — пауза; повернулись — грає далі', async () => {
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    await enterView()
    expect(w.find('[data-test="landing-mirror-pause"]').exists()).toBe(true) // грає
    await enterView(false)
    expect(pause).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="landing-mirror-play"]').exists()).toBe(false) // не ▶: саме відновиться
    await enterView(true)
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('браузер без IntersectionObserver — відео є одразу після конфігу', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(play).toHaveBeenCalledTimes(1)
  })
})

describe('Дзеркало на /start: менше руху і пауза', () => {
  it('prefers-reduced-motion — без спостерігача й автозапуску: лише постер і ▶; ▶ вмикає', async () => {
    reduceMotion()
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    expect(FakeIO.all).toHaveLength(0)
    expect(video(w).attributes('src')).toBeUndefined()
    expect(video(w).attributes()).not.toHaveProperty('autoplay')
    expect(video(w).attributes('poster')).toBe(DEFAULT_POSTER)
    expect(play).not.toHaveBeenCalled()

    const btn = w.find('[data-test="landing-mirror-play"]')
    expect(btn.attributes('aria-label')).toBe('Відтворити відео')
    await btn.trigger('click')
    await flushPromises()
    expect(video(w).attributes('src')).toBe(DEFAULT_VIDEO)
    expect(play).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="landing-mirror-play"]').exists()).toBe(false)
    expect(w.find('[data-test="landing-mirror-pause"]').exists()).toBe(true)
  })

  it('пауза — зупиняє і не відновлює саме, навіть коли блок знову на екрані', async () => {
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    await enterView()
    const pauseBtn = w.find('[data-test="landing-mirror-pause"]')
    expect(pauseBtn.attributes('aria-label')).toBe('Пауза')
    await pauseBtn.trigger('click')
    await flushPromises()
    expect(pause).toHaveBeenCalledTimes(1)
    expect(w.find('[data-test="landing-mirror-play"]').exists()).toBe(true)

    await enterView(false)
    await enterView(true)
    expect(play).toHaveBeenCalledTimes(1) // лише перший автозапуск
    await w.find('[data-test="landing-mirror-play"]').trigger('click')
    await flushPromises()
    expect(play).toHaveBeenCalledTimes(2)
  })

  it('браузер не дав грати саме (режим економії) — показуємо ▶, натискання запускає', async () => {
    play.mockRejectedValueOnce(Object.assign(new Error('blocked'), { name: 'NotAllowedError' }))
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    await enterView()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('показуємо ▶'), expect.any(Error))
    const btn = w.find('[data-test="landing-mirror-play"]')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    await flushPromises()
    expect(play).toHaveBeenCalledTimes(2)
    expect(w.find('[data-test="landing-mirror-pause"]').exists()).toBe(true)
  })

  it('пауза раніше за старт (AbortError) — не перешкода: ▶ не з\'являється', async () => {
    play.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    get.mockResolvedValue({ mirror_video: null })
    const w = await mountBlock()
    await enterView()
    expect(w.find('[data-test="landing-mirror-play"]').exists()).toBe(false)
    // (Vue сам попереджає про повторну реєстрацію i18n з tests/setup.js — то не наше)
    const ours = warn.mock.calls.filter((c: unknown[]) => String(c[0]).includes('[LandingMirrorBlock]'))
    expect(ours).toEqual([])
  })
})

describe('Дзеркало на сторінці /start', () => {
  it('підключено одним рядком — після «3D тіл» і перед карткою «Я хочу вчити»', async () => {
    expect(landingSource.match(/<LandingMirrorBlock\b[^>]*\/>/g) ?? []).toHaveLength(1)

    get.mockResolvedValue({ replay_demo_url: '', replay_demo_preview: null, mirror_video: null })
    wrapper = mount(RoleSelectionView, {
      global: {
        plugins: [i18n()],
        stubs: { 'router-link': RouterLinkStub, LandingTrigCircle: true, LandingNmt3d: true, ProjectSupportLink: true },
      },
    })
    await flushPromises()
    const content = wrapper.find('.content-wrapper').element
    const order = [...content.children].map((el) => (
      el.matches('[data-test="landing-mirror"]') ? 'mirror'
        : el.classList.contains('live-tools-section') ? 'liveTools'
          : el.classList.contains('cards-container') ? 'cards' : null
    )).filter(Boolean)
    expect(order).toEqual(['liveTools', 'mirror', 'cards'])
  })
})
