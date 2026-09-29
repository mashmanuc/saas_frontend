/**
 * Панель виразів калькулятора графіків «як у Desmos» (власник 2026-09-29, «так»):
 *   Enter — новий рядок під поточним і курсор у ньому; ↑/↓ — сусідній рядок; Backspace у порожньому
 *   рядку прибирає його; вставка кількох рядків — кілька формул; помилка рушія — під рядком.
 *
 * Міст — живий список (вставка/видалення/набір змінюють рядки, як справжня картка).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { reactive } from 'vue'

import uk from '../../../../../i18n/locales/uk.json'
import en from '../../../../../i18n/locales/en.json'
import GraphCalcInspector from '../../sidebar/GraphCalcInspector.vue'
import MathQuillField from '../../shared/MathQuillField.vue'
import {
  __resetGraphCalcInspectorForTests,
  registerGraphCalcInspector,
  type GcExprEntry,
  type GraphCalcInspectorBridge,
} from '../../../board/state/graphCalcInspectorState'
import { __resetMathQuillLoaderForTests } from '../../../utils/mathquillLoader'

function i18nPlugin(locale = 'uk') {
  return createI18n({ legacy: false, locale, fallbackLocale: 'uk', messages: { uk, en } as never })
}

function liveBridge(srcs: string[], errors: Record<number, string> = {}) {
  let n = 0
  const row = (src: string): GcExprEntry => ({ id: `e${++n}`, src, color: '#c00', hidden: false, isParam: false })
  const calls = { enter: [] as string[], blur: [] as string[], arrowNav: [] as Array<[string, number]> }
  const bridge: GraphCalcInspectorBridge = reactive({
    paramEntries: [], dragParamNames: [], paramFocus: null, paramExpanded: {},
    onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
    onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
    displayExpressions: srcs.map((src, i) => ({ ...row(src), ...(errors[i] ? { error: errors[i] } : {}) })),
    slashPopup: null,
    slashFilteredTemplates: [],
    onSrcInput(id: string, val: string) {
      const e = bridge.displayExpressions.find((x) => x.id === id)
      if (e) e.src = val
    },
    onInputBlur(id: string) { calls.blur.push(id) },
    onEnterPress(id: string) { calls.enter.push(id) },
    onArrowNav(id: string, d: 1 | -1) { calls.arrowNav.push([id, d]) },
    onToggleHidden: () => {},
    onRemoveExpression(id: string) {
      const i = bridge.displayExpressions.findIndex((x) => x.id === id)
      if (i !== -1) bridge.displayExpressions.splice(i, 1)
    },
    onAddExpression: () => {},
    onInsertExpressions(afterId: string, list: string[]) {
      const i = bridge.displayExpressions.findIndex((x) => x.id === afterId)
      const rows = list.map(row)
      bridge.displayExpressions.splice(i + 1, 0, ...rows)
      return rows.map((r) => r.id)
    },
    onQuickAdd: () => {}, applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
    isExpanded: false, toggleExpand: () => {},
  }) as GraphCalcInspectorBridge
  registerGraphCalcInspector('gc-desmos', bridge)
  return { bridge, calls }
}

let w: VueWrapper | null = null
function mountPanel(locale = 'uk') {
  w = mount(GraphCalcInspector, { attachTo: document.body, global: { plugins: [i18nPlugin(locale)] } })
  return w
}
const srcs = (b: GraphCalcInspectorBridge) => b.displayExpressions.map((e) => e.src)
const inputOf = (id: string) => document.querySelector<HTMLInputElement>(`input[data-expr-id="${id}"]`)

/** Клік по прев'ю рядка → поле вводу (без MathQuill — plain input). */
async function edit(i: number): Promise<HTMLInputElement> {
  const rows = w!.findAll('.gc-insp__expr-row')
  const preview = rows[i].find('.gc-insp__expr-preview')
  if (preview.exists()) await preview.trigger('click')
  await settle()
  const el = rows[i].find('.gc-insp__expr-input').element as HTMLInputElement
  el.focus()
  return el
}
// Перший startEdit чекає loadMathQuill — стан перевіряємо після ДВОХ циклів, інакше перемалювання
// після blur старого поля ще попереду і тест не бачить, що рядок згорнувся.
async function settle() {
  await flushPromises()
  await flushPromises()
}
async function key(el: HTMLElement, k: string) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }))
  await settle()
}
function paste(el: HTMLElement, text: string): Event {
  const e = new Event('paste', { bubbles: true, cancelable: true })
  Object.defineProperty(e, 'clipboardData', { value: { getData: () => text } })
  el.dispatchEvent(e)
  return e
}

beforeEach(() => {
  __resetGraphCalcInspectorForTests()
  __resetMathQuillLoaderForTests()
})
afterEach(() => {
  w?.unmount()
  w = null
  document.body.innerHTML = ''
})

describe('Enter — новий рядок під поточним', () => {
  it('з непорожнього рядка: порожній рядок ОДРАЗУ під ним, курсор у ньому, поточний закомічено', async () => {
    const { bridge, calls } = liveBridge(['y = x', 'y = 2x'])
    mountPanel()
    const el = await edit(0)
    await key(el, 'Enter')
    expect(srcs(bridge)).toEqual(['y = x', '', 'y = 2x'])
    expect(document.activeElement).toBe(inputOf(bridge.displayExpressions[1].id))
    expect(calls.enter).toEqual(['e1'])
    // старий рядок — знову прев'ю (його blur не зірвав редагування нового)
    expect(w!.findAll('.gc-insp__expr-row')[0].find('.gc-insp__expr-preview').exists()).toBe(true)
  })

  it('з порожнього рядка — нового не плодить', async () => {
    const { bridge } = liveBridge(['y = x', ''])
    mountPanel()
    const el = await edit(1)
    await key(el, 'Enter')
    expect(srcs(bridge)).toEqual(['y = x', ''])
  })

  it('наступний рядок уже порожній — курсор іде в нього, без нового', async () => {
    const { bridge } = liveBridge(['y = x', ''])
    mountPanel()
    const el = await edit(0)
    await key(el, 'Enter')
    expect(srcs(bridge)).toEqual(['y = x', ''])
    expect(document.activeElement).toBe(inputOf('e2'))
  })

  it('відкрите slash-меню: Enter — шаблон, без нового рядка', async () => {
    const { bridge, calls } = liveBridge(['/lin'])
    mountPanel()
    const el = await edit(0)
    bridge.slashPopup = { exprId: 'e1', query: 'lin', selectedIdx: 0 }
    await key(el, 'Enter')
    expect(calls.enter).toEqual(['e1'])
    expect(srcs(bridge)).toEqual(['/lin'])
  })
})

describe('↑/↓ — сусідній рядок', () => {
  it('↑ — рядок вище, курсор у КІНЦІ (не виділення всього); поточний закомічено', async () => {
    const { calls } = liveBridge(['y = x', 'y = 2x'])
    mountPanel()
    const el = await edit(1)
    await key(el, 'ArrowUp')
    const up = inputOf('e1')!
    expect(document.activeElement).toBe(up)
    expect([up.selectionStart, up.selectionEnd]).toEqual([5, 5])
    expect(calls.blur).toContain('e2')
  })

  it('↓ — рядок нижче', async () => {
    liveBridge(['y = x', 'y = 2x'])
    mountPanel()
    const el = await edit(0)
    await key(el, 'ArrowDown')
    expect(document.activeElement).toBe(inputOf('e2'))
  })

  it('з порожнього рядка (його поле лишається): blur старого поля не зриває редагування нового', async () => {
    liveBridge(['', 'y = x'])
    mountPanel()
    const el = await edit(0)
    await key(el, 'ArrowDown')
    const next = inputOf('e2')
    expect(next).not.toBeNull() // рядок не згорнувся назад у прев'ю
    expect(document.activeElement).toBe(next)
  })

  it('↑ на першому і ↓ на останньому — нічого', async () => {
    liveBridge(['y = x', 'y = 2x'])
    mountPanel()
    const first = await edit(0)
    await key(first, 'ArrowUp')
    expect(document.activeElement).toBe(inputOf('e1'))
    const last = await edit(1)
    await key(last, 'ArrowDown')
    expect(document.activeElement).toBe(inputOf('e2'))
  })

  it('відкрите slash-меню: ↑/↓ — навігація меню, рядок не міняється', async () => {
    const { bridge, calls } = liveBridge(['y = x', '/'])
    mountPanel()
    const el = await edit(1)
    bridge.slashPopup = { exprId: 'e2', query: '', selectedIdx: 0 }
    await key(el, 'ArrowUp')
    expect(calls.arrowNav).toEqual([['e2', -1]])
    expect(document.activeElement).toBe(el)
  })
})

describe('Backspace у порожньому рядку', () => {
  it('рядок зникає, курсор у кінці попереднього', async () => {
    const { bridge } = liveBridge(['y = x', 'y = 2x', ''])
    mountPanel()
    const el = await edit(2)
    await key(el, 'Backspace')
    expect(srcs(bridge)).toEqual(['y = x', 'y = 2x'])
    const prev = inputOf('e2')!
    expect(document.activeElement).toBe(prev)
    expect(prev.selectionStart).toBe(6)
  })

  it('перший порожній рядок — курсор у наступний', async () => {
    const { bridge } = liveBridge(['', 'y = x'])
    mountPanel()
    const el = await edit(0)
    await key(el, 'Backspace')
    expect(srcs(bridge)).toEqual(['y = x'])
    expect(document.activeElement).toBe(inputOf('e2'))
  })

  it('з текстом — звичайне стирання символу (рядок лишається)', async () => {
    const { bridge } = liveBridge(['y = x', 'y'])
    mountPanel()
    const el = await edit(1)
    const e = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
    el.dispatchEvent(e)
    await flushPromises()
    expect(e.defaultPrevented).toBe(false)
    expect(srcs(bridge)).toEqual(['y = x', 'y'])
  })

  it('єдиний рядок — лишається (є куди писати)', async () => {
    const { bridge } = liveBridge([''])
    mountPanel()
    const el = await edit(0)
    await key(el, 'Backspace')
    expect(srcs(bridge)).toEqual([''])
  })
})

describe('вставка кількох рядків — кілька формул', () => {
  it('у порожній рядок: перша формула в нього, решта — новими рядками під ним; курсор в останньому', async () => {
    const { bridge } = liveBridge(['', 'y = 5'])
    mountPanel()
    const el = await edit(0)
    const e = paste(el, 'y = x^2\ny = x^3\n')
    await flushPromises()
    expect(e.defaultPrevented).toBe(true)
    expect(srcs(bridge)).toEqual(['y = x^2', 'y = x^3', 'y = 5'])
    expect(document.activeElement).toBe(inputOf(bridge.displayExpressions[1].id))
  })

  it('у рядок з формулою: усі — новими рядками під ним (без злиття в одну)', async () => {
    const { bridge } = liveBridge(['y = x'])
    mountPanel()
    const el = await edit(0)
    el.setSelectionRange(5, 5)
    paste(el, 'y = x^2\ny = x^3')
    await flushPromises()
    expect(srcs(bridge)).toEqual(['y = x', 'y = x^2', 'y = x^3'])
  })

  it('виділено весь рядок — вставка замінює його', async () => {
    const { bridge } = liveBridge(['y = x'])
    mountPanel()
    const el = await edit(0)
    el.setSelectionRange(0, el.value.length)
    paste(el, 'y = 1\ny = 2')
    await flushPromises()
    expect(srcs(bridge)).toEqual(['y = 1', 'y = 2'])
  })

  it('рядки LaTeX (скопійовані з MathQuill) — звичайним записом', async () => {
    const { bridge } = liveBridge([''])
    mountPanel()
    const el = await edit(0)
    paste(el, '\\frac{1}{x}\n\\sqrt{x}')
    await flushPromises()
    expect(bridge.displayExpressions).toHaveLength(2)
    for (const s of srcs(bridge)) expect(s).not.toContain('\\')
  })

  it('один рядок — як і раніше: LaTeX → запис у позиції курсора', async () => {
    const { bridge } = liveBridge([''])
    mountPanel()
    const el = await edit(0)
    const e = paste(el, '\\sqrt{x}')
    await flushPromises()
    expect(e.defaultPrevented).toBe(true)
    expect(bridge.displayExpressions).toHaveLength(1)
    expect(srcs(bridge)[0]).toMatch(/^sqrt\(x\)$/)
  })
})

describe('помилка рушія під рядком', () => {
  it('людським текстом під своїм рядком; рядки без помилки — без неї', async () => {
    liveBridge(['y = (x', 'y = x'], { 0: 'Очікувалось «)», отримано «END»' })
    mountPanel()
    const errs = w!.findAll('[data-testid="gc-insp-expr-error"]')
    expect(errs).toHaveLength(1)
    expect(errs[0].text()).toBe('⚠ Не вистачає «)»')
    const rowEl = w!.findAll('.gc-insp__expr-row')[0].element
    expect(rowEl.nextElementSibling).toBe(errs[0].element)
  })

  it('англійська локаль — англійською', async () => {
    liveBridge(['y = (x'], { 0: 'Очікувалось «)», отримано «END»' })
    mountPanel('en')
    expect(w!.find('[data-testid="gc-insp-expr-error"]').text()).toBe('⚠ Missing “)”')
  })

  it('під час набору в цьому рядку — схована; після виходу з поля — знову видно', async () => {
    liveBridge(['y = (x', 'y = x'], { 0: 'Очікувалось «)», отримано «END»' })
    mountPanel()
    const el = await edit(0)
    expect(w!.find('[data-testid="gc-insp-expr-error"]').exists()).toBe(false)
    el.dispatchEvent(new Event('blur'))
    await flushPromises()
    expect(w!.find('[data-testid="gc-insp-expr-error"]').exists()).toBe(true)
  })

  it('невідомий текст рушія — як є', async () => {
    liveBridge(['y = ?'], { 0: 'Щось нове від рушія' })
    mountPanel()
    expect(w!.find('[data-testid="gc-insp-expr-error"]').text()).toBe('⚠ Щось нове від рушія')
  })
})

// ── MathQuill: ті самі клавіші з WYSIWYG-поля ────────────────────────────
type Handlers = Record<string, (...a: unknown[]) => void>
let mqHandlers: Handlers = {}
let mqLatex = ''
function installFakeMQ(): void {
  ;(window as never as { MathQuill: unknown }).MathQuill = {
    getInterface: () => ({
      MathField: (el: HTMLElement, opts: { handlers: Handlers }) => {
        mqHandlers = opts.handlers
        // як справжній MathQuill: фокус іде в його прихований textarea (старе поле отримує blur)
        const ta = document.createElement('textarea')
        el.appendChild(ta)
        const mf = {
          latex(v?: string) { if (v === undefined) return mqLatex; mqLatex = v },
          focus: () => ta.focus(),
          revert: () => {},
          moveToRightEnd: () => {},
        }
        return mf
      },
    }),
  }
}

describe('MathQuillField — клавіші «як у Desmos»', () => {
  beforeEach(() => { installFakeMQ(); mqLatex = '' })
  afterEach(() => { delete (window as never as { MathQuill?: unknown }).MathQuill })

  async function mountField(props: Record<string, unknown> = {}) {
    const f = mount(MathQuillField, { attachTo: document.body, props: { modelValue: 'x', ...props } })
    await flushPromises()
    return f
  }

  it('↑/↓ з верхнього рівня → up/down', async () => {
    const f = await mountField()
    mqHandlers.upOutOf()
    mqHandlers.downOutOf()
    expect(f.emitted('up')).toHaveLength(1)
    expect(f.emitted('down')).toHaveLength(1)
    f.unmount()
  })

  it('Backspace на лівому краю: порожнє поле → backspace-out; з формулою — нічого', async () => {
    const f = await mountField()
    mqLatex = 'x'
    mqHandlers.deleteOutOf(-1, { latex: () => mqLatex })
    expect(f.emitted('backspace-out')).toBeUndefined()
    mqLatex = ''
    mqHandlers.deleteOutOf(1, { latex: () => mqLatex }) // Delete праворуч — не наш випадок
    expect(f.emitted('backspace-out')).toBeUndefined()
    mqHandlers.deleteOutOf(-1, { latex: () => mqLatex })
    expect(f.emitted('backspace-out')).toHaveLength(1)
    f.unmount()
  })

  it('вставка кількох рядків: лише з split-pasted-lines віддається caller-у; один рядок — MathQuill-у', async () => {
    const plain = await mountField()
    const e1 = paste(plain.element as HTMLElement, 'y = 1\ny = 2')
    expect(e1.defaultPrevented).toBe(false) // інші поля (похідні, кроки) — як і раніше
    expect(plain.emitted('paste-lines')).toBeUndefined()
    plain.unmount()

    const split = await mountField({ splitPastedLines: true })
    const one = paste(split.element as HTMLElement, 'y = 1')
    expect(one.defaultPrevented).toBe(false)
    const two = paste(split.element as HTMLElement, 'y = 1\ny = 2')
    expect(two.defaultPrevented).toBe(true)
    expect(split.emitted('paste-lines')).toEqual([['y = 1\ny = 2']])
    split.unmount()
  })

  it('↓ з порожнього рядка в рядок MathQuill: blur старого поля не згортає новий', async () => {
    liveBridge(['', 'y = x'])
    mountPanel()
    const el = await edit(0) // порожній рядок — plain input, лишається в DOM
    await key(el, 'ArrowDown')
    const rows = w!.findAll('.gc-insp__expr-row')
    expect(rows[1].find('.wb-mq-field').exists()).toBe(true)
    expect(rows[1].find('.gc-insp__expr-preview').exists()).toBe(false)
    expect(rows[1].element.contains(document.activeElement)).toBe(true)
  })

  it('у панелі: ↓ з MathQuill-рядка → наступний рядок', async () => {
    liveBridge(['y = x', 'y = 2x'])
    mountPanel()
    await w!.findAll('.gc-insp__expr-row')[0].find('.gc-insp__expr-preview').trigger('click')
    await flushPromises()
    expect(w!.findAll('.gc-insp__expr-row')[0].find('.wb-mq-field').exists()).toBe(true)
    mqHandlers.downOutOf()
    await flushPromises()
    // наступний рядок — теж MathQuill (renderable), попередній — прев'ю
    const rows = w!.findAll('.gc-insp__expr-row')
    expect(rows[1].find('.wb-mq-field').exists()).toBe(true)
    expect(rows[0].find('.gc-insp__expr-preview').exists()).toBe(true)
  })
})
