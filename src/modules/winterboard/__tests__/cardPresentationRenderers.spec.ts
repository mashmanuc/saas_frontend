/**
 * TLV2-05C · змонтовані картки: авто-висота без обрізання й спільний масштаб тексту.
 *
 * ЧОМУ ЦЕЙ ТЕСТ ІСНУЄ
 *
 * На живій пілотній дошці теорія обрізала текст: власна підгонка після будь-якої
 * зовнішньої зміни розміру назавжди вимикалась, а тіло лишалось без прокрутки.
 * У задачі A−/A+ масштабувало лише розбір і жило локально. Тут — змонтовані картки,
 * а не пошук рядків: що вони просять, що малюють і чого не роблять.
 *
 * Layout у happy-dom не рахується — геометрію задаємо руками, а висоту потоку робимо
 * залежною від масштабу, як у справжньому браузері.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import TheoryCardRenderer from '../components/board/objects/TheoryCardRenderer.vue'
import NmtTaskRenderer from '../components/board/objects/NmtTaskRenderer.vue'
import { provideHostWindowControls } from '../composables/boardWindowControls'
import { resetNmtPresentationScales, setNmtPresentationScale } from '../composables/useNmtPresentationScale'
import { nextAutoFitHeight } from '../composables/autoFitHeight'
import { cardWindowActions, NO_WINDOW_ACTIONS } from '../board/windowActions'
import type { WBAsset } from '../types/winterboard'

vi.mock('@/utils/media', () => ({ resolveMediaUrl: (u: string) => u }))
vi.mock('../../../composables/useStudentTutor', () => ({
  useTutorRevealGate: () => ({ value: true }),
}))
vi.mock('../composables/useTaskTopicFix', () => ({
  useTaskTopicFix: () => ({
    canFix: { value: false }, open: { value: false }, loading: { value: false },
    saving: { value: false }, error: { value: '' }, current: { value: null },
    suggestions: { value: [] }, allTopics: { value: [] },
    showAll: { value: false }, done: { value: '' },
    toggle: () => {}, apply: () => {}, reject: () => {}, load: () => {},
  }),
}))

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(resolve(SRC, rel), 'utf-8').replace(/\r\n/g, '\n')
const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

/** Висота потоку ∝ масштабу, прочитаному з кореня картки — як у браузері. */
function stubLayout(w: VueWrapper, sel: { root: string; body: string; flow: string }, geo: {
  cardH: number; bodyClientH: number; flowAt100: number; scaleVar: string
}) {
  const root = w.find(sel.root).element as HTMLElement
  const body = w.find(sel.body).element as HTMLElement
  const flow = w.find(sel.flow).element as HTMLElement
  Object.defineProperty(root, 'offsetHeight', { get: () => geo.cardH, configurable: true })
  Object.defineProperty(body, 'clientHeight', { get: () => geo.bodyClientH, configurable: true })
  flow.getBoundingClientRect = () => {
    const scale = parseFloat(root.style.getPropertyValue(geo.scaleVar)) || 1
    return { height: geo.flowAt100 * scale } as DOMRect
  }
  return geo
}

const lastRequest = (w: VueWrapper) => {
  const all = w.emitted('request-height') as number[][] | undefined
  return all?.[all.length - 1]?.[0]
}

afterEach(() => resetNmtPresentationScales())

// ─── Теорія ─────────────────────────────────────────────────────────────────

function theoryAsset(extra: Record<string, unknown> = {}, data: Record<string, unknown> = {}): WBAsset {
  return {
    id: 'th1', type: 'theory_card', src: '', x: 100, y: 100, w: 520, h: 300, rotation: 0, locked: false,
    data: {
      version: 1, title: 'Порядок букв задає пари', body: 'Трикутники називають рівними, якщо...',
      hint: 'Пари визначає порядок букв у записі', formulaTitle: 'Коротко',
      formulas: [{ latex: 'AB = DE', label: 'сторони' }], ...data,
    },
    ...extra,
  } as unknown as WBAsset
}

function mountTheory(props: Record<string, unknown> = {}) {
  const w = mount(TheoryCardRenderer, {
    props: { asset: theoryAsset(), isSelected: true, interactive: true, ...props },
    global: { plugins: [i18n()] },
  })
  const geo = stubLayout(w, { root: '.theory-card', body: '.theory-card__body', flow: '.theory-card__flow' },
    { cardH: 300, bodyClientH: 240, flowAt100: 500, scaleVar: '--wb-card-text-scale' })
  return { w, geo }
}

describe('theory_card · весь текст, без обрізання', () => {
  it('рендерить заголовок, текст, підказку й формули та просить висоту під увесь вміст', async () => {
    const { w, geo } = mountTheory()
    await flushPromises()
    for (const text of ['Порядок букв задає пари', 'Трикутники називають рівними', 'Пари визначає порядок букв', 'Коротко', 'сторони']) {
      expect(w.text()).toContain(text)
    }
    // шапка й рамка (cardH − bodyClientH) + потік; паддинги scoped-стилю в happy-dom = 0
    expect(lastRequest(w)).toBe(geo.cardH - geo.bodyClientH + geo.flowAt100)
    w.unmount()
  })

  it('тіло прокручується (auto), а не ріже текст (hidden)', () => {
    const src = read('modules/winterboard/components/board/objects/TheoryCardRenderer.vue')
    const bodyRule = src.match(/\n\.theory-card__body \{[^}]*\}/)?.[0] ?? ''
    expect(bodyRule).toContain('overflow-y: auto')
    expect(src).not.toMatch(/overflow-y:\s*hidden/)
  })

  it('власної підгонки розміру в теорії більше немає', () => {
    const src = read('modules/winterboard/components/board/objects/TheoryCardRenderer.vue')
    for (const gone of ['tryFit(', 'userResized', 'lastAutoSize', 'measureContent', 'SHRINK_EPS']) {
      expect(src, gone).not.toContain(gone)
    }
    expect(src).toContain('useCardContentFit({')
  })
})

describe('theory_card · A+ збільшує і текст, і висоту', () => {
  it('масштаб 1.3 → змінна кореня 1.3 і більший запит висоти', async () => {
    const { w, geo } = mountTheory()
    await flushPromises()
    const at100 = lastRequest(w)!
    expect((w.find('.theory-card').element as HTMLElement).style.getPropertyValue('--wb-card-text-scale')).toBe('1')

    await w.setProps({ asset: theoryAsset({}, { presentationScale: 1.3 }) })
    await flushPromises()
    expect((w.find('.theory-card').element as HTMLElement).style.getPropertyValue('--wb-card-text-scale')).toBe('1.3')
    expect(lastRequest(w)).toBe(geo.cardH - geo.bodyClientH + Math.ceil(geo.flowAt100 * 1.3))
    expect(lastRequest(w)!).toBeGreaterThan(at100)
    w.unmount()
  })

  it('уся типографіка теорії масштабується однією змінною', () => {
    const src = read('modules/winterboard/components/board/objects/TheoryCardRenderer.vue')
    for (const cls of ['__title', '__text {', '__hint {', '__formula-title', '__formula-latex', '__formula-label', '__badge']) {
      const at = src.indexOf(`.theory-card${cls}`)
      const rule = src.slice(at, src.indexOf('}', at))
      expect(rule, cls).toContain('var(--wb-card-text-scale, 1)')
    }
  })
})

describe('theory_card · ручний resize не вимикає безпеку', () => {
  it('після ручної зміни розміру картка й далі міряє та просить висоту', async () => {
    const { w } = mountTheory({ asset: theoryAsset({ h: 300 }) })
    await flushPromises()
    const before = (w.emitted('request-height') ?? []).length
    await w.setProps({ asset: theoryAsset({ h: 180, w: 400 }) })   // «рука» змінила розмір
    await flushPromises()
    expect((w.emitted('request-height') ?? []).length).toBeGreaterThan(before)
    await w.setProps({ asset: theoryAsset({ h: 180, w: 400 }, { body: 'Новий довший текст '.repeat(20) }) })
    await flushPromises()
    expect((w.emitted('request-height') ?? []).length).toBeGreaterThan(before + 1)
    w.unmount()
  })

  it('ручну висоту не стискає, для більшого вмісту — збільшує; на межі сторінки — стоп і скрол', () => {
    // ручна висота 700 (autoFitH інший) — вмісту треба 400: не стискати
    expect(nextAutoFitHeight({ neededPx: 400, zoom: 1, y: 100, h: 700, pageH: 1080, lastAutoH: 300 })).toBeNull()
    // тій самій ручній картці вмісту треба 900 → зросте
    expect(nextAutoFitHeight({ neededPx: 900, zoom: 1, y: 100, h: 700, pageH: 1080, lastAutoH: 300 })).toBe(900)
    // біля низу: y=900, сторінка 1080 → більше 180 не буде; решту тексту дає скрол тіла
    expect(nextAutoFitHeight({ neededPx: 1500, zoom: 1, y: 900, h: 150, pageH: 1080, lastAutoH: 150 })).toBe(180)
  })
})

describe('theory_card · не міряється, коли не можна писати', () => {
  it('неінтерактивна (перо, учень) і згорнута — без запитів; відновлення з трею — повторний вимір', async () => {
    const { w } = mountTheory({ interactive: false })
    await flushPromises()
    expect(w.emitted('request-height')).toBeUndefined()

    await w.setProps({ interactive: true, asset: theoryAsset({ minimized: true }) })
    await flushPromises()
    expect(w.emitted('request-height')).toBeUndefined()

    await w.setProps({ asset: theoryAsset({ minimized: false }) })
    await flushPromises()
    expect((w.emitted('request-height') ?? []).length).toBe(1)
    w.unmount()
  })
})

// ─── Задача ─────────────────────────────────────────────────────────────────

function taskAsset(data: Record<string, unknown> = {}, extra: Record<string, unknown> = {}): WBAsset {
  return {
    id: 'q1', type: 'nmt_task', src: '', x: 0, y: 0, w: 600, h: 400, rotation: 0, locked: false,
    data: {
      version: 1, taskType: 'single_choice', showAnswer: false, showSolution: true,
      question: 'Знайдіть кут', solution: 'Розбір із відповіддю',
      options: [{ id: 'o1', letter: 'А', text: 'раз', isCorrect: true }], ...data,
    },
    ...extra,
  } as unknown as WBAsset
}

function mountTask(props: Record<string, unknown> = {}, hostControls: boolean | null = null) {
  const allProps = { asset: taskAsset(), isSelected: true, interactive: true, isTutor: true, ...props }
  if (hostControls === null) {
    return mount(NmtTaskRenderer, { props: allProps, global: { plugins: [i18n()], stubs: { teleport: true, WBStepInput: true } } })
  }
  const Host = defineComponent({
    props: { cardProps: { type: Object, required: true } },
    setup(p) {
      provideHostWindowControls(() => hostControls)
      return () => h(NmtTaskRenderer, p.cardProps as never)
    },
  })
  return mount(Host, { props: { cardProps: allProps }, global: { plugins: [i18n()], stubs: { teleport: true, WBStepInput: true } } })
}

const scaleVar = (w: VueWrapper) =>
  (w.find('.nmt-task').element as HTMLElement).style.getPropertyValue('--nmt-presentation-scale')

describe('nmt_task · масштабується вся задача, а не лише розбір', () => {
  it('data.presentationScale 1.3 → змінна кореня, від якої беруть розмір усі тексти', () => {
    const w = mountTask({ asset: taskAsset({ presentationScale: 1.3 }) })
    expect(scaleVar(w)).toBe('1.3')
    const src = read('modules/winterboard/components/board/objects/NmtTaskRenderer.vue')
    expect(src).toContain('--nmt-font-16: calc(16px * var(--nmt-presentation-scale, 1))')
    w.unmount()
  })

  it('режим стандарту: розбір = 13px × масштаб картки, власних A−/⟲/A+ розбору немає', () => {
    const w = mountTask({ asset: taskAsset({ presentationScale: 1.3 }) }, true)
    const text = w.find('.nmt-task__solution-text').element as HTMLElement
    expect(parseFloat(text.style.fontSize)).toBeCloseTo(13 * 1.3, 5)
    expect(w.find('.nmt-task__solution-zoom').exists()).toBe(false)
    w.unmount()
  })

  it('V1 (без стандарту): кнопки розбору на місці', () => {
    const w = mountTask({ asset: taskAsset() }, false)
    expect(w.find('.nmt-task__solution-zoom').exists()).toBe(true)
    w.unmount()
  })

  it('локальний множник пульта множиться на спільний масштаб, а не замінює його', () => {
    setNmtPresentationScale('q1', 1.25)
    const w = mountTask({ asset: taskAsset({ presentationScale: 1.3 }) })
    expect(parseFloat(scaleVar(w))).toBeCloseTo(1.625, 5)
    w.unmount()
  })

  it('fullscreen туди й назад: у fullscreen не міряє, після виходу — повторний вимір', async () => {
    const w = mountTask({ isExpanded: true })
    stubLayout(w, { root: '.nmt-task', body: '.nmt-task__body', flow: '.nmt-task__flow' },
      { cardH: 400, bodyClientH: 340, flowAt100: 300, scaleVar: '--nmt-presentation-scale' })
    await flushPromises()
    expect(w.emitted('request-height')).toBeUndefined()
    await w.setProps({ isExpanded: false })
    await flushPromises()
    expect((w.emitted('request-height') ?? []).length).toBe(1)
    w.unmount()
  })
})

// ─── Учень ──────────────────────────────────────────────────────────────────

describe('учень бачить учительський масштаб без кнопок', () => {
  it('теорія й задача з масштабом 1.5: змінні 1.5, запитів висоти немає, дій немає', async () => {
    const theory = mount(TheoryCardRenderer, {
      props: { asset: theoryAsset({}, { presentationScale: 1.5 }), isSelected: false, interactive: false },
      global: { plugins: [i18n()] },
    })
    const task = mountTask({ asset: taskAsset({ presentationScale: 1.5 }), interactive: false, isTutor: false }, true)
    await nextTick()
    await flushPromises()
    expect((theory.find('.theory-card').element as HTMLElement).style.getPropertyValue('--wb-card-text-scale')).toBe('1.5')
    expect(scaleVar(task)).toBe('1.5')
    expect(theory.emitted('request-height')).toBeUndefined()
    expect(task.findComponent(NmtTaskRenderer).emitted('request-height')).toBeUndefined()
    expect(task.find('.nmt-task__solution-zoom').exists()).toBe(false)
    for (const type of ['theory_card', 'nmt_task']) {
      expect(cardWindowActions({ id: 'x', type } as never, { isTutor: false, mode: 'edit' })).toEqual(NO_WINDOW_ACTIONS)
    }
    theory.unmount()
    task.unmount()
  })
})
