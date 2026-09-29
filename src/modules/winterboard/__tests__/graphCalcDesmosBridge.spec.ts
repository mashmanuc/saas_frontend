/**
 * Калькулятор графіків «як у Desmos» (власник 2026-09-29, «так»): міст картки ↔ панелі виразів.
 *   • onInsertExpressions — нові рядки ОДРАЗУ під поточним, у порядку, одним знімком стану (одна op);
 *   • помилка рушія — у рядку мосту й під рядком картки; порожній рядок — не помилка;
 *   • текст помилки — людською мовою локалі; кілька рядків у буфері — кілька формул.
 *
 * Рушій справжній (addExpression / updateExpression / removeExpression / classify) — без полотна.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

import type { WBAsset } from '../types/winterboard'
import {
  __resetGraphCalcInspectorForTests,
  graphCalcInspectorState,
} from '../board/state/graphCalcInspectorState'
import { graphCalcErrorMessage } from '../utils/graphCalcError'
import { splitPastedFormulas } from '../utils/formulaPaste'
import { GraphCalc } from '../vendor/graph_calculator/graph-calculator.js'

vi.mock('../vendor/graph_calculator/graph-calculator.js', async () => {
  const actual = await vi.importActual<Record<string, any>>('../vendor/graph_calculator/graph-calculator.js')
  const proto = actual.GraphCalculator.prototype
  class CalcWithoutCanvas {
    expressions: any[] = []
    params: Record<string, unknown> = {}
    viewport = { cx: 0, cy: 0, scale: 38 }
    palette = ['#c00', '#0c0', '#00c']
    onChange: (() => void) | null = null
    addExpression = proto.addExpression
    updateExpression = proto.updateExpression
    removeExpression = proto.removeExpression
    constructor(_el: unknown, _opts: unknown) {}
    _reclassifyAll() {
      for (const e of this.expressions) e.classified = actual.GraphCalc.classify(e.src, Object.keys(this.params))
      if (this.onChange) this.onChange()
    }
    _scheduleRender() {}
    setState(s: any) {
      this.expressions = (s.expressions || []).map((e: any) => ({ ...e }))
      this.params = { ...(s.params || {}) }
      this._reclassifyAll()
    }
    getState() {
      return {
        expressions: this.expressions.map((e) => ({ id: e.id, src: e.src, color: e.color, hidden: !!e.hidden })),
        params: { ...this.params },
        viewport: { ...this.viewport },
      }
    }
    setParamValue() {}
    setHidden() {}
    destroy() {}
  }
  return { ...actual, GraphCalculator: CalcWithoutCanvas, default: CalcWithoutCanvas }
})

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] })
  __resetGraphCalcInspectorForTests()
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

function makeAsset(srcs: string[]): WBAsset {
  return {
    id: 'gc-1', type: 'graph_calculator', src: '', x: 0, y: 0, w: 480, h: 360, rotation: 0, locked: false,
    data: {
      version: 1,
      state: {
        expressions: srcs.map((src, i) => ({ id: `e${i + 1}`, src, color: '#c00', hidden: false })),
        params: {},
        viewport: { cx: 0, cy: 0, scale: 38 },
      },
      meta: { last_snapshot_seq: 1 },
    },
  } as unknown as WBAsset
}

async function mountRenderer(srcs: string[], isSelected: boolean) {
  const Renderer = (await import('../components/board/objects/GraphCalculatorRenderer.vue')).default
  const w = mount(Renderer, { props: { asset: makeAsset(srcs), isSelected } })
  await nextTick()
  return w
}

describe('міст: вставка рядків під поточним (Enter, вставка кількох рядків)', () => {
  it('рядки стають одразу під поточним, у порядку; уся вставка — ОДНА op', async () => {
    const w = await mountRenderer(['y = x', 'y = 2x'], true)
    const bridge = graphCalcInspectorState.bridge!
    const ids = bridge.onInsertExpressions('e1', ['y = x^2', 'y = x^3'])
    expect(ids).toHaveLength(2)
    await nextTick()
    expect(bridge.displayExpressions.map((e) => e.src)).toEqual(['y = x', 'y = x^2', 'y = x^3', 'y = 2x'])
    expect(bridge.displayExpressions.slice(1, 3).map((e) => e.id)).toEqual(ids)

    vi.advanceTimersByTime(500)
    await nextTick()
    const updates = (w.emitted('update:asset') ?? []) as Array<[{ data: { state: { expressions: Array<{ src: string }> } } }]>
    expect(updates).toHaveLength(1)
    expect(updates[0][0].data.state.expressions.map((e) => e.src)).toEqual(['y = x', 'y = x^2', 'y = x^3', 'y = 2x'])
    w.unmount()
  })

  it('порожній рядок (Enter) — один, під поточним; з останнього — у кінець', async () => {
    const w = await mountRenderer(['y = x', 'y = 2x'], true)
    const bridge = graphCalcInspectorState.bridge!
    bridge.onInsertExpressions('e2', [''])
    await nextTick()
    expect(bridge.displayExpressions.map((e) => e.src)).toEqual(['y = x', 'y = 2x', ''])
    w.unmount()
  })

  it('картка лише для перегляду — нічого не вставляє', async () => {
    const Renderer = (await import('../components/board/objects/GraphCalculatorRenderer.vue')).default
    const w = mount(Renderer, { props: { asset: makeAsset(['y = x']), isSelected: true, interactive: false } })
    await nextTick()
    expect(graphCalcInspectorState.bridge!.onInsertExpressions('e1', ['y = 1'])).toEqual([])
    w.unmount()
  })
})

describe('помилка рушія видно під рядком', () => {
  it('недійсний рядок несе текст рушія; порожній, |x| і sin x — без помилки', async () => {
    const w = await mountRenderer(['y = (x', '', 'y = |x|', 'y = sin x'], true)
    const [bad, empty, abs, sin] = graphCalcInspectorState.bridge!.displayExpressions
    expect(bad.error).toBe('Очікувалось «)», отримано «END»')
    expect(empty.error).toBeUndefined()
    expect(abs.error).toBeUndefined()
    expect(sin.error).toBeUndefined()
    w.unmount()
  })

  it('картка без виділення: людський текст під рядком; під час набору в цьому рядку — схований', async () => {
    const w = await mountRenderer(['y = (x', 'y = x'], false)
    const errs = w.findAll('[data-testid="graph-calc-expr-error"]')
    expect(errs).toHaveLength(1)
    expect(errs[0].text()).toBe('⚠ Не вистачає «)»')
    const input = w.findAll('.gc-input')[0]
    await input.trigger('focus')
    expect(w.find('[data-testid="graph-calc-expr-error"]').exists()).toBe(false)
    await input.trigger('blur')
    expect(w.find('[data-testid="graph-calc-expr-error"]').exists()).toBe(true)
    w.unmount()
  })
})

describe('текст помилки — людською мовою', () => {
  const classify = (src: string) =>
    (GraphCalc as unknown as { classify: (s: string, p: string[]) => { kind: string; error?: string } }).classify(src, [])

  it.each([
    ['y = (x', 'missing', { tok: ')' }],
    ['y = ', 'incomplete', undefined],
    ['y = *x', 'unexpected', { tok: '*' }],
    ['y = x = 2', 'doubleEq', undefined],
    ['(1, 2, 3)', 'pointArity', undefined],
    ['y = x)', 'trailing', undefined],
    ['y = foo(x)', 'unknownFunc', undefined],
    ['x^2 + y^2', 'notEquation', undefined],
    ['y = x $ 2', 'unknownSymbol', { ch: '$' }],
    ['y = (x = 2)', 'expectedGot', { expected: ')', got: '=' }],
  ])('%s → %s', (src, key, params) => {
    const c = classify(src)
    expect(c.kind).toBe('invalid')
    const m = graphCalcErrorMessage(c.error!)
    expect(m?.key).toBe(key)
    if (params) expect(m?.params).toEqual(params)
  })

  it('невідомий текст — null (показуємо як є)', () => {
    expect(graphCalcErrorMessage('Щось нове від рушія')).toBeNull()
  })
})

describe('кілька рядків у буфері → кілька формул', () => {
  it('рядки окремо; порожні відкинуто; LaTeX → звичайний запис', () => {
    expect(splitPastedFormulas('y = x^2\r\n\n  y = x^3  \n')).toEqual(['y = x^2', 'y = x^3'])
    const [a, b] = splitPastedFormulas('\\frac{1}{x}\ny = 2x')
    expect(a).not.toContain('\\')
    expect(b).toBe('y = 2x')
  })

  it('один рядок — один елемент (звичайна вставка вирішує сама)', () => {
    expect(splitPastedFormulas('y = x')).toEqual(['y = x'])
    expect(splitPastedFormulas('')).toEqual([])
  })
})
