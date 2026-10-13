/**
 * Б-184 · Інтегралик → числова пряма на дошці.
 *
 * «Побудуй числову пряму для x ≥ −2» → справжній обʼєкт `number_line` (а не картка
 * з текстом «нижче числовий промінь»). Обʼєкт зʼявляється лише з валідних даних
 * (інваріант 4); Інтегралик «бачить», що на прямій — умови й відповідь з того самого
 * обчислення, що й рисунок (інваріант 1).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

let page

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    zoom: 1,
    get currentPage() { return page },
    addAsset: (asset) => { page.assets.push(asset) },
    addStroke: vi.fn(),
    updateAsset: vi.fn(),
    selectItems: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))
const api = vi.hoisted(() => ({ solveNumberLine: vi.fn() }))
vi.mock('@/modules/winterboard/api/winterboardApi', () => ({ winterboardApi: api, default: api }))
// Той самий вибирач, що й інспектор: точний розвʼязок — лише пілот (id 40).
const auth = vi.hoisted(() => ({ user: { id: 40 } }))
vi.mock('@/modules/auth/store/authStore', () => ({ useAuthStore: () => auth }))

import { KIND_LABELS, PREP_PAGE_KINDS, runBoardAction, sceneExtras, summarizeAsset } from '../boardActions'

beforeEach(() => {
  page = { id: 'p1', width: 1920, height: 1080, assets: [] }
  api.solveNumberLine.mockReset()
  auth.user = { id: 40 }
})

describe('add_number_line', () => {
  it('валідні умови → один обʼєкт number_line на сторінці', async () => {
    await runBoardAction({ kind: 'add_number_line', payload: {
      conditions: [{ op: '>=', value: '-2' }], combine: 'and', variable: 'x' } })
    expect(page.assets).toHaveLength(1)
    const a = page.assets[0]
    expect(a.type).toBe('number_line')
    expect(a.data.conditions).toEqual([{ op: '>=', value: '-2' }])
    expect(a.data.showAnswer).toBe(true)
    expect(a.x).toBeGreaterThanOrEqual(0)
    expect(a.x + a.w).toBeLessThanOrEqual(1920)
  })

  it('система: combine доходить до обʼєкта', async () => {
    await runBoardAction({ kind: 'add_number_line', payload: {
      conditions: [{ op: '>', value: '1' }, { op: '<=', value: '4' }], combine: 'or' } })
    expect(page.assets[0].data.combine).toBe('or')
  })

  it('невалідні дані — людська помилка й нуль обʼєктів', async () => {
    await expect(runBoardAction({ kind: 'add_number_line', payload: {
      conditions: [{ op: '>', value: '1+√2' }] } })).rejects.toThrow('Не зрозумів нерівність')
    await expect(runBoardAction({ kind: 'add_number_line', payload: { conditions: [] } })).rejects.toThrow()
    expect(page.assets).toHaveLength(0)
  })

  it('можна класти на підготовчу сторінку (пульт)', () => {
    expect(PREP_PAGE_KINDS).toContain('add_number_line')
  })
})

describe('Інтегралик бачить, що на прямій', () => {
  const asset = {
    id: 'nl', type: 'number_line',
    data: { version: 1, mode: 'set', variable: 'x', combine: 'and', showAnswer: true, showHatching: true,
      conditions: [{ op: '>', value: '1' }, { op: '<=', value: '4' }] },
  }

  it('підпис — самі умови, вид — «числова пряма»', () => {
    expect(KIND_LABELS.number_line).toBe('числова пряма')
    expect(summarizeAsset(asset)).toEqual({ kind: 'числова пряма', label: 'x > 1 і x ≤ 4' })
  })

  it('відповідь — з того самого обчислення', () => {
    expect(sceneExtras(asset)).toEqual({ answer: 'x ∈ (1; 4]' })
    const empty = { ...asset, data: { ...asset.data, conditions: [{ op: '<', value: '3' }, { op: '>=', value: '3' }] } }
    expect(sceneExtras(empty)).toEqual({ answer: 'розвʼязків немає (∅)' })
  })

  it('сукупність у підписі — «або»', () => {
    expect(summarizeAsset({ ...asset, data: { ...asset.data, combine: 'or' } }).label).toBe('x > 1 або x ≤ 4')
  })
})

describe('метод інтервалів від Інтегралика (етап 2)', () => {
  it('expression + op → обʼєкт у режимі intervals', async () => {
    await runBoardAction({ kind: 'add_number_line', payload: { expression: '(x-1)(x+3)/(x-2)', op: '>=' } })
    expect(page.assets).toHaveLength(1)
    expect(page.assets[0].data).toMatchObject({ mode: 'intervals', expression: '(x-1)(x+3)/(x-2)', rhs: '0', op: '>=' })
  })

  it('ненульова права частина для многочлена', async () => {
    await runBoardAction({ kind: 'add_number_line', payload: { expression: 'x^2', op: '>', rhs: '4' } })
    expect(page.assets[0].data).toMatchObject({ mode: 'intervals', expression: 'x^2', rhs: '4', op: '>' })
  })

  it('невалідний вираз чи знак — людська помилка й нуль обʼєктів', async () => {
    // Дошка сама не може (x³ − 2) — питаємо сервер; він відмовив — помилка словами, нуль обʼєктів.
    api.solveNumberLine.mockResolvedValueOnce({ ok: false, reason: 'unsolvable', detail: 'точно не розвʼязується' })
    await expect(runBoardAction({ kind: 'add_number_line', payload: { expression: 'x^3 - 2', op: '>' } })).rejects.toThrow('Не можу розвʼязати нерівність')
    await expect(runBoardAction({ kind: 'add_number_line', payload: { expression: '(x-1)', op: '=' } })).rejects.toThrow('Не бачу знака нерівності')
    expect(page.assets).toHaveLength(0)
  })

  it('Інтегралик бачить вираз, відповідь і знаки', () => {
    const a = { id: 'iv', type: 'number_line', data: { version: 1, mode: 'intervals', variable: 'x', conditions: [], combine: 'and',
      expression: '(x-1)(x+3)/(x-2)', rhs: '0', op: '>=', showAnswer: true, showHatching: true } }
    expect(summarizeAsset(a)).toEqual({ kind: 'числова пряма', label: '(x-1)(x+3)/(x-2) ≥ 0' })
    expect(sceneExtras(a)).toEqual({ answer: 'x ∈ [−3; 1] ∪ (2; +∞)', quote: 'знаки: − + − +' })
  })
})

describe('«Розвʼязати» від Інтегралика (ТЗ розвʼязувача §4)', () => {
  const RESULT = {
    ok: true,
    intervals: [{ from: { latex: '1 - \\sqrt{2}', approx: -0.414, exact: true, closed: false, text: '1 − √2' },
                  to: { latex: '1 + \\sqrt{2}', approx: 2.414, exact: true, closed: false, text: '1 + √2' } }],
    points: [], domain: null, answer: 'x ∈ (1 − √2; 1 + √2)',
  }

  it('дошка сама може — метод інтервалів, сервер не питаємо', async () => {
    await runBoardAction({ kind: 'add_number_line', payload: { expression: '(x-1)(x+3)', op: '>' } })
    expect(page.assets[0].data.mode).toBe('intervals')
    expect(api.solveNumberLine).not.toHaveBeenCalled()
  })

  it('корені 1 ± √2 — точний розвʼязок сервера, режим solved', async () => {
    api.solveNumberLine.mockResolvedValueOnce({ ...RESULT, solver: 'sympy-1.13.3' })
    await runBoardAction({ kind: 'add_number_line', payload: { expression: 'x^2 - 2x - 1', op: '<', rhs: '0' } })
    expect(api.solveNumberLine).toHaveBeenCalledWith('x^2 - 2x - 1 < 0')
    expect(page.assets).toHaveLength(1)
    expect(page.assets[0].data).toMatchObject({ mode: 'solved', inequality: 'x^2 - 2x - 1 < 0', result: RESULT, solver: 'sympy-1.13.3' })
  })

  it('сервер відмовив — людська помилка й нуль обʼєктів', async () => {
    api.solveNumberLine.mockResolvedValueOnce({ ok: false, reason: 'not_pilot', detail: 'Розвʼязування нерівностей поки в пілоті.' })
    await expect(runBoardAction({ kind: 'add_number_line', payload: { expression: '√(x+1) - x + 1', op: '>' } }))
      .rejects.toThrow('Не можу розвʼязати нерівність: Розвʼязування нерівностей поки в пілоті.')
    expect(page.assets).toHaveLength(0)
  })

  it('Інтегралик бачить нерівність, відповідь і ОДЗ зі збереженого', () => {
    const B = (approx, text, closed) => ({ latex: text, approx, exact: true, closed, text })
    const a = { id: 's', type: 'number_line', data: { version: 1, mode: 'solved', variable: 'x', conditions: [], combine: 'and',
      inequality: '√(x+1) > x − 1', showAnswer: true, showHatching: true,
      result: { ok: true, intervals: [{ from: B(-1, '−1', true), to: B(3, '3', false) }], points: [], domain: 'x ≥ −1', answer: 'x ∈ [−1; 3)' } } }
    expect(summarizeAsset(a)).toEqual({ kind: 'числова пряма', label: '√(x+1) > x − 1' })
    expect(sceneExtras(a)).toEqual({ answer: 'x ∈ [−1; 3)', quote: 'ОДЗ: x ≥ −1' })
  })

  it('не пілот: дошка сама не може — відмова словами БЕЗ запиту', async () => {
    auth.user = { id: 7 }
    await expect(runBoardAction({ kind: 'add_number_line', payload: { expression: 'x^2 - 2x - 1', op: '<' } }))
      .rejects.toThrow('Не можу розвʼязати цю нерівність')
    expect(api.solveNumberLine).not.toHaveBeenCalled()
    expect(page.assets).toHaveLength(0)
  })
})
