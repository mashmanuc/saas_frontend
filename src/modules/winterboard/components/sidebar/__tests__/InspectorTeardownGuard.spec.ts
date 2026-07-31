/**
 * Регресія: teardown-blur краш сайдбар-інспекторів (ТЗ INSPECTOR_TEARDOWN_CRASH_2026-08-01).
 *
 * Гонка на проді: клік повз math-картку одночасно (а) обнуляє bridge
 * (unregister…) і (б) шле blur/change з поля інспектора. Обробник спрацьовував
 * уже на bridge === null → `null.commitExpr()` → AppErrorBoundary вбивав ВСЮ
 * сторінку дошки.
 *
 * Ці тести прямо відтворюють гонку: registered bridge → обнулити → синхронний
 * blur/change ДО того, як Vue встигне перемалювати/демонтувати → не кидає.
 * unmount() синхронно скасовує заплановане перемалювання з null-bridge (у
 * проді це робить v-if батька GroupContentSidebar — тут еквівалент).
 */
import { describe, expect, it, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import uk from '../../../../../i18n/locales/uk.json'
import en from '../../../../../i18n/locales/en.json'

import CalculusInspector from '../../sidebar/CalculusInspector.vue'
import GraphCalcInspector from '../../sidebar/GraphCalcInspector.vue'
import QuadraticInspector from '../../sidebar/QuadraticInspector.vue'
// ?raw — сирий текст файлів для recurrence-гарду (як husky-чеки)
import calculusSrc from '../../sidebar/CalculusInspector.vue?raw'
import graphSrc from '../../sidebar/GraphCalcInspector.vue?raw'
import quadSrc from '../../sidebar/QuadraticInspector.vue?raw'

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
import {
  __resetQuadUiForTests,
  registerQuadInspector,
  type QuadBridge,
} from '../../../board/state/quadUiState'

function i18n() {
  return createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk, en } as never })
}
function mountInspector(comp: unknown) {
  return mount(comp as never, { global: { plugins: [i18n()] } })
}

// ── Bridge-фабрики (мінімальні валідні) ─────────────────────────────────────
function makeCalcBridge(o: Partial<CalculusBridge> = {}): CalculusBridge {
  return {
    mode: 'derivative', expr: '', showSecant: false, showDerivTrace: false,
    h: 0.5, riemann: 'off', N: 12, showF: false, a: -1.5, b: 1.5,
    setExpr: () => {}, commitExpr: () => {}, toggle: () => {}, setRiemann: () => {},
    setH: () => {}, setN: () => {}, setBound: () => {}, onExprPreset: () => {},
    ...o,
  }
}
function makeGcBridge(o: Partial<GraphCalcInspectorBridge> = {}): GraphCalcInspectorBridge {
  return {
    paramEntries: [{ name: 'a', value: 1, min: 0, max: 5, step: 0.1 }],
    paramExpanded: { a: true }, // розгортає range-редактор (min/max/step)
    onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
    onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
    displayExpressions: [{ id: 'e1', src: '', color: '#f00', hidden: false, isParam: false }],
    slashPopup: null, slashFilteredTemplates: [],
    onSrcInput: () => {}, onInputBlur: () => {}, onEnterPress: () => {}, onArrowNav: () => {},
    onToggleHidden: () => {}, onRemoveExpression: () => {}, onAddExpression: () => {},
    onQuickAdd: () => {}, applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
    isExpanded: false, toggleExpand: () => {},
    ...o,
  }
}
function makeQuadBridge(o: Partial<QuadBridge> = {}): QuadBridge {
  return {
    a: 1, b: 0, c: 0, sign: '=', showVertex: false, showAxis: false, showRoots: false,
    setA: () => {}, setB: () => {}, setC: () => {}, setSign: () => {}, toggle: () => {}, setPreset: () => {},
    ...o,
  }
}

beforeEach(() => {
  __resetCalculusUiForTests()
  __resetGraphCalcInspectorForTests()
  __resetQuadUiForTests()
})

// ── CalculusInspector ───────────────────────────────────────────────────────
describe('CalculusInspector — teardown-guard', () => {
  it('blur ПІСЛЯ обнулення bridge не кидає (це впало на проді: commitExpr)', () => {
    registerCalculusInspector('c1', makeCalcBridge({ expr: '' })) // порожній expr → одразу plain input
    const w = mountInspector(CalculusInspector)
    const el = w.find('.calc-insp__expr-input').element
    expect(el).toBeTruthy()
    __resetCalculusUiForTests() // гонка: bridge → null
    expect(() => el.dispatchEvent(new Event('blur'))).not.toThrow()
    w.unmount()
  })

  it('@change межі ПІСЛЯ обнулення bridge не кидає (onBoundChange)', () => {
    registerCalculusInspector('c2', makeCalcBridge({ mode: 'integral', a: 0, b: 2 }))
    const w = mountInspector(CalculusInspector)
    const el = w.find('.calc-insp__bound-input').element as HTMLInputElement
    el.value = '1.5'
    __resetCalculusUiForTests()
    expect(() => el.dispatchEvent(new Event('change'))).not.toThrow()
    w.unmount()
  })

  it('живий bridge: blur досі комітить (нормальний шлях не зламано)', () => {
    const commitExpr = vi.fn()
    registerCalculusInspector('c3', makeCalcBridge({ expr: '', commitExpr }))
    const w = mountInspector(CalculusInspector)
    w.find('.calc-insp__expr-input').element.dispatchEvent(new Event('blur'))
    expect(commitExpr).toHaveBeenCalledTimes(1)
    w.unmount()
  })
})

// ── GraphCalcInspector ──────────────────────────────────────────────────────
describe('GraphCalcInspector — teardown-guard', () => {
  it('blur виразу ПІСЛЯ обнулення bridge не кидає (onInputBlur)', () => {
    registerGraphCalcInspector('g1', makeGcBridge())
    const w = mountInspector(GraphCalcInspector)
    const el = w.find('.gc-insp__expr-input').element // src='' → plain input
    expect(el).toBeTruthy()
    __resetGraphCalcInspectorForTests()
    expect(() => el.dispatchEvent(new Event('blur'))).not.toThrow()
    w.unmount()
  })

  it('@change range (min) ПІСЛЯ обнулення bridge не кидає (onRangeMinChange)', () => {
    registerGraphCalcInspector('g2', makeGcBridge())
    const w = mountInspector(GraphCalcInspector)
    const el = w.find('.gc-insp__range-input').element as HTMLInputElement
    el.value = '0.5'
    __resetGraphCalcInspectorForTests()
    expect(() => el.dispatchEvent(new Event('change'))).not.toThrow()
    w.unmount()
  })

  it('живий bridge: blur досі кличе onInputBlur(id)', () => {
    const onInputBlur = vi.fn()
    registerGraphCalcInspector('g3', makeGcBridge({ onInputBlur }))
    const w = mountInspector(GraphCalcInspector)
    w.find('.gc-insp__expr-input').element.dispatchEvent(new Event('blur'))
    expect(onInputBlur).toHaveBeenCalledWith('e1')
    w.unmount()
  })
})

// ── QuadraticInspector ──────────────────────────────────────────────────────
describe('QuadraticInspector — teardown-guard', () => {
  it('@change коефіцієнта ПІСЛЯ обнулення bridge не кидає (onAChange)', () => {
    registerQuadInspector('q1', makeQuadBridge())
    const w = mountInspector(QuadraticInspector)
    const el = w.find('.quad-insp__num-input').element as HTMLInputElement
    el.value = '2'
    __resetQuadUiForTests()
    expect(() => el.dispatchEvent(new Event('change'))).not.toThrow()
    w.unmount()
  })

  it('живий bridge: @change a досі кличе setA', () => {
    const setA = vi.fn()
    registerQuadInspector('q2', makeQuadBridge({ setA }))
    const w = mountInspector(QuadraticInspector)
    const el = w.find('.quad-insp__num-input').element as HTMLInputElement
    el.value = '3'
    el.dispatchEvent(new Event('change'))
    expect(setA).toHaveBeenCalledWith(3)
    w.unmount()
  })
})

// ── Recurrence-гард (§7.3): жоден @blur/@change не читає bridge напряму через b.value ──
describe('recurrence-гард проти повернення бага', () => {
  it('Calculus: guarded, старий незахищений патерн відсутній', () => {
    expect(calculusSrc).toContain('calculusUiState.bridge?.commitExpr()')
    expect(calculusSrc).not.toContain('b.value.commitExpr()')
    expect(calculusSrc).not.toContain('b.value.setBound(')
  })
  it('GraphCalc: @blur/@change не викликають b.on… inline', () => {
    expect(graphSrc).toContain('graphCalcInspectorState.bridge?.onInputBlur(')
    expect(graphSrc).not.toMatch(/@blur="[^"]*b\.onInputBlur/)
    expect(graphSrc).not.toMatch(/@change="[^"]*b\.onRange(Min|Max|Step)Change/)
  })
  it('Quad: onA/B/CChange не читають b.value', () => {
    expect(quadSrc).toContain('quadUiState.bridge')
    expect(quadSrc).not.toContain('b.value.setA(')
    expect(quadSrc).not.toContain('b.value.setB(')
    expect(quadSrc).not.toContain('b.value.setC(')
  })
})
