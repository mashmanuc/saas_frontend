/**
 * Графкалькулятор, власник 2026-10-03: меню «/» у правій панелі не працювало зовсім.
 * «/…» у рушій не йде (expr.src лишається порожнім), а поле було прив'язане до expr.src —
 * кожна перерисовка панелі (а її викликає саме відкриття меню) стирала набране.
 * Поки меню відкрите, поле мусить показувати «/запит».
 */
import { afterEach, describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import uk from '../../../i18n/locales/uk.json'
import GraphCalcInspector from '../components/sidebar/GraphCalcInspector.vue'
import {
  registerGraphCalcInspector,
  __resetGraphCalcInspectorForTests,
  type GraphCalcInspectorBridge,
} from '../board/state/graphCalcInspectorState'

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })

function mountWith(slashPopup: GraphCalcInspectorBridge['slashPopup']) {
  __resetGraphCalcInspectorForTests()
  registerGraphCalcInspector('gc-slash', {
    paramEntries: [], dragParamNames: [], paramFocus: null, paramExpanded: {},
    onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
    onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
    displayExpressions: [{ id: 'e1', src: '', color: '#c05', hidden: false, isParam: false }],
    slashPopup,
    slashFilteredTemplates: [{ id: 'parabola', name: 'парабола', label: 'a·x²', src: 'y = a*x^2' }],
    onSrcInput: () => {}, onInputBlur: () => {}, onEnterPress: () => {},
    onArrowNav: () => {}, onToggleHidden: () => {}, onRemoveExpression: () => {},
    onAddExpression: () => {}, onInsertExpressions: () => [], onQuickAdd: () => {},
    applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
    isExpanded: false, toggleExpand: () => {},
  } as GraphCalcInspectorBridge)
  return mount(GraphCalcInspector, { global: { plugins: [i18n()] } })
}

afterEach(() => __resetGraphCalcInspectorForTests())

describe('графкалькулятор · меню «/» у правій панелі', () => {
  it('меню відкрите — поле показує набраний запит «/пар», а не порожню формулу', () => {
    const w = mountWith({ exprId: 'e1', query: 'пар', selectedIdx: 0 })
    expect((w.get('.gc-insp__expr-input').element as HTMLInputElement).value).toBe('/пар')
    expect(w.findAll('.gc-insp__slash-item')).toHaveLength(1)
    w.unmount()
  })

  it('меню закрите — поле показує саму формулу', () => {
    const w = mountWith(null)
    expect((w.get('.gc-insp__expr-input').element as HTMLInputElement).value).toBe('')
    w.unmount()
  })
})
