/**
 * P1 (ТЗ INSPECTOR_TEARDOWN_CRASH_2026-08-01 §6): втрата даних після P0-гарду.
 *
 * card.setExpression НЕ тригерить snapshot (лише drag), тож набраний вираз
 * тримається ЛИШЕ onExprCommit на blur. Після P0 blur→commitExpr = no-op на
 * null bridge → draft губиться. Fix: onExprCommit() перед unregister на деселекті/
 * unmount + ресинк exprDraft←store, щоб не клобрити store застарілим draft'ом.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'

import uk from '../../../i18n/locales/uk.json'
import CalculusRenderer from '../components/board/objects/CalculusRenderer.vue'
import { calculusUiState, __resetCalculusUiForTests } from '../board/state/calculusUiState'

// vendor bundle імпортується заради side-effect (ставить window.CalculusCard) —
// мокаємо у no-op, а глобал ставимо самі мінімальним stub'ом.
vi.mock('../vendor/calculus', () => ({}))

class StubCard {
  onChange: (() => void) | null = null
  viewport: unknown = null
  opts: { expr: string } // існуючий sync-watch читає card.opts.expr
  constructor(_el: HTMLElement, o: { expr: string }) { this.opts = o }
  setExpression(v: string) { this.opts.expr = v }
  destroy() {}
}

function makeAsset(expr = 'x^2') {
  return {
    id: 'calc-1', type: 'calculus_card', x: 0, y: 0, w: 300, h: 200,
    data: {
      mode: 'derivative', expr, showSecant: false, showDerivTrace: false,
      h: 0.5, riemann: 'off', N: 12, showF: false, a: -1.5, b: 1.5,
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
  await flushPromises() // async mount(): import vendor → new CalculusCard → register bridge
  return w
}

beforeEach(() => {
  __resetCalculusUiForTests()
  ;(window as unknown as { CalculusCard: unknown }).CalculusCard = StubCard
})
afterEach(() => {
  delete (window as unknown as { CalculusCard?: unknown }).CalculusCard
  vi.clearAllMocks()
})

function lastExpr(w: ReturnType<typeof mount>): string | undefined {
  const ev = w.emitted('update:asset') as unknown[][] | undefined
  if (!ev || ev.length === 0) return undefined
  return (ev[ev.length - 1][0] as { data: { expr: string } }).data.expr
}

describe('CalculusRenderer — P1 деселект-коміт', () => {
  it('bridge реєструється на mount (передумова)', async () => {
    const w = await mountSelected(makeAsset())
    expect(calculusUiState.bridge).not.toBeNull()
    w.unmount()
  })

  it('деселект комітить незакомічений expr-draft у store', async () => {
    const w = await mountSelected(makeAsset('x^2'))
    // імітуємо набір в інспекторі: живий setExpr (draft), БЕЗ blur-commit
    calculusUiState.bridge!.setExpr('x^3')
    // деселект (як клік повз картку) — до P1 це просто unregister (draft губився)
    await w.setProps({ isSelected: false } as never)
    expect(lastExpr(w)).toBe('x^3')
    w.unmount()
  })

  it('ресинк: деселект НЕзміненої картки не клобрить store зовнішньою зміною expr', async () => {
    const w = await mountSelected(makeAsset('x^2'))
    // зовнішня зміна store (undo/op) → expr став x^5, користувач НЕ набирав
    await w.setProps({ asset: makeAsset('x^5') } as never)
    // деселект: exprDraft має бути ресинкнутий у x^5 → onExprCommit no-op (нема patch)
    await w.setProps({ isSelected: false } as never)
    // жодного клобру store застарілим x^2
    expect(lastExpr(w)).not.toBe('x^2')
    w.unmount()
  })

  it('живий bridge: setExpr без деселекту НЕ пише у store (лише draft)', async () => {
    const w = await mountSelected(makeAsset('x^2'))
    calculusUiState.bridge!.setExpr('x^7')
    // без blur/деселекту store не чіпається (live рушій має значення, store — ні)
    expect(lastExpr(w)).toBeUndefined()
    w.unmount()
  })
})
