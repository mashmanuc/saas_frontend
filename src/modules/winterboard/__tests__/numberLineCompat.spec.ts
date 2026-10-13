/**
 * ТЗ «Числова пряма — один рядок» §3: збережені прямі не зникають. Чотири види старих прямих
 * відкриваються в одному полі (вручну — у своєму старому розділі), і повторне «Застосувати»
 * без змін дає ті самі дані (контракт NumberLineData не змінюється, міграції немає).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { defineComponent, h, type PropType } from 'vue'
import uk from '../../../i18n/locales/uk.json'
import NumberLineRenderer from '../components/board/objects/NumberLineRenderer.vue'
import NumberLineInspector from '../components/sidebar/NumberLineInspector.vue'
import { numberLineUiState, __resetNumberLineUiForTests } from '../board/state/numberLineUiState'
import { buildNumberLineAsset } from '../constants/numberLineDefaults'
import type { NumberLineAsset } from '../types/numberLine'
import type { SolverBound, SolverResult } from '../engine/numberLine/types'

const auth = vi.hoisted(() => ({ user: { id: 40 } as { id: number } | null }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))
const api = vi.hoisted(() => ({ solveNumberLine: vi.fn() }))
vi.mock('../api/winterboardApi', () => ({ winterboardApi: api, default: api }))

const B = (approx: number, text: string, closed: boolean): SolverBound => ({ latex: text, approx, exact: true, closed, text })
const ROOT: SolverResult = { ok: true, intervals: [{ from: B(-1, '−1', true), to: B(3, '3', false) }], points: [], domain: 'x ≥ −1', answer: 'x ∈ [−1; 3)' }

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
const Board = defineComponent({
  props: { asset: { type: Object as PropType<NumberLineAsset>, required: true } },
  setup(props) {
    return () => h('div', [
      h(NumberLineRenderer, { asset: props.asset, isSelected: true, interactive: true }),
      numberLineUiState.bridge ? h(NumberLineInspector) : null,
    ])
  },
})

let wrapper: VueWrapper | null = null
afterEach(() => { wrapper?.unmount(); wrapper = null; __resetNumberLineUiForTests(); api.solveNumberLine.mockReset() })

async function reapply(data: Partial<NumberLineAsset['data']>) {
  const a = buildNumberLineAsset({ x: 300, y: 200 }, data, 'nl-old')
  wrapper = mount(Board, { props: { asset: a }, global: { plugins: [i18n()] }, attachTo: document.body })
  await flushPromises()
  const w = wrapper
  expect(w.find('[data-testid="number-line-dirty"]').exists()).toBe(false)
  await w.find('[data-testid="number-line-apply"]').trigger('click')
  await flushPromises()
  const u = (w.findComponent(NumberLineRenderer).emitted('update:asset') ?? []) as Array<[NumberLineAsset]>
  expect(u).toHaveLength(1)
  return { w, before: a.data, after: u[0][0].data }
}

/** Порівнюємо змістовні поля (undefined = відсутнє). */
const clean = (d: object) => JSON.parse(JSON.stringify(d))

describe('старі прямі відкриваються, повторне «Застосувати» — ті самі дані', () => {
  it('set (система): рядки, як були', async () => {
    const { w, before, after } = await reapply({ conditions: [{ op: '>', value: '1' }, { op: '<=', value: '4' }], combine: 'and' })
    expect((w.find('[data-testid="number-line-input-1"]').element as HTMLInputElement).value).toBe('x ≤ 4')
    expect(clean(after)).toEqual(clean(before))
  })

  it('intervals · вираз: один рядок, «Знаки» увімкнено', async () => {
    const { w, before, after } = await reapply({ mode: 'intervals', conditions: [], expression: '(x-1)(x+3)/(x-2)', rhs: '0', op: '>=' })
    expect((w.find('[data-testid="number-line-input-0"]').element as HTMLInputElement).value).toBe('(x-1)(x+3)/(x-2) ≥ 0')
    expect(w.find('[data-testid="number-line-signs"]').classes()).toContain('is-active')
    expect(clean(after)).toEqual(clean(before))
    expect(api.solveNumberLine).not.toHaveBeenCalled()
  })

  it('solved: рядок нерівності, «Знаки» вимкнено; сервер відповів так само — ті самі дані', async () => {
    api.solveNumberLine.mockResolvedValue({ ...ROOT, solver: 'sympy-1.13.3' })
    const { w, before, after } = await reapply({ mode: 'solved', conditions: [], inequality: '√(x+1) > x − 1', result: ROOT, solver: 'sympy-1.13.3' })
    expect(w.find('[data-testid="number-line-signs"]').classes()).not.toContain('is-active')
    expect(api.solveNumberLine).toHaveBeenCalledWith('√(x+1) > x − 1')
    expect(clean(after)).toEqual(clean(before))
  })

  it('intervals · вручну: старий розділ точок і знаків, ті самі дані', async () => {
    const pts = [{ value: '-3', included: true }, { value: '1', included: true }, { value: '2', included: false }]
    const { w, before, after } = await reapply({ mode: 'intervals', conditions: [], points: pts, signs: ['-', '+', '-', '+'], op: '>=' })
    expect(w.find('[data-testid="number-line-input-0"]').exists()).toBe(false)
    expect(w.find('[data-testid="number-line-points"]').exists()).toBe(true)
    expect(clean(after)).toEqual(clean(before))
  })
})
