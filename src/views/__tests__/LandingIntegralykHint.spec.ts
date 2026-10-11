/**
 * Інтегралик на лендінгу /start — ТЗ saas_docs/frontend/design-system/TZ_START_INTEGRALYK_HINTS_2026-10-11.md
 * (§1–§2 після рев'ю Лови: ОДНА статична фраза, без каруселі; приклади результату — лише після торкання;
 * кнопка — туди ж, куди наявна кнопка реєстрації; без обіцянки «увімкнеться після реєстрації»).
 *
 * Що перевіряємо (§5): поява із затримкою; фраза одна й не змінюється; ховається через ~8 с / після
 * прокрутки; мова з `locale`; тап → три приклади → кнопка реєстрації; ✕ панельки й ✕ фігурки; пам'ять
 * у сеансі (і без `sessionStorage`); reduced-motion; пауза у прихованій вкладці; не закриває головну кнопку.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'
import uk from '@/i18n/locales/uk.json'
import en from '@/i18n/locales/en.json'
import ru from '@/i18n/locales/ru.json'
import hintSource from '../LandingIntegralykHint.vue?raw'

vi.mock('@/utils/siteVisit', () => ({ trackIntegralykTap: vi.fn() }))

import { trackIntegralykTap } from '@/utils/siteVisit'
import LandingIntegralykHint from '../LandingIntegralykHint.vue'

type Hint = Record<string, string>
const hintOf = (dict: unknown) => (dict as { roleSelection: { integralykHint: Hint } }).roleSelection.integralykHint
const ctaOf = (dict: unknown) => (dict as { roleSelection: { hero: { ctaTutor: string } } }).roleSelection.hero.ctaTutor
const UK = hintOf(uk)
const HIDDEN_KEY = 'm4sh:landing-integralyk-hidden'

const BUBBLE = '[data-test="integralyk-bubble"]'
const FIGURE = '[data-test="integralyk-figure"]'
const PANEL = '[data-test="integralyk-panel"]'
const ROOT = '[data-test="landing-integralyk"]'

let wrapper: VueWrapper | null = null
const originalMatchMedia = window.matchMedia
let rects: Record<string, DOMRect> = {}

function rect(left: number, top: number, width: number, height: number): DOMRect {
  return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) } as DOMRect
}

async function settle() {
  for (let i = 0; i < 6; i++) await nextTick()
}

async function advance(ms: number) {
  vi.advanceTimersByTime(ms)
  await settle()
}

function setVisibility(state: 'hidden' | 'visible') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

async function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true, writable: true })
  window.dispatchEvent(new Event('scroll'))
  await settle()
}

function setReducedMotion(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion: reduce'),
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

function mountHint(locale: 'uk' | 'en' | 'ru' = 'uk') {
  const i18n = createI18n({
    legacy: false, locale, fallbackLocale: 'uk', messages: { uk, en, ru }, missingWarn: false, fallbackWarn: false,
  })
  wrapper = mount(LandingIntegralykHint, {
    props: { guardSelector: '.guard' },
    // tests/setup.js перезаписує global.stubs і прибирає стандартну заглушку <Transition> —
    // без неї елемент, що зникає, чекає кінця CSS-переходу, якого в тестах немає.
    global: { plugins: [i18n], stubs: { transition: true } },
    attachTo: document.body,
  })
  return { w: wrapper, i18n }
}

async function mountShown(locale: 'uk' | 'en' | 'ru' = 'uk') {
  const m = mountHint(locale)
  await advance(2000)
  return m
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(trackIntegralykTap).mockClear()
  sessionStorage.clear()
  setReducedMotion(false)
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: 667, configurable: true, writable: true })
  rects = {}
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    if (this.classList.contains('guard')) return rects.guard ?? rect(0, 0, 0, 0)
    const key = (this as HTMLElement).dataset?.test
    return (key && rects[key]) || rect(0, 0, 0, 0)
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.querySelectorAll('.guard').forEach((el) => el.remove())
  delete (document as { visibilityState?: string }).visibilityState
  window.matchMedia = originalMatchMedia
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('поява', () => {
  it('до ~2 с нічого, потім фігурка й фраза', async () => {
    const { w } = mountHint()
    await advance(1900)
    expect(w.find(FIGURE).exists()).toBe(false)
    expect(w.find(BUBBLE).exists()).toBe(false)
    await advance(100)
    expect(w.find(FIGURE).exists()).toBe(true)
    const bubble = w.find(BUBBLE)
    expect(bubble.exists()).toBe(true)
    expect(bubble.text()).toBe(UK.phrase)
    expect(bubble.classes()).not.toContain('lih-bubble--measuring')
  })

  it('вкладку сховано — відлік до появи на паузі', async () => {
    const { w } = mountHint()
    await advance(1000)
    setVisibility('hidden')
    await advance(5000)
    expect(w.find(FIGURE).exists()).toBe(false)
    setVisibility('visible')
    await advance(900)
    expect(w.find(FIGURE).exists()).toBe(false)
    await advance(100)
    expect(w.find(FIGURE).exists()).toBe(true)
  })

  it('фігурка — кнопка з підписом, фраза — у живій області для читалки', async () => {
    const { w } = mountHint()
    const live = w.find('[aria-live="polite"]')
    expect(live.exists()).toBe(true) // область є ще до появи — інакше читалка не оголосить фразу
    await advance(2000)
    const figure = w.find(FIGURE)
    expect(figure.element.tagName).toBe('BUTTON')
    expect(figure.attributes('aria-label')).toBe(UK.openLabel)
    expect(figure.attributes('aria-expanded')).toBe('false')
    expect(w.find('[aria-live="polite"]').find(BUBBLE).exists()).toBe(true)
    expect(w.find('[data-test="integralyk-hide"]').element.tagName).toBe('BUTTON')
  })
})

describe('одна фраза, без каруселі', () => {
  it('поки фраза видна, вона та сама й одна', async () => {
    const { w } = await mountShown()
    const seen = new Set<string>()
    for (let t = 0; t < 7500; t += 500) {
      expect(w.findAll(BUBBLE)).toHaveLength(1)
      seen.add(w.find(BUBBLE).text())
      await advance(500)
    }
    expect([...seen]).toEqual([UK.phrase])
  })

  it('у перекладах одна фраза — жодного списку фраз для каруселі', () => {
    for (const dict of [uk, en, ru]) {
      const hint = hintOf(dict)
      expect(Object.keys(hint).filter((k) => /^phrase/i.test(k))).toEqual(['phrase'])
      expect(Object.values(hint).every((v) => typeof v === 'string')).toBe(true)
    }
  })
})

describe('фраза ховається, фігурка лишається', () => {
  it('через ~8 с', async () => {
    const { w } = await mountShown()
    await advance(7900)
    expect(w.find(BUBBLE).exists()).toBe(true)
    await advance(100)
    expect(w.find(BUBBLE).exists()).toBe(false)
    expect(w.find(FIGURE).exists()).toBe(true)
    await advance(60_000)
    expect(w.find(BUBBLE).exists()).toBe(false) // не повертається
  })

  it('після прокрутки (тремтіння пальця — ні)', async () => {
    const { w } = await mountShown()
    await scrollTo(30)
    expect(w.find(BUBBLE).exists()).toBe(true)
    await scrollTo(200)
    expect(w.find(BUBBLE).exists()).toBe(false)
    expect(w.find(FIGURE).exists()).toBe(true)
  })

  it('8 с фрази теж на паузі у прихованій вкладці', async () => {
    const { w } = await mountShown()
    await advance(4000)
    setVisibility('hidden')
    await advance(10_000)
    expect(w.find(BUBBLE).exists()).toBe(true)
    setVisibility('visible')
    await advance(3900)
    expect(w.find(BUBBLE).exists()).toBe(true)
    await advance(100)
    expect(w.find(BUBBLE).exists()).toBe(false)
  })
})

describe('мова — поточна мова сторінки', () => {
  it('en з першого кадру; змінили на ru — фраза й панелька одразу російською', async () => {
    const { w, i18n } = await mountShown('en')
    expect(w.find(BUBBLE).text()).toBe(hintOf(en).phrase)
    i18n.global.locale.value = 'ru'
    await settle()
    expect(w.find(BUBBLE).text()).toBe(hintOf(ru).phrase)
    await w.find(FIGURE).trigger('click')
    const items = w.findAll(`${PANEL} li`).map((li) => li.text())
    expect(items).toEqual([hintOf(ru).example1, hintOf(ru).example2, hintOf(ru).example3])
    expect(w.find('[data-test="integralyk-cta"]').text()).toBe(ctaOf(ru))
  })
})

describe('торкання → панелька', () => {
  it('фігурка: три приклади результату, кнопка реєстрації, підпис; фраза ховається; подія воронки', async () => {
    const { w } = await mountShown()
    expect(w.find(PANEL).exists()).toBe(false) // приклади — лише після торкання
    await w.find(FIGURE).trigger('click')
    await settle()
    const panel = w.find(PANEL)
    expect(panel.exists()).toBe(true)
    expect(panel.findAll('li').map((li) => li.text())).toEqual([UK.example1, UK.example2, UK.example3])
    expect(panel.find('[data-test="integralyk-cta"]').text()).toBe(ctaOf(uk))
    expect(panel.find('.lih-note').text()).toBe(UK.note)
    expect(w.find(BUBBLE).exists()).toBe(false)
    expect(w.find(FIGURE).attributes('aria-expanded')).toBe('true')
    expect(w.find(FIGURE).attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(trackIntegralykTap).toHaveBeenCalledTimes(1)
  })

  it('фраза теж відкриває панельку', async () => {
    const { w } = await mountShown()
    await w.find(BUBBLE).trigger('click')
    expect(w.find(PANEL).exists()).toBe(true)
    expect(trackIntegralykTap).toHaveBeenCalledTimes(1)
  })

  it('кнопка панельки — подія `register` (куди вести, вирішує сторінка; див. інтеграційний тест)', async () => {
    const { w } = await mountShown()
    await w.find(FIGURE).trigger('click')
    await w.find('[data-test="integralyk-cta"]').trigger('click')
    expect(w.emitted('register')).toHaveLength(1)
  })

  it('✕ панельки закриває її, фігурка лишається; Escape — так само', async () => {
    const { w } = await mountShown()
    await w.find(FIGURE).trigger('click')
    await w.find('[data-test="integralyk-panel-close"]').trigger('click')
    await settle()
    expect(w.find(PANEL).exists()).toBe(false)
    expect(w.find(FIGURE).exists()).toBe(true)
    expect(w.find(FIGURE).attributes('aria-expanded')).toBe('false')

    await w.find(FIGURE).trigger('click')
    expect(w.find(PANEL).exists()).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await settle()
    expect(w.find(PANEL).exists()).toBe(false)
    expect(w.find(FIGURE).exists()).toBe(true)
  })

  it('жодних мережевих викликів і чату: компонент не тягне ні API, ні моделі', () => {
    const script = hintSource.slice(hintSource.indexOf('<script'), hintSource.indexOf('</script>'))
    // Будь-який import — і з «from», і побічний `import '…'`; динамічних import() теж немає.
    const imports = [...script.matchAll(/^import\b.*'([^']+)'\s*$/gm)].map((m) => m[1])
    expect(script).not.toMatch(/\bimport\(/)
    expect(imports.sort()).toEqual(['@/modules/intent/integralykMascotSvg', '@/utils/siteVisit', 'vue', 'vue-i18n'])
    expect(script).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|axios|apiClient|sendIntent/)
    expect(hintSource).not.toMatch(/<input|<textarea|contenteditable/)
  })
})

describe('✕ фігурки й пам\'ять у сеансі вкладки', () => {
  it('✕ ховає фігурку; після перезавантаження сторінки в тій самій вкладці її немає', async () => {
    const { w } = await mountShown()
    await w.find('[data-test="integralyk-hide"]').trigger('click')
    expect(w.find(ROOT).exists()).toBe(false)
    expect(sessionStorage.getItem(HIDDEN_KEY)).toBe('1')
    w.unmount()
    wrapper = null

    const again = mountHint().w
    await advance(10_000)
    expect(again.find(ROOT).exists()).toBe(false)
  })

  it('сховище заборонене (приватне вікно) — не падає: з\'являється, ✕ ховає', async () => {
    // Як у браузері із забороненим сховищем: кидає саме звертання до window.sessionStorage.
    // (Шпигун на Storage.prototype у happy-dom сховища не зачіпає — перевірка нижче це стереже.)
    const own = Object.getOwnPropertyDescriptor(window, 'sessionStorage')
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new DOMException('denied', 'SecurityError') },
    })
    try {
      expect(() => window.sessionStorage).toThrow()
      const { w } = await mountShown()
      expect(w.find(FIGURE).exists()).toBe(true)
      await w.find('[data-test="integralyk-hide"]').trigger('click')
      expect(w.find(ROOT).exists()).toBe(false)
    } finally {
      if (own) Object.defineProperty(window, 'sessionStorage', own)
      else delete (window as { sessionStorage?: Storage }).sessionStorage
    }
    expect(() => window.sessionStorage.getItem(HIDDEN_KEY)).not.toThrow()
  })
})

describe('менше руху (prefers-reduced-motion)', () => {
  it('без анімацій і переходів', async () => {
    setReducedMotion(true)
    const { w } = await mountShown()
    const root = w.find(ROOT)
    expect(root.attributes('data-motion')).toBe('reduce')
    expect(root.classes()).toContain('lih--still')
  })

  it('звичайно — з рухом', async () => {
    const { w } = await mountShown()
    expect(w.find(ROOT).attributes('data-motion')).toBe('full')
    expect(w.find(ROOT).classes()).not.toContain('lih--still')
  })

  it('стилі: дихання й кліпання вимикаються і класом, і медіазапитом', () => {
    const style = hintSource.slice(hintSource.indexOf('<style'))
    const media = style.slice(style.indexOf('@media (prefers-reduced-motion: reduce)'))
    expect(media).toMatch(/:deep\(\.itg-body\)[\s\S]*animation: none/)
    expect(style).toMatch(/\.lih--still \.lih-mascot :deep\(\.itg-body\)[\s\S]*?animation: none/)
  })
})

describe('не закриває головну кнопку (§3)', () => {
  function addGuard() {
    const el = document.createElement('button')
    el.className = 'guard'
    document.body.appendChild(el)
  }

  it('фраза лягла б на кнопку — чекає прокрутки нижче першого екрана', async () => {
    addGuard()
    // Телефон 375×667: кнопка зліва внизу першого екрана, фігурка в куті справа — не перетинаються,
    // а бульбашка над фігуркою лягла б на кнопку.
    rects.guard = rect(16, 520, 250, 50)
    rects['integralyk-figure-wrap'] = rect(303, 595, 56, 56)
    rects['integralyk-bubble'] = rect(97, 527, 262, 60)
    const { w } = await mountShown()
    expect(w.find(FIGURE).exists()).toBe(true)
    expect(w.find(BUBBLE).exists()).toBe(false)

    // Прогорнули, але ще в першому екрані — досі ні.
    rects.guard = rect(16, 220, 250, 50)
    await scrollTo(300)
    expect(w.find(BUBBLE).exists()).toBe(false)

    // Нижче першого екрана: кнопка поїхала вгору за край.
    rects.guard = rect(16, -180, 250, 50)
    await scrollTo(700)
    const bubble = w.find(BUBBLE)
    expect(bubble.exists()).toBe(true)
    expect(bubble.classes()).not.toContain('lih-bubble--measuring')
  })

  it('фігурка, що лягла б на кнопку, відступає, а коли розійшлися — повертається', async () => {
    addGuard()
    rects.guard = rect(280, 600, 90, 50)
    rects['integralyk-figure-wrap'] = rect(303, 595, 56, 56)
    const { w } = await mountShown()
    expect(w.find(ROOT).classes()).toContain('lih--aside')
    expect(w.find(BUBBLE).exists()).toBe(false) // і фраза не виринає над схованою фігуркою

    rects.guard = rect(280, 300, 90, 50)
    await scrollTo(300)
    expect(w.find(ROOT).classes()).not.toContain('lih--aside')
  })

  it('відкриту панельку людина відкрила сама — фігурку під нею не ховаємо', async () => {
    addGuard()
    const { w } = await mountShown()
    await w.find(FIGURE).trigger('click')
    rects.guard = rect(280, 600, 90, 50)
    rects['integralyk-figure-wrap'] = rect(303, 595, 56, 56)
    await scrollTo(10)
    expect(w.find(ROOT).classes()).not.toContain('lih--aside')
  })
})

describe('тексти (§2)', () => {
  it('uk — дослівно з ТЗ', () => {
    expect(UK.phrase).toBe('Я будую на дошці те, що ви скажете')
    expect(UK.example1).toBe('Прямокутний трикутник із підписаними сторонами й кутами — за секунду')
    expect(UK.example2).toBe('Коло навколо трикутника і правило до нього — поруч на дошці')
    expect(UK.example3).toBe("Перевірка розв'язання з фото зошита")
    expect(UK.note).toBe('Інтегралик працює на дошці вчителя')
    expect(ctaOf(uk)).toBe('Вести уроки на M4SH')
  })

  it('en/ru — ті самі ключі, усі заповнені', () => {
    for (const dict of [en, ru]) {
      const hint = hintOf(dict)
      expect(Object.keys(hint).sort()).toEqual(Object.keys(UK).sort())
      for (const value of Object.values(hint)) expect(value.trim()).not.toBe('')
    }
  })

  it('без обіцянки «увімкнеться після реєстрації» і без «Я — ШІ-помічник» / команд', () => {
    const PROMISE = /реєстрац|одразу|автоматичн|sign[ -]?up|regist|right away|automatic|регистрац|сразу|автоматическ/i
    const SELF_AI = /ШІ|\bAI\b|\bИИ\b|помічник|assistant|помощник|Скажіть|Say:|Скажите|додай|add a|добавь/i
    for (const dict of [uk, en, ru]) {
      const hint = hintOf(dict)
      expect(hint.note).not.toMatch(PROMISE)
      for (const key of ['phrase', 'example1', 'example2', 'example3', 'note']) {
        expect(hint[key], key).not.toMatch(SELF_AI)
      }
    }
  })
})
