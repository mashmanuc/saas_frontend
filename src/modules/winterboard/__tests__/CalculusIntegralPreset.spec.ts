/**
 * Картка «∫ f dx»: приклад ставить свої межі, вікно — лише під [a, b] (власник 2026-09-30,
 * «так, роби»).
 *
 * Прод: e^x на [0,1; 10,97] (межі лишились від попередньої функції) — вісь Y на сотні
 * тисяч, крива до x ≈ 8 злилася з віссю, пів картки порожні. Тепер кнопка прикладу в режимі
 * інтеграла ставить межі, на яких приклад читається, і вікно вписується під них — у ТОМУ
 * САМОМУ оновленні, що й функція. Власна функція вчителя (набрана) межі не змінює.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import uk from '../../../i18n/locales/uk.json'
import CalculusRenderer from '../components/board/objects/CalculusRenderer.vue'
import { calculusUiState, __resetCalculusUiForTests } from '../board/state/calculusUiState'
import type { GraphFit } from '../utils/graphAutofit'

vi.mock('../vendor/calculus', () => ({}))

let lastFit: GraphFit | null = null

class StubCard {
  onChange: (() => void) | null = null
  onFitRequest: (() => void) | null = null
  viewport: unknown = { cx: 0, cy: 0, scale: 50 }
  opts: Record<string, unknown>
  constructor(_el: HTMLElement, o: Record<string, unknown>) { this.opts = { ...o } }
  setExpression(v: string) { this.opts.expr = v }
  setOption(k: string, v: unknown) { this.opts[k] = v }
  setViewport(v: unknown) { this.viewport = v }
  getViewport() { return this.viewport }
  setViewportFit(fit: GraphFit) { lastFit = fit; this.viewport = { fit } }
  setFitEnabled() {}
  setZoomLabels() {}
  destroy() {}
}

function makeAsset(mode: 'integral' | 'derivative', expr = 'x^2', a = 0.1, b = 10.97) {
  return {
    id: 'calc-int', type: 'calculus_card', x: 0, y: 0, w: 480, h: 360,
    data: {
      version: 1, mode, expr, x0: 1, showSecant: false, showDerivTrace: false,
      h: 0.5, riemann: 'M', N: 29, showF: false, a, b,
    },
  } as never
}

function i18n() {
  return createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
}

async function mountSelected(asset: unknown) {
  const w = mount(CalculusRenderer, {
    props: { asset, isSelected: true, interactive: true } as never,
    global: { plugins: [i18n()] },
  })
  await flushPromises()
  return w
}

function updates(w: ReturnType<typeof mount>) {
  return ((w.emitted('update:asset') ?? []) as unknown[][]).map((e) => (e[0] as { data: Record<string, unknown> }).data)
}

beforeEach(() => {
  lastFit = null
  __resetCalculusUiForTests()
  ;(window as unknown as { CalculusCard: unknown }).CalculusCard = StubCard
})
afterEach(() => {
  delete (window as unknown as { CalculusCard?: unknown }).CalculusCard
  vi.clearAllMocks()
})

describe('картка інтеграла: приклад ставить свої межі', () => {
  it('eˣ після меж [0,1; 10,97] — межі 0…2 і вікно під них, одним оновленням', async () => {
    const w = await mountSelected(makeAsset('integral'))
    calculusUiState.bridge!.onExprPreset('exp(x)')
    const all = updates(w)
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ expr: 'exp(x)', a: 0, b: 2 })
    expect(all[0].viewport).toEqual({ fit: lastFit })
    expect(lastFit!.yMax).toBeGreaterThan(Math.exp(2))
    expect(lastFit!.yMax).toBeLessThan(10)
    expect(lastFit!.xMax).toBeLessThan(3)
    w.unmount()
  })

  it('та сама функція, але межі чужі — приклад повертає свої', async () => {
    const w = await mountSelected(makeAsset('integral', 'exp(x)'))
    calculusUiState.bridge!.onExprPreset('exp(x)')
    expect(updates(w)[0]).toMatchObject({ expr: 'exp(x)', a: 0, b: 2 })
    w.unmount()
  })

  it('приклад із уже своїми межами — нічого не пише', async () => {
    const w = await mountSelected(makeAsset('integral', 'exp(x)', 0, 2))
    calculusUiState.bridge!.onExprPreset('exp(x)')
    expect(updates(w)).toHaveLength(0)
    w.unmount()
  })

  it('картка похідної: приклад міняє лише функцію, меж не чіпає', async () => {
    const w = await mountSelected(makeAsset('derivative'))
    calculusUiState.bridge!.onExprPreset('exp(x)')
    const [first] = updates(w)
    expect(first.expr).toBe('exp(x)')
    expect(first.a).toBe(0.1)
    expect(first.b).toBe(10.97)
    w.unmount()
  })

  it('власна функція вчителя — межі як були, вікно під них, лише [a, b]', async () => {
    const w = await mountSelected(makeAsset('integral', 'x^2'))
    calculusUiState.bridge!.setExpr('exp(x)')
    calculusUiState.bridge!.commitExpr()
    const [first] = updates(w)
    expect(first).toMatchObject({ expr: 'exp(x)', a: 0.1, b: 10.97 })
    // верх — за f(b) ≈ 58 000, а не за хвостом після b (≈ 300 000)
    expect(lastFit!.yMax).toBeLessThan(Math.exp(10.97) * 1.2)
    w.unmount()
  })
})
