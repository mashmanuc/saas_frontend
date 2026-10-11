/**
 * Інтегралик на лендінгу /start — ТЗ saas_docs/frontend/design-system/TZ_START_INTEGRALYK_HINTS_2026-10-11.md:
 * §1–§6 і §7 (рішення власника 2026-10-11 після перегляду: підказки ПО КОЛУ — ~6 с видно, ~6 с пауза,
 * наступна; фігурку можна перетягнути, як кнопку Інтегралика на дошці).
 *
 * Що перевіряємо: поява із затримкою; коло з п'яти підказок і паузи (панелька, прихована вкладка,
 * перетягування); reduced-motion — без анімацій, але зміна є; перетягування (поріг, межі, пам'ять, поворот,
 * бульбашка з вільного боку); тап → три приклади → кнопка реєстрації; ✕ панельки й ✕ фігурки; пам'ять у
 * сеансі (і без сховища); охорона кнопок лише на типовому місці; тексти; зіниці за курсором (миша/перо — так,
 * палець і reduced-motion — ні, поки тягнуть — ні, слухач і кадр знімаються).
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
/** Підказки по колу: 1–2 — помітніший перший рядок + приклад; 3–5 — один рядок. */
const hintsOf = (dict: unknown) => {
  const h = hintOf(dict)
  return [
    { lead: h.hintLead, text: h.hintTriangle },
    { lead: h.hintLead, text: h.hintCircle },
    { lead: '', text: h.hintCards },
    { lead: '', text: h.hintPhotoCheck },
    { lead: '', text: h.hintHelper },
  ]
}
const HINT_KEYS = ['hintLead', 'hintTriangle', 'hintCircle', 'hintCards', 'hintPhotoCheck', 'hintHelper']
const UK = hintOf(uk)
const UK_HINTS = hintsOf(uk)
const HIDDEN_KEY = 'm4sh:landing-integralyk-hidden'
const POS_KEY = 'm4sh:landing-integralyk-pos'

const BUBBLE = '[data-test="integralyk-bubble"]'
const FIGURE = '[data-test="integralyk-figure"]'
const PANEL = '[data-test="integralyk-panel"]'
const ROOT = '[data-test="landing-integralyk"]'
const LIVE = '[data-test="integralyk-live"]'

let wrapper: VueWrapper | null = null

/** Що зараз у бульбашці: перший рядок (якщо є) і текст. */
function bubbleHint(w: VueWrapper) {
  const b = w.find(BUBBLE)
  const lead = b.find('.lih-bubble-lead')
  return { lead: lead.exists() ? lead.text() : '', text: b.find('.lih-bubble-text').text() }
}
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

function setViewport(width: number, height: number) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true, writable: true })
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true, writable: true })
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

/** Перетягнути фігурку: натиснути, провести на (dx, dy), відпустити й «клікнути», як робить браузер. */
async function dragFigure(w: VueWrapper, dx: number, dy: number, { release = true } = {}) {
  const figure = w.find(FIGURE)
  await figure.trigger('pointerdown', { clientX: 330, clientY: 620, pointerId: 1, pointerType: 'mouse', button: 0 })
  await figure.trigger('pointermove', { clientX: 330 + dx, clientY: 620 + dy, pointerId: 1, pointerType: 'mouse' })
  if (release) {
    await figure.trigger('pointerup', { clientX: 330 + dx, clientY: 620 + dy, pointerId: 1, pointerType: 'mouse' })
    await figure.trigger('click')
  }
  await settle()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(trackIntegralykTap).mockClear()
  sessionStorage.clear()
  localStorage.clear()
  setReducedMotion(false)
  Object.defineProperty(window, 'scrollY', { value: 0, configurable: true, writable: true })
  setViewport(375, 667)
  // Типове місце на телефоні 375×667: фігурка 56 px у правому нижньому куті.
  rects = { 'integralyk-figure': rect(303, 595, 56, 56) }
  // Розміри «чесні» щодо стилю: переставлена фігурка стоїть там, куди її поставив застосований
  // left/top, а бульбашка — там, куди її поставив її власний left/top відносно фігурки. Тож тест
  // бачить те саме, що браузер, лише ПІСЛЯ оновлення DOM (міряти раніше — помилка, яку це й ловить).
  const px = (v: string) => Number.parseFloat(v || '0') || 0
  const rootRect = (el: HTMLElement | null) => (el?.style.left
    ? rect(px(el.style.left), px(el.style.top), 56, 56)
    : rects['landing-integralyk'] ?? rect(0, 0, 0, 0))
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const el = this as HTMLElement
    if (el.classList.contains('guard')) return rects.guard ?? rect(0, 0, 0, 0)
    const key = el.dataset?.test
    if (key === 'landing-integralyk') return rootRect(el)
    if (key === 'integralyk-bubble' && rects['integralyk-bubble']) {
      const root = rootRect(el.closest(ROOT) as HTMLElement | null)
      const size = rects['integralyk-bubble']
      return rect(root.left + px(el.style.left), root.top + px(el.style.top), size.width, size.height)
    }
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
  it('до ~2 с нічого, потім фігурка й перша підказка', async () => {
    const { w } = mountHint()
    await advance(1900)
    expect(w.find(FIGURE).exists()).toBe(false)
    expect(w.find(BUBBLE).exists()).toBe(false)
    await advance(100)
    expect(w.find(FIGURE).exists()).toBe(true)
    const bubble = w.find(BUBBLE)
    expect(bubble.exists()).toBe(true)
    expect(bubbleHint(w)).toEqual(UK_HINTS[0])
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

  it('фігурка — кнопка з підписом, підказка — у живій області для читалки', async () => {
    const { w } = mountHint()
    expect(w.find(LIVE).attributes('aria-live')).toBe('polite') // область є ще до появи
    await advance(2000)
    const figure = w.find(FIGURE)
    expect(figure.element.tagName).toBe('BUTTON')
    expect(figure.attributes('aria-label')).toBe(UK.openLabel)
    expect(figure.attributes('aria-expanded')).toBe('false')
    expect(w.find(LIVE).find(BUBBLE).exists()).toBe(true)
    expect(w.find('[data-test="integralyk-hide"]').element.tagName).toBe('BUTTON')
  })
})

describe('підказки по колу (§7)', () => {
  it('п\'ять підказок по черзі: ~6 с видно, ~6 с пауза; після п\'ятої — знову перша', async () => {
    const { w } = await mountShown()
    const seen: Array<{ lead: string; text: string }> = []
    for (let round = 0; round < 6; round++) {
      expect(w.find(BUBBLE).exists()).toBe(true)
      seen.push(bubbleHint(w))
      await advance(5900)
      expect(w.find(BUBBLE).exists(), `підказка ${round + 1} ще видна на 5,9 с`).toBe(true)
      await advance(100)
      expect(w.find(BUBBLE).exists(), `підказка ${round + 1} сховалась на 6 с`).toBe(false)
      await advance(5900)
      expect(w.find(BUBBLE).exists(), 'пауза ще триває').toBe(false)
      await advance(100)
    }
    expect(seen).toEqual([...UK_HINTS, UK_HINTS[0]])
  })

  it('відкрита панелька — коло стоїть; закрили — пауза ~6 с і наступна підказка', async () => {
    const { w } = await mountShown()
    await w.find(FIGURE).trigger('click')
    await settle()
    await advance(60_000)
    expect(w.find(PANEL).exists()).toBe(true)
    expect(w.find(BUBBLE).exists()).toBe(false)
    await w.find('[data-test="integralyk-panel-close"]').trigger('click')
    await settle()
    await advance(5900)
    expect(w.find(BUBBLE).exists()).toBe(false)
    await advance(100)
    expect(bubbleHint(w)).toEqual(UK_HINTS[1])
  })

  it('вкладку сховано — коло стоїть', async () => {
    const { w } = await mountShown()
    await advance(3000)
    setVisibility('hidden')
    await advance(30_000)
    expect(bubbleHint(w)).toEqual(UK_HINTS[0])
    setVisibility('visible')
    await advance(2900)
    expect(w.find(BUBBLE).exists()).toBe(true)
    await advance(100)
    expect(w.find(BUBBLE).exists()).toBe(false)
  })

  it('фігурку тягнуть — коло стоїть; відпустили — іде далі', async () => {
    const { w } = await mountShown()
    await advance(3000)
    await dragFigure(w, -40, -40, { release: false })
    await advance(30_000)
    expect(bubbleHint(w)).toEqual(UK_HINTS[0])
    await w.find(FIGURE).trigger('pointerup', { pointerId: 1, pointerType: 'mouse' })
    await settle()
    await advance(2900)
    expect(w.find(BUBBLE).exists()).toBe(true)
    await advance(100)
    expect(w.find(BUBBLE).exists()).toBe(false)
  })

  it('прокрутка ховає поточну раніше (тремтіння пальця — ні), коло йде далі', async () => {
    const { w } = await mountShown()
    await scrollTo(30)
    expect(w.find(BUBBLE).exists()).toBe(true)
    await scrollTo(200)
    expect(w.find(BUBBLE).exists()).toBe(false)
    expect(w.find(FIGURE).exists()).toBe(true)
    await advance(6000)
    expect(bubbleHint(w)).toEqual(UK_HINTS[1])
  })

  it('читалка чує кожну підказку один раз: після першого кола жива область замовкає', async () => {
    const { w } = await mountShown()
    for (let i = 0; i < 4; i++) {
      expect(w.find(LIVE).attributes('aria-live')).toBe('polite')
      await advance(12_000)
    }
    expect(bubbleHint(w)).toEqual(UK_HINTS[4])
    expect(w.find(LIVE).attributes('aria-live')).toBe('polite') // п'яту ще оголошено
    await advance(6000)
    expect(w.find(LIVE).attributes('aria-live')).toBe('off')
    await advance(6000)
    expect(bubbleHint(w)).toEqual(UK_HINTS[0]) // коло триває — лише мовчки
  })

  it('у перекладах п\'ять різних підказок, окремої «єдиної фрази» й старих hint1…5 немає', () => {
    for (const dict of [uk, en, ru]) {
      const hints = hintsOf(dict)
      expect(hints.every((h) => typeof h.text === 'string' && h.text.trim() !== '')).toBe(true)
      expect(new Set(hints.map((h) => `${h.lead}|${h.text}`)).size).toBe(5)
      expect(hintOf(dict).phrase).toBeUndefined()
      expect(hintOf(dict).hint1).toBeUndefined()
    }
  })

  it('підказки 1–2: перший рядок помітніший (жирний), другий — приклад звичайним; 3–5 — без нього', async () => {
    const { w } = await mountShown()
    const lead = w.find(`${BUBBLE} .lih-bubble-lead`)
    expect(lead.element.tagName).toBe('STRONG')
    expect(lead.text()).toBe(UK.hintLead)
    expect(w.find(`${BUBBLE} .lih-bubble-text`).text()).toBe(UK.hintTriangle)
    const style = hintSource.slice(hintSource.indexOf('<style'))
    expect(style).toMatch(/\.lih-bubble-lead \{[^}]*display: block;[^}]*font-weight: 600;/)
    for (let i = 0; i < 4; i++) await advance(6000) // третя (кроками: між підказками — nextTick)
    expect(w.find(`${BUBBLE} .lih-bubble-lead`).exists()).toBe(false)
    expect(bubbleHint(w)).toEqual({ lead: '', text: UK.hintCards })
  })
})

describe('мова — поточна мова сторінки', () => {
  it('en з першого кадру; змінили на ru — підказка й панелька одразу російською', async () => {
    const { w, i18n } = await mountShown('en')
    expect(bubbleHint(w)).toEqual(hintsOf(en)[0])
    i18n.global.locale.value = 'ru'
    await settle()
    expect(bubbleHint(w)).toEqual(hintsOf(ru)[0])
    await w.find(FIGURE).trigger('click')
    const items = w.findAll(`${PANEL} li`).map((li) => li.text())
    expect(items).toEqual([hintOf(ru).example1, hintOf(ru).example2, hintOf(ru).example3])
    expect(w.find('.lih-panel-title').text()).toBe(hintOf(ru).hintLead)
    expect(w.find('[data-test="integralyk-cta"]').text()).toBe(ctaOf(ru))
  })
})

describe('перетягування (§7, як на дошці)', () => {
  it('пальцем тягнуть фігурку, а не прокручують сторінку (touch-action: none, як на дошці)', () => {
    const style = hintSource.slice(hintSource.indexOf('<style'))
    const figureRule = style.slice(style.indexOf('.lih-figure {'), style.indexOf('}', style.indexOf('.lih-figure {')))
    expect(figureRule).toMatch(/touch-action:\s*none/)
  })

  it('короткий дотик без руху (менше 5 px) — панелька, місце не змінюється', async () => {
    const { w } = await mountShown()
    await dragFigure(w, 3, 2)
    expect(w.find(PANEL).exists()).toBe(true)
    expect(w.find(ROOT).attributes('style') ?? '').not.toContain('left')
    expect(localStorage.getItem(POS_KEY)).toBeNull()
  })

  it('перетягнули — фігурка там, місце запам\'ятовано, панелька НЕ відкрилась', async () => {
    const { w } = await mountShown()
    await dragFigure(w, -200, -400)
    const style = w.find(ROOT).attributes('style') ?? ''
    expect(style).toContain('left: 103px')
    expect(style).toContain('top: 195px')
    expect(style).toContain('bottom: auto')
    expect(JSON.parse(localStorage.getItem(POS_KEY) || 'null')).toEqual({ x: 103, y: 195 })
    expect(w.find(PANEL).exists()).toBe(false)
    expect(trackIntegralykTap).not.toHaveBeenCalled()
  })

  it('за край екрана не виходить (запас 10 px під ✕ фігурки)', async () => {
    const { w } = await mountShown()
    await dragFigure(w, -5000, -5000)
    expect(JSON.parse(localStorage.getItem(POS_KEY) || 'null')).toEqual({ x: 10, y: 10 })
    await dragFigure(w, 5000, 5000)
    // Розмір — з кореня фігурки: уже переставлена, 56 px (на типовому місці в тесті без розміру → запасні 64).
    expect(JSON.parse(localStorage.getItem(POS_KEY) || 'null')).toEqual({ x: 375 - 56 - 10, y: 667 - 56 - 10 })
  })

  it('місце відновлюється після перезавантаження; зіпсований запис — типове місце', async () => {
    localStorage.setItem(POS_KEY, JSON.stringify({ x: 50, y: 60 }))
    const first = mountHint().w
    await settle()
    const style = first.find(ROOT).attributes('style') ?? ''
    expect(style).toContain('left: 50px')
    expect(style).toContain('top: 60px')
    first.unmount()
    wrapper = null

    localStorage.setItem(POS_KEY, 'зіпсовано')
    const second = mountHint().w
    await settle()
    expect(second.find(ROOT).attributes('style') ?? '').not.toContain('left')
  })

  it('поворот екрана — фігурка повертається в межі', async () => {
    localStorage.setItem(POS_KEY, JSON.stringify({ x: 290, y: 580 }))
    const { w } = await mountShown()
    setViewport(320, 500)
    window.dispatchEvent(new Event('resize'))
    await settle()
    const style = w.find(ROOT).attributes('style') ?? ''
    expect(style).toContain(`left: ${320 - 56 - 10}px`)
    expect(style).toContain(`top: ${500 - 56 - 10}px`)
  })

  it('сховище заборонене — тягнеться й відкривається, нічого не падає', async () => {
    const own = Object.getOwnPropertyDescriptor(window, 'localStorage')
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() { throw new DOMException('denied', 'SecurityError') },
    })
    try {
      expect(() => window.localStorage).toThrow()
      const { w } = await mountShown()
      await dragFigure(w, -100, -100)
      expect(w.find(ROOT).attributes('style') ?? '').toContain('left: 203px')
      await dragFigure(w, 0, 0)
      expect(w.find(PANEL).exists()).toBe(true)
    } finally {
      if (own) Object.defineProperty(window, 'localStorage', own)
      else delete (window as { localStorage?: Storage }).localStorage
    }
  })

  it('бульбашка їде з фігуркою і стає з того боку, де є місце', async () => {
    rects['landing-integralyk'] = rect(303, 595, 56, 56)
    rects['integralyk-bubble'] = rect(0, 0, 260, 60)
    const { w } = await mountShown()
    // Типове місце, правий нижній кут: бульбашка зверху, вирівняна по правому краю фігурки.
    let root = w.find(ROOT)
    expect(root.classes()).toEqual(expect.arrayContaining(['lih--up', 'lih--right']))
    let style = w.find(BUBBLE).attributes('style') ?? ''
    expect(style).toContain('top: -74px') // 60 + 14 над фігуркою
    expect(style).toContain(`left: ${359 - 260 - 303}px`)

    // Перетягнули в лівий верхній кут: бульбашка знизу, вирівняна по лівому краю.
    await dragFigure(w, -293, -585, { release: false })
    root = w.find(ROOT)
    expect(root.classes()).toEqual(expect.arrayContaining(['lih--down', 'lih--left']))
    style = w.find(BUBBLE).attributes('style') ?? ''
    expect(style).toContain('top: 70px') // 56 + 14 під фігуркою
    expect(style).toContain('left: 0px')
  })

  it('фігурка у верхній половині — бульбашка під нею, навіть якщо зверху вмістилась би (там шапка сторінки)', async () => {
    setViewport(1366, 768)
    rects['integralyk-bubble'] = rect(0, 0, 300, 85)
    localStorage.setItem(POS_KEY, JSON.stringify({ x: 28, y: 160 }))
    const { w } = await mountShown()
    expect(w.find(ROOT).classes()).toEqual(expect.arrayContaining(['lih--down', 'lih--left']))
    expect(w.find(BUBBLE).attributes('style') ?? '').toContain('top: 70px')
  })

  it('бульбашка не вилазить за край екрана, навіть коли фігурка посередині', async () => {
    rects['landing-integralyk'] = rect(160, 300, 56, 56) // центр 188 > 187,5 → вирівнювання праворуч
    rects['integralyk-bubble'] = rect(0, 0, 260, 60)
    localStorage.setItem(POS_KEY, JSON.stringify({ x: 160, y: 300 }))
    const { w } = await mountShown()
    const style = w.find(BUBBLE).attributes('style') ?? ''
    // Праворуч від фігурки 216 − 260 = −44 → не лівіше за 8 px від краю: 8 − 160 = −152.
    expect(style).toContain('left: -152px')
  })
})

describe('торкання → панелька', () => {
  it('фігурка: три приклади результату, кнопка реєстрації, підпис; бульбашка ховається; подія воронки', async () => {
    const { w } = await mountShown()
    expect(w.find(PANEL).exists()).toBe(false) // приклади — лише після торкання
    await w.find(FIGURE).trigger('click')
    await settle()
    const panel = w.find(PANEL)
    expect(panel.exists()).toBe(true)
    expect(panel.find('.lih-panel-title').text()).toBe(UK.hintLead)
    expect(panel.findAll('li').map((li) => li.text())).toEqual([UK.example1, UK.example2, UK.example3])
    expect(panel.find('[data-test="integralyk-cta"]').text()).toBe(ctaOf(uk))
    expect(panel.find('.lih-note').text()).toBe(UK.note)
    expect(w.find(BUBBLE).exists()).toBe(false)
    expect(w.find(FIGURE).attributes('aria-expanded')).toBe('true')
    expect(w.find(FIGURE).attributes('aria-controls')).toBe(panel.attributes('id'))
    expect(trackIntegralykTap).toHaveBeenCalledTimes(1)
  })

  it('підказка теж відкриває панельку', async () => {
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
    expect(imports.sort()).toEqual([
      '@/composables/useDraggableFab', '@/modules/intent/integralykMascotSvg', '@/utils/siteVisit', 'vue', 'vue-i18n',
    ])
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
  it('без анімацій, але підказки змінюються (§7)', async () => {
    setReducedMotion(true)
    const { w } = await mountShown()
    const root = w.find(ROOT)
    expect(root.attributes('data-motion')).toBe('reduce')
    expect(root.classes()).toContain('lih--still')
    expect(bubbleHint(w)).toEqual(UK_HINTS[0])
    await advance(12_000)
    expect(bubbleHint(w)).toEqual(UK_HINTS[1])
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

describe('зіниці за курсором (на комп\'ютері — як у палітри на дошці)', () => {
  /** Кадри rAF — вручну: видно, скільки їх замовлено і коли саме зіниці зрушують. */
  let frames: Map<number, FrameRequestCallback>
  let lastFrameId: number

  beforeEach(() => {
    frames = new Map()
    lastFrameId = 0
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      lastFrameId += 1
      frames.set(lastFrameId, cb)
      return lastFrameId
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
  })

  function flushFrames() {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((cb) => cb(0))
  }

  function moveCursor(clientX: number, clientY: number, pointerType = 'mouse') {
    window.dispatchEvent(new PointerEvent('pointermove', { clientX, clientY, pointerType }))
  }

  /** Зсув кожної зіниці `[x, y]`; `null` — зіниця на місці (transform не ставили). */
  function pupilShifts(w: VueWrapper) {
    const pupils = w.findAll(`${FIGURE} .itg-pupil`)
    expect(pupils).toHaveLength(2) // малюнок лендінгу має обидві «живі» зіниці
    return pupils.map((p) => {
      const t = (p.element as SVGElement).style.transform
      const m = t.match(/translate\((-?[\d.]+)px,\s*(-?[\d.]+)px\)/)
      return m ? [Number(m[1]), Number(m[2])] : null
    })
  }

  function expectLooking(w: VueWrapper, x: number, y: number) {
    for (const shift of pupilShifts(w)) {
      expect(shift).not.toBeNull()
      expect(shift![0]).toBeCloseTo(x, 2)
      expect(shift![1]).toBeCloseTo(y, 2)
    }
  }

  // Фігурка на телефоні 375×667 стоїть у (303, 595) розміром 56 — центр (331, 623).
  it('мишею: обидві зіниці дивляться в бік курсора відносно центру фігурки', async () => {
    const { w } = await mountShown()
    expect(pupilShifts(w)).toEqual([null, null]) // до руху — по центру ока
    moveCursor(1000, 623) // праворуч
    flushFrames()
    expectLooking(w, 2.6, 0)
    moveCursor(331, 0) // угору
    flushFrames()
    expectLooking(w, 0, -2.6)
    moveCursor(0, 292) // уліво-вгору під 45°: від центру фігурки, а не від кута екрана
    flushFrames()
    expectLooking(w, -1.84, -1.84)
  })

  it('перо графічного планшета — теж курсор: зіниці стежать', async () => {
    const { w } = await mountShown()
    moveCursor(331, 1000, 'pen') // донизу
    flushFrames()
    expectLooking(w, 0, 2.6)
  })

  it('багато рухів за кадр — один rAF, зіниці за останнім положенням', async () => {
    const { w } = await mountShown()
    vi.mocked(window.requestAnimationFrame).mockClear()
    moveCursor(1000, 623)
    moveCursor(331, 0)
    moveCursor(0, 623)
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)
    flushFrames()
    expectLooking(w, -2.6, 0)
    moveCursor(1000, 623) // кадр відпрацював — наступний рух замовляє новий
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2)
  })

  it('палець — зіниці на місці (ні pointermove від дотику, ні «мишачий» mousemove після тапу)', async () => {
    const { w } = await mountShown()
    vi.mocked(window.requestAnimationFrame).mockClear()
    moveCursor(1000, 623, 'touch')
    window.dispatchEvent(new MouseEvent('mousemove', { clientX: 1000, clientY: 623 }))
    flushFrames()
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(pupilShifts(w)).toEqual([null, null])
  })

  it('prefers-reduced-motion — зіниці не рухаються', async () => {
    setReducedMotion(true)
    const { w } = await mountShown()
    moveCursor(1000, 623)
    flushFrames()
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
    expect(pupilShifts(w)).toEqual([null, null])
  })

  it('поки фігурку тягнуть — зіниці стоять; відпустили — знову стежать', async () => {
    const { w } = await mountShown()
    await dragFigure(w, -40, -40, { release: false }) // рух по фігурці теж доходить до window
    moveCursor(1000, 623)
    flushFrames()
    expect(pupilShifts(w)).toEqual([null, null])
    await w.find(FIGURE).trigger('pointerup', { pointerId: 1, pointerType: 'mouse' })
    await settle()
    moveCursor(1000, 623)
    flushFrames()
    expectLooking(w, 2.6, 0)
  })

  it('демонтаж: замовлений кадр скасовано, слухача курсора більше немає', async () => {
    const { w } = await mountShown()
    moveCursor(1000, 623) // кадр замовлено, ще не настав
    const pending = vi.mocked(window.requestAnimationFrame).mock.results[0].value as number
    w.unmount()
    wrapper = null
    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(pending)
    vi.mocked(window.requestAnimationFrame).mockClear()
    moveCursor(0, 0)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })

  it('✕ на фігурці — слухача курсора теж знято', async () => {
    const { w } = await mountShown()
    await w.find('[data-test="integralyk-hide"]').trigger('click')
    vi.mocked(window.requestAnimationFrame).mockClear()
    moveCursor(1000, 623)
    expect(window.requestAnimationFrame).not.toHaveBeenCalled()
  })
})

describe('не закриває кнопки першого екрана (§3) — на типовому місці', () => {
  function addGuard() {
    const el = document.createElement('button')
    el.className = 'guard'
    document.body.appendChild(el)
  }

  it('бульбашка лягла б на кнопку — чекає прокрутки нижче першого екрана', async () => {
    addGuard()
    // Телефон 375×667: кнопка зліва внизу першого екрана, фігурка в куті справа — не перетинаються,
    // а бульбашка над фігуркою лягла б на кнопку.
    rects.guard = rect(16, 520, 250, 50)
    rects['landing-integralyk'] = rect(303, 595, 56, 56)
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
    rects['landing-integralyk'] = rect(303, 595, 56, 56)
    const { w } = await mountShown()
    expect(w.find(ROOT).classes()).toContain('lih--aside')
    expect(w.find(BUBBLE).exists()).toBe(false) // і бульбашка не виринає над схованою фігуркою

    rects.guard = rect(280, 300, 90, 50)
    await scrollTo(300)
    expect(w.find(ROOT).classes()).not.toContain('lih--aside')
  })

  it('відкриту панельку людина відкрила сама — фігурку під нею не ховаємо', async () => {
    addGuard()
    const { w } = await mountShown()
    await w.find(FIGURE).trigger('click')
    rects.guard = rect(280, 600, 90, 50)
    rects['landing-integralyk'] = rect(303, 595, 56, 56)
    await scrollTo(10)
    expect(w.find(ROOT).classes()).not.toContain('lih--aside')
  })

  it('переставлена фігурка — її вибір: охорона не діє ні на фігурку, ні на бульбашку (§7)', async () => {
    addGuard()
    localStorage.setItem(POS_KEY, JSON.stringify({ x: 200, y: 500 }))
    rects.guard = rect(150, 450, 200, 200)
    rects['landing-integralyk'] = rect(200, 500, 56, 56)
    rects['integralyk-bubble'] = rect(0, 0, 200, 60)
    const { w } = await mountShown()
    expect(w.find(ROOT).classes()).not.toContain('lih--aside')
    expect(w.find(BUBBLE).exists()).toBe(true)
  })

  it('відклали через кнопку, а людина переставила фігурку — підказка з\'являється', async () => {
    addGuard()
    rects.guard = rect(16, 520, 250, 50)
    rects['landing-integralyk'] = rect(303, 595, 56, 56)
    rects['integralyk-bubble'] = rect(97, 527, 262, 60)
    const { w } = await mountShown()
    expect(w.find(BUBBLE).exists()).toBe(false)
    await dragFigure(w, -20, -300)
    expect(w.find(BUBBLE).exists()).toBe(true)
  })
})

describe('тексти (§2, §7)', () => {
  it('uk — дослівно з ТЗ', () => {
    // Тексти від власника 2026-10-11 (через Фею), замість п'яти з §7.
    expect(UK.hintLead).toBe('Я будую на дошці те, що ви скажете')
    expect(UK.hintTriangle).toBe('Прямокутний трикутник із підписами — за секунду')
    expect(UK.hintCircle).toBe('Коло навколо трикутника і правило до нього — поруч')
    expect(UK.hintCards).toBe('Я можу додавати на дошку картки, таблиці, графіки й фото — за запитом')
    // Відео Інтегралик не вставляє (лише пульт) — у підказках його немає жодною мовою.
    for (const dict of [uk, en, ru]) expect(hintOf(dict).hintCards).not.toMatch(/відео|video|видео/i)
    expect(UK.hintPhotoCheck).toBe("Перевірю розв'язання з фото зошита")
    expect(UK.hintHelper).toBe('Хочете, я працюватиму на вашому уроці помічником?')
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
    // «помічником» у підказці 5 — слово власника; заборонене — самопредставлення «я ШІ…» і команди.
    const SELF_AI = /ШІ|\bAI\b|\bИИ\b|Скажіть|Say:|Скажите|додай|add a|добавь/i
    for (const dict of [uk, en, ru]) {
      const hint = hintOf(dict)
      expect(hint.note).not.toMatch(PROMISE)
      for (const key of [...HINT_KEYS, 'example1', 'example2', 'example3', 'note']) {
        expect(hint[key], key).not.toMatch(SELF_AI)
      }
    }
  })
})
