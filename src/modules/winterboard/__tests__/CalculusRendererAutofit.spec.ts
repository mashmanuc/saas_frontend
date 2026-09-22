/**
 * Картка похідної: вікно під функцію при її зміні (рішення власника 2026-09-22,
 * «так, зроби автопідбір при зміні функції в картці»; TZ_GRAPH_VIEWPORT_AUTOFIT).
 *
 * Урок «Похідна»: функцію x³ − 9x² − 216x вписали в готову картку — і сітка
 * лишилась порожньою. Тепер нова функція і вікно під неї їдуть ОДНИМ
 * asset_update; учень і Replay застосовують вікно, що прийшло ззовні.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import uk from '../../../i18n/locales/uk.json'
import CalculusRenderer from '../components/board/objects/CalculusRenderer.vue'
import { calculusUiState, __resetCalculusUiForTests } from '../board/state/calculusUiState'

vi.mock('../vendor/calculus', () => ({}))

type Fit = { xMin: number; xMax: number; yMin: number; yMax: number }
let lastCard: StubCard | null = null

/** Мінімальна модель рушія: вікно — або масштаб, або вписаний діапазон. */
class StubCard {
  onChange: (() => void) | null = null
  onFitRequest: (() => void) | null = null
  opts: { expr: string; mode: string; x0: number; a: number; b: number }
  vp: Record<string, unknown> = { cx: 0, cy: 0, scale: 50 }
  setViewportCalls = 0
  constructor(_el: HTMLElement, o: StubCard['opts']) { this.opts = { ...o }; lastCard = this }
  setExpression(v: string) { this.opts.expr = v }
  setViewport(v: Record<string, unknown>) { this.vp = { ...v }; this.setViewportCalls++ }
  getViewport() { return JSON.parse(JSON.stringify(this.vp)) }
  setViewportFit(f: Fit) { this.vp = { cx: (f.xMin + f.xMax) / 2, cy: (f.yMin + f.yMax) / 2, fit: { ...f } } }
  setFitEnabled() {}
  setZoomLabels() {}
  setOption() {}
  destroy() {}
}

function makeAsset(expr = 'x^2', extra: Record<string, unknown> = {}) {
  return {
    id: 'calc-1', type: 'calculus_card', x: 0, y: 0, w: 480, h: 360,
    data: {
      mode: 'derivative', expr, x0: 1, showSecant: false, showDerivTrace: false,
      h: 0.5, riemann: 'off', N: 12, showF: false, a: -1.5, b: 1.5,
      viewport: { cx: 0, cy: 0, scale: 50 },
      ...extra,
    },
  } as never
}

async function mountCard(asset: unknown, interactive = true) {
  const w = mount(CalculusRenderer, {
    props: { asset, isSelected: true, interactive } as never,
    global: { plugins: [createI18n({ legacy: false, locale: 'uk', messages: { uk } as never })] },
  })
  await flushPromises()
  return w
}

type Emitted = { data: { expr: string; viewport?: { fit?: Fit; scale?: number } } }
const emitted = (w: ReturnType<typeof mount>) =>
  ((w.emitted('update:asset') as unknown[][] | undefined) || []).map((e) => e[0] as Emitted)

beforeEach(() => {
  __resetCalculusUiForTests()
  lastCard = null
  ;(window as unknown as { CalculusCard: unknown }).CalculusCard = StubCard
})
afterEach(() => {
  delete (window as unknown as { CalculusCard?: unknown }).CalculusCard
})

describe('CalculusRenderer — автопідбір вікна при зміні функції', () => {
  it('нова функція і вікно під неї — ОДНЕ оновлення; видно екстремуми і P = (1, −224)', async () => {
    const w = await mountCard(makeAsset('x^2'))
    calculusUiState.bridge!.setExpr('x^3 - 9*x^2 - 216*x')
    calculusUiState.bridge!.commitExpr()
    const ev = emitted(w)
    expect(ev).toHaveLength(1)
    expect(ev[0].data.expr).toBe('x^3 - 9*x^2 - 216*x')
    const fit = ev[0].data.viewport!.fit!
    expect(fit.yMin).toBeLessThan(-2160)
    expect(fit.yMax).toBeGreaterThan(756)
    expect(fit.xMin).toBeLessThan(1); expect(fit.xMax).toBeGreaterThan(1)
    w.unmount()
  })

  it('пресет теж підбирає вікно', async () => {
    const w = await mountCard(makeAsset('x^2'))
    calculusUiState.bridge!.onExprPreset('sin(x)')
    const ev = emitted(w)
    expect(ev).toHaveLength(1)
    expect(ev[0].data.expr).toBe('sin(x)')
    expect(ev[0].data.viewport!.fit!.yMax).toBeLessThan(3)
    w.unmount()
  })

  it('та сама функція — нічого не пишемо і вікно вчителя не чіпаємо', async () => {
    const w = await mountCard(makeAsset('x^2'))
    calculusUiState.bridge!.onExprPreset('x^2')
    calculusUiState.bridge!.commitExpr()
    expect(emitted(w)).toHaveLength(0)
    expect(lastCard!.vp).toEqual({ cx: 0, cy: 0, scale: 50 })
    w.unmount()
  })

  it('нерозбірна функція — лише вираз, вікно лишається', async () => {
    const w = await mountCard(makeAsset('x^2'))
    calculusUiState.bridge!.setExpr('x^^')
    calculusUiState.bridge!.commitExpr()
    const ev = emitted(w)
    expect(ev).toHaveLength(1)
    expect(ev[0].data.viewport).toEqual({ cx: 0, cy: 0, scale: 50 })
    w.unmount()
  })

  it('учень / Replay: вікно, що прийшло ззовні, застосовується; власне ехо — ні', async () => {
    const w = await mountCard(makeAsset('x^2'), false)
    const before = lastCard!.setViewportCalls
    const fit = { xMin: -15, xMax: 25, yMin: -2500, yMax: 1000 }
    await w.setProps({ asset: makeAsset('x^3 - 9*x^2 - 216*x', { viewport: { cx: 5, cy: -750, fit } }) } as never)
    expect(lastCard!.vp).toEqual({ cx: 5, cy: -750, fit })
    const calls = lastCard!.setViewportCalls
    expect(calls).toBe(before + 1)
    // те саме вікно ще раз (ехо) — рушій не смикаємо
    await w.setProps({ asset: makeAsset('x^3 - 9*x^2 - 216*x', { viewport: { cx: 5, cy: -750, fit } }) } as never)
    expect(lastCard!.setViewportCalls).toBe(calls)
    // учень нічого не пише
    expect(emitted(w)).toHaveLength(0)
    w.unmount()
  })
})
