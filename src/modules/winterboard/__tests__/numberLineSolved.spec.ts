/**
 * Б-184 · режим «Розвʼязати» (ТЗ TZ_NUMBER_LINE_SOLVER_2026-10-13): сервер точно розвʼязує,
 * дошка зберігає відповідь одним asset_update і малює лише збережене.
 * Інваріанти §5: межа на рисунку = межа з result; нуль знаменника / поза ОДЗ — не зафарбовані;
 * exact:false → «≈»; не пілот — без режиму; відмова — нуль записів.
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
import { evaluate } from '../engine/numberLine'
import type { NumberLineAsset } from '../types/numberLine'
import type { SolverBound, SolverResult } from '../engine/numberLine/types'

const auth = vi.hoisted(() => ({ user: { id: 40 } as { id: number } | null }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))
const api = vi.hoisted(() => ({ solveNumberLine: vi.fn() }))
vi.mock('../api/winterboardApi', () => ({ winterboardApi: api, default: api }))

const B = (approx: number, text: string | null, closed: boolean, exact = true, latex = text ?? String(approx)): SolverBound =>
  ({ latex, approx, exact, closed, text })

/** √(x+1) > x − 1 → [−1; 3), ОДЗ x ≥ −1 — як віддає сервер. */
const ROOT_RESULT: SolverResult = {
  ok: true, intervals: [{ from: B(-1, '−1', true, true, '-1'), to: B(3, '3', false) }], points: [], domain: 'x ≥ −1', answer: 'x ∈ [−1; 3)',
}

const i18n = () => createI18n({ legacy: false, locale: 'uk', fallbackLocale: 'uk', messages: { uk } as never })
let wrapper: VueWrapper | null = null
afterEach(() => { wrapper?.unmount(); wrapper = null; __resetNumberLineUiForTests(); auth.user = { id: 40 }; api.solveNumberLine.mockReset() })

const Board = defineComponent({
  props: { asset: { type: Object as PropType<NumberLineAsset>, required: true }, isSelected: { type: Boolean, default: true } },
  setup(props) {
    return () => h('div', [
      h(NumberLineRenderer, { asset: props.asset, isSelected: props.isSelected, interactive: true }),
      numberLineUiState.bridge ? h(NumberLineInspector) : null,
    ])
  },
})

async function mountIt(a: NumberLineAsset, props: Record<string, unknown> = {}) {
  wrapper = mount(Board, { props: { asset: a, ...props }, global: { plugins: [i18n()] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const updates = (w: VueWrapper) => (w.findComponent(NumberLineRenderer).emitted('update:asset') ?? []) as Array<[NumberLineAsset]>
const solvedAsset = (result: SolverResult, inequality = '√(x+1) > x − 1') =>
  buildNumberLineAsset({ x: 300, y: 200 }, { mode: 'solved', inequality, result, solver: 'sympy-1.13.3' }, 'nl-s')

describe('рисунок лише зі збереженого result (§5.1)', () => {
  it('межі, зафарбована / виколота, відповідь і ОДЗ', async () => {
    const w = await mountIt(solvedAsset(ROOT_RESULT), { isSelected: false })
    expect(w.find('[data-testid="number-line-kind"]').text()).toBe('РОЗВʼЯЗОК НЕРІВНОСТІ')
    expect(w.find('[data-testid="number-line-formula"]').text()).toBe('√(x+1) > x − 1')
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ [−1; 3)')
    expect(w.find('[data-testid="number-line-domain"]').text()).toBe('ОДЗ: x ≥ −1')
    expect(w.findAll('circle').map((c) => c.attributes('data-filled'))).toEqual(['1', '0'])
    expect(api.solveNumberLine).not.toHaveBeenCalled()
  })

  it('спільна межа двох проміжків — одна виколота точка (нуль знаменника / виключена)', () => {
    const r: SolverResult = { ok: true, intervals: [{ from: null, to: B(-3, '−3', false, true, '-3') }, { from: B(-1, '−1', true, true, '-1'), to: B(1, '1', true) }], points: [], domain: null, answer: 'x ∈ (−∞; −3) ∪ [−1; 1]' }
    const ev = evaluate({ ...solvedAsset(r).data })
    if (!('layout' in ev)) throw new Error('eval')
    expect(ev.layout.points.map((p) => `${p.label}${p.filled ? '●' : '○'}`)).toEqual(['−3○', '−1●', '1●'])
    const r2: SolverResult = { ok: true, intervals: [{ from: null, to: B(1, '1', false) }, { from: B(1, '1', false), to: null }], points: [], domain: null, answer: 'x ∈ (−∞; 1) ∪ (1; +∞)' }
    const ev2 = evaluate({ ...solvedAsset(r2).data })
    if (!('layout' in ev2)) throw new Error('eval')
    expect(ev2.layout.points.map((p) => `${p.label}${p.filled ? '●' : '○'}`)).toEqual(['1○'])
  })

  it('exact:false → «≈» на прямій (§5.3)', () => {
    const r: SolverResult = { ok: true, intervals: [{ from: B(1.3247179572, null, false, false, '\\sqrt[3]{…}'), to: null }], points: [], domain: null, answer: 'x ∈ (≈1,32; +∞)' }
    const ev = evaluate({ ...solvedAsset(r).data })
    if (!('layout' in ev)) throw new Error('eval')
    expect(ev.layout.points[0].label).toBe('≈1,32')
  })

  it('зіпсований result — помилка, а не вигаданий рисунок', () => {
    const ev = evaluate({ ...solvedAsset(ROOT_RESULT).data, result: { ok: true } as never })
    expect('errors' in ev && ev.errors[0].code).toBe('bad_data')
  })
})

describe('«Розвʼязати» в інспекторі', () => {
  it('пілот: рівно один asset_update з нерівністю й відповіддю, як прийшла', async () => {
    api.solveNumberLine.mockResolvedValue({ ...ROOT_RESULT, solver: 'sympy-1.13.3' })
    const w = await mountIt(buildNumberLineAsset({ x: 300, y: 200 }, {}, 'nl-new'))
    await w.find('[data-testid="number-line-mode-solved"]').trigger('click')
    await w.find('[data-testid="number-line-solve-input"]').setValue('√(x+1) > x − 1')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    await flushPromises()
    expect(api.solveNumberLine).toHaveBeenCalledWith('√(x+1) > x − 1')
    const u = updates(w)
    expect(u).toHaveLength(1)
    expect(u[0][0].data).toMatchObject({ mode: 'solved', inequality: '√(x+1) > x − 1', solver: 'sympy-1.13.3', result: ROOT_RESULT })
  })

  it('Enter теж розвʼязує', async () => {
    api.solveNumberLine.mockResolvedValue(ROOT_RESULT)
    const w = await mountIt(buildNumberLineAsset({ x: 300, y: 200 }, {}, 'nl-new'))
    await w.find('[data-testid="number-line-mode-solved"]').trigger('click')
    const input = w.find('[data-testid="number-line-solve-input"]')
    await input.setValue('x^2 - 4 > 0')
    await input.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    expect(updates(w)).toHaveLength(1)
  })

  it('відмова сервера — нуль записів, пояснення словами, рисунок на місці (§5.5)', async () => {
    api.solveNumberLine.mockResolvedValue({ ok: false, reason: 'timeout', detail: 'не встиг за 2 с' })
    const w = await mountIt(solvedAsset(ROOT_RESULT))
    const input = w.find('[data-testid="number-line-solve-input"]')
    expect((input.element as HTMLInputElement).value).toBe('√(x+1) > x − 1')
    await input.setValue('x^6 + x^5 + 7 > 0')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    await flushPromises()
    expect(updates(w)).toHaveLength(0)
    expect(w.find('[data-testid="number-line-solve-error"]').text()).toBe('Не встиг розвʼязати — спростіть нерівність')
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ [−1; 3)')
    expect((w.find('[data-testid="number-line-solve-input"]').element as HTMLInputElement).value).toBe('x^6 + x^5 + 7 > 0')
  })

  it('відмова форми запису — із поясненням сервера', async () => {
    api.solveNumberLine.mockResolvedValue({ ok: false, reason: 'parse', detail: 'незрозуміле імʼя «y» — лише змінна x і √' })
    const w = await mountIt(buildNumberLineAsset({ x: 300, y: 200 }, {}, 'nl-new'))
    await w.find('[data-testid="number-line-mode-solved"]').trigger('click')
    await w.find('[data-testid="number-line-solve-input"]').setValue('y > 0')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="number-line-solve-error"]').text()).toBe('Не зрозумів нерівність: незрозуміле імʼя «y» — лише змінна x і √')
  })

  it('поки йде запит — повторний клік нічого не шле', async () => {
    let resolve: (v: unknown) => void = () => {}
    api.solveNumberLine.mockReturnValue(new Promise((r) => { resolve = r }))
    const w = await mountIt(buildNumberLineAsset({ x: 300, y: 200 }, {}, 'nl-new'))
    await w.find('[data-testid="number-line-mode-solved"]').trigger('click')
    await w.find('[data-testid="number-line-solve-input"]').setValue('x^2 - 4 > 0')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    await w.find('[data-testid="number-line-apply"]').trigger('click')
    expect(api.solveNumberLine).toHaveBeenCalledTimes(1)
    resolve(ROOT_RESULT)
    await flushPromises()
    expect(updates(w)).toHaveLength(1)
  })
})

describe('лише пілот (§5.4)', () => {
  it('не пілот — режиму «Розвʼязати» в інспекторі немає', async () => {
    auth.user = { id: 7 }
    const w = await mountIt(buildNumberLineAsset({ x: 300, y: 200 }, {}, 'nl-new'))
    expect(w.find('[data-testid="number-line-mode-solved"]').exists()).toBe(false)
  })

  it('збережений розвʼязок не пілот бачить (рисунок зі збереженого, без запитів)', async () => {
    auth.user = { id: 7 }
    const w = await mountIt(solvedAsset(ROOT_RESULT), { isSelected: false })
    expect(w.find('[data-testid="number-line-answer"]').text()).toBe('x ∈ [−1; 3)')
    expect(api.solveNumberLine).not.toHaveBeenCalled()
  })
})
