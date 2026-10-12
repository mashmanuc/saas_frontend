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

import { KIND_LABELS, PREP_PAGE_KINDS, runBoardAction, sceneExtras, summarizeAsset } from '../boardActions'

beforeEach(() => {
  page = { id: 'p1', width: 1920, height: 1080, assets: [] }
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
      conditions: [{ op: '>', value: '√3' }] } })).rejects.toThrow('Не зрозумів нерівність')
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
