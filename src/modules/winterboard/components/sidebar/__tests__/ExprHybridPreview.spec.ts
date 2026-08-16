/**
 * Гібрид «рендер у спокої» (ТЗ 2026-07-21, post-P0 блок):
 * рядки виразів показують KaTeX-прев'ю; клік → живий <input>; blur → прев'ю.
 *
 * CalculusInspector + GraphCalcInspector, реальні локалі + справжній KaTeX.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

import uk from '../../../../../i18n/locales/uk.json'
import en from '../../../../../i18n/locales/en.json'
import CalculusInspector from '../../sidebar/CalculusInspector.vue'
import GraphCalcInspector from '../../sidebar/GraphCalcInspector.vue'
import {
  __resetCalculusUiForTests,
  registerCalculusInspector,
  type CalculusBridge,
} from '../../../board/state/calculusUiState'
import {
  __resetGraphCalcInspectorForTests,
  registerGraphCalcInspector,
  type GraphCalcInspectorBridge,
} from '../../../board/state/graphCalcInspectorState'

function i18nPlugin() {
  return createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk, en } as never })
}

// ── CalculusInspector ────────────────────────────────────────────────────

function calcBridge(): CalculusBridge {
  return {
    mode: 'derivative', expr: 'x^2', showSecant: false, showDerivTrace: false,
    h: 0.5, riemann: 'off', N: 12, showF: false, a: -1.5, b: 1.5,
    setExpr: () => {}, commitExpr: () => {}, toggle: () => {},
    setRiemann: () => {}, setH: () => {}, setN: () => {}, setBound: () => {},
    onExprPreset: () => {},
  }
}

describe('CalculusInspector — гібрид прев\'ю ↔ input', () => {
  beforeEach(() => {
    __resetCalculusUiForTests()
    registerCalculusInspector('calc-h-1', calcBridge())
  })

  it('спокій: KaTeX-прев\'ю видиме, input відсутній', () => {
    const w = mount(CalculusInspector, { global: { plugins: [i18nPlugin()] } })
    expect(w.find('.calc-insp__expr-preview .katex').exists()).toBe(true)
    expect(w.find('.calc-insp__expr-input').exists()).toBe(false)
    w.unmount()
  })

  it('клік по прев\'ю → input з тим самим значенням; blur → знову прев\'ю', async () => {
    const w = mount(CalculusInspector, { attachTo: document.body, global: { plugins: [i18nPlugin()] } })
    await w.find('.calc-insp__expr-preview').trigger('click')
    await nextTick()
    const input = w.find('.calc-insp__expr-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('x^2')
    expect(w.find('.calc-insp__expr-preview').exists()).toBe(false)

    await input.trigger('blur')
    await nextTick()
    expect(w.find('.calc-insp__expr-preview').exists()).toBe(true)
    expect(w.find('.calc-insp__expr-input').exists()).toBe(false)
    w.unmount()
  })
})

// ── GraphCalcInspector ───────────────────────────────────────────────────

function gcBridge(): GraphCalcInspectorBridge {
  return {
    paramEntries: [], dragParamNames: [], paramExpanded: {},
    onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
    onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
    displayExpressions: [
      { id: 'e1', src: 'y = a*x^2', color: '#c00', hidden: false, isParam: false },
      { id: 'e2', src: '', color: '#0c0', hidden: false, isParam: false },
    ] as never,
    slashPopup: null, slashFilteredTemplates: [],
    onSrcInput: () => {}, onInputBlur: () => {}, onEnterPress: () => {},
    onArrowNav: () => {}, onToggleHidden: () => {}, onRemoveExpression: () => {},
    onAddExpression: () => {}, onQuickAdd: () => {},
    applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
    isExpanded: false, toggleExpand: () => {},
  }
}

describe('GraphCalcInspector — гібрид прев\'ю ↔ input', () => {
  beforeEach(() => {
    __resetGraphCalcInspectorForTests()
    registerGraphCalcInspector('gc-h-1', gcBridge())
  })

  it('непорожній рядок → KaTeX-прев\'ю; порожній → одразу input', () => {
    const w = mount(GraphCalcInspector, { global: { plugins: [i18nPlugin()] } })
    const rows = w.findAll('.gc-insp__expr-row')
    expect(rows.length).toBe(2)
    // e1 (y = a*x^2) — прев'ю
    expect(rows[0].find('.gc-insp__expr-preview .katex').exists()).toBe(true)
    expect(rows[0].find('.gc-insp__expr-input').exists()).toBe(false)
    // e2 (порожній) — input
    expect(rows[1].find('.gc-insp__expr-preview').exists()).toBe(false)
    expect(rows[1].find('.gc-insp__expr-input').exists()).toBe(true)
    w.unmount()
  })

  it('клік по прев\'ю → input із src і data-expr-id; blur → прев\'ю', async () => {
    const w = mount(GraphCalcInspector, { attachTo: document.body, global: { plugins: [i18nPlugin()] } })
    const row = w.findAll('.gc-insp__expr-row')[0]
    await row.find('.gc-insp__expr-preview').trigger('click')
    await nextTick()
    const input = row.find('.gc-insp__expr-input')
    expect(input.exists()).toBe(true)
    expect((input.element as HTMLInputElement).value).toBe('y = a*x^2')
    expect(input.attributes('data-expr-id')).toBe('e1')

    await input.trigger('blur')
    await nextTick()
    expect(row.find('.gc-insp__expr-preview .katex').exists()).toBe(true)
    expect(row.find('.gc-insp__expr-input').exists()).toBe(false)
    w.unmount()
  })

  it('quick-add шаблони лишаються KaTeX (регрес P0-B)', () => {
    const w = mount(GraphCalcInspector, { global: { plugins: [i18nPlugin()] } })
    const btns = w.findAll('.gc-insp__quick-btn')
    expect(btns.length).toBe(4)
    for (const b of btns) expect(b.find('.katex').exists()).toBe(true)
    w.unmount()
  })
})

// ─── MathQuill edit-mode: регресія втрати фокуса (2026-07-22) ───────────
// Баг: v-else-if містив isRenderableAscii(expr.src), що переобчислювався на
// кожен keystroke; проміжний ввід (`x+`) тимчасово невалідний → поле
// розмонтовувалось → втрата фокуса на кожен символ. Фікс: рішення MQ/input
// фіксується один раз у startEdit (mqEditing).
import { __resetMathQuillLoaderForTests } from '../../../utils/mathquillLoader'

function installFakeMQGlobal(): void {
  ;(window as never as { MathQuill: unknown }).MathQuill = {
    getInterface: () => ({
      MathField: (_el: HTMLElement, _opts: unknown) => ({
        latexValue: '',
        latex(v?: string) { if (v === undefined) return this.latexValue; this.latexValue = v },
        focus: () => {},
        revert: () => {},
      }),
    }),
  }
}

describe('GraphCalcInspector — MQ-поле НЕ розмонтовується на проміжному вводі', () => {
  beforeEach(() => {
    __resetMathQuillLoaderForTests()
    installFakeMQGlobal()
    __resetGraphCalcInspectorForTests()
    registerGraphCalcInspector('gc-mq-1', gcBridge())
  })

  afterEach(() => {
    delete (window as never as { MathQuill?: unknown }).MathQuill
    __resetMathQuillLoaderForTests()
  })

  it('клік → MQ-поле; невалідний проміжний src → поле ЛИШАЄТЬСЯ змонтованим', async () => {
    const w = mount(GraphCalcInspector, { attachTo: document.body, global: { plugins: [i18nPlugin()] } })
    const row = w.findAll('.gc-insp__expr-row')[0]
    await row.find('.gc-insp__expr-preview').trigger('click')
    await flushPromises()
    expect(row.find('.wb-mq-field').exists()).toBe(true)
    expect(row.find('.gc-insp__expr-input').exists()).toBe(false)

    // Симулюємо набір: bridge отримує транзитно-НЕВАЛІДНИЙ ascii (як від typing)
    const st = await import('../../../board/state/graphCalcInspectorState')
    st.graphCalcInspectorState.bridge!.displayExpressions[0].src = 'y = a*x^2+'
    await nextTick()
    await nextTick()

    // Регресія: раніше поле зникало і з'являвся input → втрата фокуса
    expect(row.find('.wb-mq-field').exists()).toBe(true)
    expect(row.find('.gc-insp__expr-input').exists()).toBe(false)
    w.unmount()
  })

  it('fallback-гілка не зламана: без MQ-глобала клік → plain input (як раніше)', async () => {
    delete (window as never as { MathQuill?: unknown }).MathQuill
    __resetMathQuillLoaderForTests()
    const w = mount(GraphCalcInspector, { attachTo: document.body, global: { plugins: [i18nPlugin()] } })
    const row = w.findAll('.gc-insp__expr-row')[0]
    await row.find('.gc-insp__expr-preview').trigger('click')
    await flushPromises()
    expect(row.find('.gc-insp__expr-input').exists()).toBe(true)
    expect(row.find('.wb-mq-field').exists()).toBe(false)
    w.unmount()
  })
})
