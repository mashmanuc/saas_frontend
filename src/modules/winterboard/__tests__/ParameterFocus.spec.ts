/**
 * Parameter Focus MVP (рішення власника 2026-09-21): під час Shift+Drag
 * параметра видно, ЯКІ вирази від нього залежать, яку криву тягнуть і яке
 * зараз значення. Лише UI живого уроку — нових ops немає, Replay не чіпається.
 *
 * Acceptance власника:
 *   y = a·x       ← тягнуть цю  → target
 *   y = a·sin(x)                → dependent
 *   y = x²                      → без акценту
 *   в обох перших однакове поточне `a`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

import uk from '../../../i18n/locales/uk.json'
import en from '../../../i18n/locales/en.json'
import type { WBAsset } from '../types/winterboard'
import { formatParamValue, paramFocusRole, PARAM_FOCUS_FADE_MS, type ParamFocus } from '../utils/paramFocus'
import { asciiMathToLatex } from '../utils/asciiMathToLatex'
import GraphCalcInspector from '../components/sidebar/GraphCalcInspector.vue'
import {
  __resetGraphCalcInspectorForTests,
  graphCalcInspectorState,
  registerGraphCalcInspector,
  type GraphCalcInspectorBridge,
} from '../board/state/graphCalcInspectorState'
import { __resetGraphCalcUiForTests } from '../board/state/graphCalculatorUiState'

const mockState = vi.hoisted(() => ({ lastInstance: null as any }))

vi.mock('../vendor/graph_calculator/graph-calculator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../vendor/graph_calculator/graph-calculator.js')>()
  class MockGraphCalculator {
    public expressions: any[] = []
    public params: Record<string, any> = {}
    public viewport = { cx: 0, cy: 0, scale: 38 }
    public points: Record<string, any> = {}
    public opts: any
    public onChange: (() => void) | null = null
    public onParamDragStart: ((name: string, exprId: string) => void) | null = null
    public onParamDrag: ((name: string, value: number) => void) | null = null
    public onParamDragEnd: ((name: string | undefined) => void) | null = null
    constructor(_c: HTMLElement, opts: any = {}) { this.opts = opts; mockState.lastInstance = this }
    setState(state: any) {
      if (state.expressions) this.expressions = state.expressions.map((e: any) => ({ ...e, classified: null }))
      if (state.params) this.params = JSON.parse(JSON.stringify(state.params))
      if (state.viewport) this.viewport = { ...state.viewport }
      if (this.onChange) this.onChange()
    }
    getState() {
      return {
        expressions: this.expressions.map((e) => ({ id: e.id, src: e.src, color: e.color, hidden: !!e.hidden })),
        params: JSON.parse(JSON.stringify(this.params)),
        viewport: { ...this.viewport },
        points: {},
      }
    }
    setParamValue(name: string, value: number) {
      if (this.params[name] && typeof this.params[name] === 'object') this.params[name].value = value
      else this.params[name] = { value, min: -10, max: 10, step: 0.1 }
    }
    addExpression() {}
    removeExpression() {}
    updateExpression() {}
    setHidden() {}
    destroy() {}
  }
  return { GraphCalculator: MockGraphCalculator, default: MockGraphCalculator, GraphCalc: (actual as any).GraphCalc }
})

const ACCEPTANCE = [
  { id: 'e1', src: 'y = a*x', color: '#c05', hidden: false },
  { id: 'e2', src: 'y = a*sin(x)', color: '#05c', hidden: false },
  { id: 'e3', src: 'y = x^2', color: '#5c0', hidden: false },
]

function focus(over: Partial<ParamFocus> = {}): ParamFocus {
  return { name: 'a', value: -0.44, targetExprId: 'e1', phase: 'active', ...over }
}

// ─── Чисті функції ──────────────────────────────────────────────────────

describe('paramFocusRole', () => {
  it('acceptance: target / dependent / без акценту', () => {
    const f = focus()
    expect(ACCEPTANCE.map((e) => paramFocusRole(f, e))).toEqual(['target', 'dependent', null])
  })

  it('`a` у назві функції (tan, abs) — не залежність', () => {
    expect(paramFocusRole(focus(), { id: 'x', src: 'y = tan(x) + abs(x)', hidden: false })).toBeNull()
  })

  it('два параметри: фокус на `b` — лише вирази з `b`; спільний — dependent', () => {
    const f = focus({ name: 'b', targetExprId: 'eb' })
    expect(paramFocusRole(f, { id: 'ea', src: 'y = a*x', hidden: false })).toBeNull()
    expect(paramFocusRole(f, { id: 'eb', src: 'y = x + b', hidden: false })).toBe('target')
    expect(paramFocusRole(f, { id: 'eab', src: 'y = a*x + b', hidden: false })).toBe('dependent')
  })

  it('прихований вираз і відсутній фокус — без акценту', () => {
    expect(paramFocusRole(focus(), { id: 'e2', src: 'y = a*sin(x)', hidden: true })).toBeNull()
    expect(paramFocusRole(null, ACCEPTANCE[0])).toBeNull()
  })
})

describe('formatParamValue', () => {
  it('справжній мінус, дві цифри, без «−0.00»', () => {
    expect(formatParamValue(-0.44)).toBe('−0.44')
    expect(formatParamValue(1.5)).toBe('1.50')
    expect(formatParamValue(-0.001)).toBe('0.00')
  })
})

describe('asciiMathToLatex — підсвітка ідентифікатора', () => {
  it('обгортає лише вузол `a`, не `a` у назві функції', () => {
    const out = asciiMathToLatex('y = a*tan(x)', { highlightIdent: 'a' })
    expect(out.match(/\\htmlClass\{wb-pf-sym\}\{a\}/g)?.length).toBe(1)
    expect(out).toContain('\\tan')
  })

  it('без опції — вихід як раніше, і стан не протікає в наступний виклик', () => {
    asciiMathToLatex('y = a*x', { highlightIdent: 'a' })
    expect(asciiMathToLatex('y = a*x')).not.toContain('htmlClass')
  })
})

// ─── Права панель (інспектор) ──────────────────────────────────────────

function i18nPlugin() {
  return createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk, en } as never })
}

function gcBridge(exprs: typeof ACCEPTANCE, pf: ParamFocus | null): GraphCalcInspectorBridge {
  return {
    paramEntries: [], dragParamNames: [], paramFocus: pf, paramExpanded: {},
    onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
    onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
    displayExpressions: exprs.map((e) => ({ ...e, isParam: false })),
    slashPopup: null, slashFilteredTemplates: [],
    onSrcInput: () => {}, onInputBlur: () => {}, onEnterPress: () => {},
    onArrowNav: () => {}, onToggleHidden: () => {}, onRemoveExpression: () => {},
    onAddExpression: () => {}, onQuickAdd: () => {},
    applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
    isExpanded: false, toggleExpand: () => {},
  }
}

function rowsInfo(w: ReturnType<typeof mount>) {
  return w.findAll('.gc-insp__expr-row').map((r) => ({
    role: r.attributes('data-pf-role') ?? null,
    value: r.find('[data-testid="gc-insp-pf-value"]').exists()
      ? r.find('[data-testid="gc-insp-pf-value"]').text() : null,
    sym: r.findAll('.wb-pf-sym').length,
  }))
}

describe('GraphCalcInspector — Parameter Focus', () => {
  beforeEach(() => __resetGraphCalcInspectorForTests())

  it('acceptance: target і dependent з однаковим `a`, символ виділено; третій рядок чистий', () => {
    registerGraphCalcInspector('gc', gcBridge(ACCEPTANCE, focus()))
    const w = mount(GraphCalcInspector, { global: { plugins: [i18nPlugin()] } })
    expect(rowsInfo(w)).toEqual([
      { role: 'target', value: 'a = −0.44', sym: 1 },
      { role: 'dependent', value: 'a = −0.44', sym: 1 },
      { role: null, value: null, sym: 0 },
    ])
    const rows = w.findAll('.gc-insp__expr-row')
    expect(rows[0].classes()).toContain('is-pf-target')
    expect(rows[1].classes()).toContain('is-pf-dependent')
    w.unmount()
  })

  it('один параметр в одному виразі', () => {
    registerGraphCalcInspector('gc', gcBridge([ACCEPTANCE[0]], focus({ value: 2 })))
    const w = mount(GraphCalcInspector, { global: { plugins: [i18nPlugin()] } })
    expect(rowsInfo(w)).toEqual([{ role: 'target', value: 'a = 2.00', sym: 1 }])
    w.unmount()
  })

  it('два параметри `a`, `b`: фокус лише там, де активний', () => {
    const exprs = [
      { id: 'ea', src: 'y = a*x', color: '#111', hidden: false },
      { id: 'eb', src: 'y = x + b', color: '#222', hidden: false },
    ]
    registerGraphCalcInspector('gc', gcBridge(exprs, focus({ name: 'b', value: 3, targetExprId: 'eb' })))
    const w = mount(GraphCalcInspector, { global: { plugins: [i18nPlugin()] } })
    expect(rowsInfo(w)).toEqual([
      { role: null, value: null, sym: 0 },
      { role: 'target', value: 'b = 3.00', sym: 1 },
    ])
    w.unmount()
  })

  it('fading → рядки отримують is-pf-fading; null → акцентів немає', async () => {
    registerGraphCalcInspector('gc', gcBridge(ACCEPTANCE, focus({ phase: 'fading' })))
    const w = mount(GraphCalcInspector, { global: { plugins: [i18nPlugin()] } })
    const rows = w.findAll('.gc-insp__expr-row')
    expect(rows[0].classes()).toContain('is-pf-fading')
    expect(rows[2].classes()).not.toContain('is-pf-fading')
    graphCalcInspectorState.bridge!.paramFocus = null
    await nextTick()
    expect(rowsInfo(w).every((r) => r.role === null && r.value === null && r.sym === 0)).toBe(true)
    w.unmount()
  })
})

// ─── Рендерер: потік start → drag → end через колбеки движка ───────────

function makeAsset(): WBAsset {
  return {
    id: 'gc-pf', type: 'graph_calculator', src: '',
    x: 0, y: 0, w: 480, h: 360, rotation: 0, locked: false,
    data: {
      version: 1,
      state: {
        expressions: ACCEPTANCE,
        params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
        viewport: { cx: 0, cy: 0, scale: 38 },
      },
    },
  } as unknown as WBAsset
}

async function loadRenderer() {
  return (await import('../components/board/objects/GraphCalculatorRenderer.vue')).default
}

describe('GraphCalculatorRenderer — Parameter Focus', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
    mockState.lastInstance = null
    __resetGraphCalcUiForTests()
    __resetGraphCalcInspectorForTests()
  })
  afterEach(() => { vi.useRealTimers() })

  it('старт → фокус одразу з target; drag оновлює значення; end → згасання → null', async () => {
    const Renderer = await loadRenderer()
    const w = mount(Renderer, { props: { asset: makeAsset(), isSelected: true }, global: { stubs: { transition: true } } })
    await nextTick()
    const inst = mockState.lastInstance
    const label = () => w.find('[data-testid="graph-calc-drag-param-label"]')

    expect(label().exists()).toBe(false)
    inst.onParamDragStart('a', 'e1')
    await nextTick()
    expect(graphCalcInspectorState.bridge?.paramFocus).toMatchObject({ name: 'a', value: 1, targetExprId: 'e1', phase: 'active' })
    expect(label().text()).toBe('a = 1.00')

    inst.onParamDrag('a', -0.44)
    await nextTick()
    expect(label().text()).toBe('a = −0.44')
    expect(graphCalcInspectorState.bridge?.paramFocus?.value).toBe(-0.44)

    inst.onParamDragEnd('a')
    await nextTick()
    expect(graphCalcInspectorState.bridge?.paramFocus?.phase).toBe('fading')

    vi.advanceTimersByTime(PARAM_FOCUS_FADE_MS)
    await nextTick()
    expect(graphCalcInspectorState.bridge?.paramFocus).toBeNull()
    expect(label().exists()).toBe(false)
    w.unmount()
  })

  it('новий drag під час згасання скасовує таймер — фокус не зникає посеред drag', async () => {
    const Renderer = await loadRenderer()
    const w = mount(Renderer, { props: { asset: makeAsset(), isSelected: true }, global: { stubs: { transition: true } } })
    await nextTick()
    const inst = mockState.lastInstance
    inst.onParamDragStart('a', 'e1')
    inst.onParamDragEnd('a')
    inst.onParamDragStart('a', 'e2')
    vi.advanceTimersByTime(PARAM_FOCUS_FADE_MS * 2)
    await nextTick()
    expect(graphCalcInspectorState.bridge?.paramFocus).toMatchObject({ targetExprId: 'e2', phase: 'active' })
    w.unmount()
  })

  it('невиділений калькулятор: inline-панель показує ролі й значення', async () => {
    const Renderer = await loadRenderer()
    const w = mount(Renderer, { props: { asset: makeAsset(), isSelected: false }, global: { stubs: { transition: true } } })
    await nextTick()
    mockState.lastInstance.onParamDragStart('a', 'e1')
    mockState.lastInstance.onParamDrag('a', -0.44)
    await nextTick()
    const rows = w.findAll('.gc-expr')
    expect(rows.map((r) => r.attributes('data-pf-role') ?? null)).toEqual(['target', 'dependent', null])
    expect(rows.map((r) => r.find('[data-testid="graph-calc-pf-value"]').exists()
      ? r.find('[data-testid="graph-calc-pf-value"]').text() : null))
      .toEqual(['a = −0.44', 'a = −0.44', null])
    w.unmount()
  })

  it('без ops: сам фокус не емітить param-set (емітить лише drag, як і раніше)', async () => {
    const Renderer = await loadRenderer()
    const w = mount(Renderer, { props: { asset: makeAsset(), isSelected: true }, global: { stubs: { transition: true } } })
    await nextTick()
    mockState.lastInstance.onParamDragStart('a', 'e1')
    vi.advanceTimersByTime(1000)
    await nextTick()
    expect(w.emitted('param-set') ?? []).toHaveLength(0)
    w.unmount()
  })
})
