/**
 * Картка графкалькулятора говорить мовою інтерфейсу (власник, 2026-09-21:
 * «таке враження, що ми скопіювали з когось і не переклали»). У вбудованій
 * панелі були захардкоджені `+ add`, `+ point`, `circle`, `min/max/step`
 * англійською і «Параметри», підказки кнопок — українською.
 *
 * Два шари захисту:
 *   1) поведінка — ті самі кнопки дають різний текст на uk і en;
 *   2) сторож — у шаблонах рендерера й інспектора немає видимого тексту
 *      поза t(): новий захардкоджений рядок впаде тут, а не в очах учителя.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import fs from 'node:fs'
import path from 'node:path'

import { i18n } from '@/i18n'
import type { WBAsset } from '../types/winterboard'
import { __resetGraphCalcUiForTests } from '../board/state/graphCalculatorUiState'

vi.mock('../vendor/graph_calculator/graph-calculator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../vendor/graph_calculator/graph-calculator.js')>()
  class MockGraphCalculator {
    public expressions: any[] = []
    public params: Record<string, any> = {}
    public viewport = { cx: 0, cy: 0, scale: 38 }
    public points: Record<string, any> = {}
    public opts: any
    public onChange: (() => void) | null = null
    constructor(_c: HTMLElement, opts: any = {}) { this.opts = opts }
    setState(state: any) {
      if (state.expressions) this.expressions = state.expressions.map((e: any) => ({ ...e, classified: null }))
      if (state.params) this.params = JSON.parse(JSON.stringify(state.params))
      if (this.onChange) this.onChange()
    }
    getState() {
      return {
        expressions: this.expressions.map((e) => ({ id: e.id, src: e.src, color: e.color, hidden: !!e.hidden })),
        params: JSON.parse(JSON.stringify(this.params)), viewport: { ...this.viewport }, points: {},
      }
    }
    setParamValue() {}
    addExpression() {}
    removeExpression() {}
    updateExpression() {}
    setHidden() {}
    destroy() {}
  }
  return { GraphCalculator: MockGraphCalculator, default: MockGraphCalculator, GraphCalc: (actual as any).GraphCalc }
})

function makeAsset(): WBAsset {
  return {
    id: 'gc-i18n', type: 'graph_calculator', src: '',
    x: 0, y: 0, w: 480, h: 360, rotation: 0, locked: false,
    data: {
      version: 1,
      state: {
        expressions: [{ id: 'e1', src: 'y = a*x', color: '#c05', hidden: false }],
        params: { a: { value: 1, min: -10, max: 10, step: 0.1 } },
        viewport: { cx: 0, cy: 0, scale: 38 },
      },
    },
  } as unknown as WBAsset
}

async function renderIn(locale: 'uk' | 'en') {
  i18n.global.locale.value = locale
  const Renderer = (await import('../components/board/objects/GraphCalculatorRenderer.vue')).default
  const w = mount(Renderer, { props: { asset: makeAsset(), isSelected: false } })
  await nextTick()
  return {
    w,
    addExpr: w.find('[data-testid="graph-calc-add-expr"]').text(),
    addPoint: w.find('[data-testid="graph-calc-add-point"]').text(),
    circle: w.find('[data-testid="graph-calc-quick-circle"]').text(),
    params: w.find('.gc-params-header').text(),
  }
}

describe('GraphCalculatorRenderer — написи мовою інтерфейсу', () => {
  const initial = i18n.global.locale.value
  beforeEach(() => __resetGraphCalcUiForTests())
  afterEach(() => { i18n.global.locale.value = initial })

  it('uk', async () => {
    const r = await renderIn('uk')
    expect(r).toMatchObject({ addExpr: '+ вираз', addPoint: '+ точка', circle: 'коло' })
    expect(r.params).toContain('Параметри')
    r.w.unmount()
  })

  it('en', async () => {
    const r = await renderIn('en')
    expect(r).toMatchObject({ addExpr: '+ expression', addPoint: '+ point', circle: 'circle' })
    expect(r.params).toContain('Parameters')
    r.w.unmount()
  })
})

// ─── Сторож: жодного видимого тексту поза t() у шаблонах ───────────────

/** Текстові вузли й статичні title/placeholder/aria-label шаблону. */
function visibleLiterals(file: string): string[] {
  const src = fs.readFileSync(path.resolve(__dirname, file), 'utf-8')
  const tpl = src.slice(src.indexOf('<template>'), src.lastIndexOf('</template>'))
    .replace(/<!--[\s\S]*?-->/g, '')
  const out: string[] = []
  // Текст між тегами без {{ }}.
  for (const m of tpl.matchAll(/>([^<>]+)</g)) {
    const text = m[1].replace(/\{\{[\s\S]*?\}\}/g, '').trim()
    if (text) out.push(text)
  }
  // Статичні (без `:`) атрибути, які бачить людина.
  for (const m of tpl.matchAll(/\s(title|placeholder|aria-label)="([^"]+)"/g)) out.push(m[2])
  // Слово з 2+ літер будь-якою абеткою — мовний текст. Дозволені: клавіші й
  // математичні позначення, однакові в усіх мовах.
  const ALLOWED = new Set(['Shift', 'Shift-drag', 'Shift-drag —', 'f(x)', 'y = ...'])
  return out.filter((s) => /\p{L}{2,}/u.test(s) && !ALLOWED.has(s))
}

describe('сторож i18n графкалькулятора', () => {
  it('рендерер: видимого тексту поза t() немає', () => {
    expect(visibleLiterals('../components/board/objects/GraphCalculatorRenderer.vue')).toEqual([])
  })
  it('права панель: видимого тексту поза t() немає', () => {
    expect(visibleLiterals('../components/sidebar/GraphCalcInspector.vue')).toEqual([])
  })
})

// ─── Б-23: права панель у ru — російською, не українським запасним ────
import GraphCalcInspector from '../components/sidebar/GraphCalcInspector.vue'
import {
  __resetGraphCalcInspectorForTests,
  registerGraphCalcInspector,
  type GraphCalcInspectorBridge,
} from '../board/state/graphCalcInspectorState'

function inspectorBridge(): GraphCalcInspectorBridge {
  return {
    paramEntries: [{ name: 'a', value: 1, min: -5, max: 5, step: 0.1 }],
    dragParamNames: ['a'], paramFocus: null, paramExpanded: {},
    onSliderInput: () => {}, flushParam: () => {}, toggleParamExpand: () => {},
    onRangeMinChange: () => {}, onRangeMaxChange: () => {}, onRangeStepChange: () => {},
    displayExpressions: [{ id: 'e1', src: 'y = a*x', color: '#c05', hidden: false, isParam: false }],
    slashPopup: null, slashFilteredTemplates: [],
    onSrcInput: () => {}, onInputBlur: () => {}, onEnterPress: () => {},
    onArrowNav: () => {}, onToggleHidden: () => {}, onRemoveExpression: () => {},
    onAddExpression: () => {}, onQuickAdd: () => {},
    applySlashTemplate: () => {}, closeSlashPopup: () => {}, setSlashSelectedIdx: () => {},
    isExpanded: false, toggleExpand: () => {},
  }
}

describe('GraphCalcInspector — ru (Б-23)', () => {
  const initial = i18n.global.locale.value
  afterEach(() => { i18n.global.locale.value = initial })

  it('заголовок, «+ выражение», «Параметры» — російською', async () => {
    __resetGraphCalcInspectorForTests()
    registerGraphCalcInspector('gc-ru', inspectorBridge())
    i18n.global.locale.value = 'ru'
    const w = mount(GraphCalcInspector)
    await nextTick()
    expect(w.find('.gc-insp__title').text()).toBe('Графический калькулятор')
    expect(w.find('.gc-insp__add-btn').text()).toBe('+ выражение')
    expect(w.text()).toContain('Параметры')
    expect(w.text()).not.toContain('Графічний калькулятор')
    w.unmount()
  })
})
