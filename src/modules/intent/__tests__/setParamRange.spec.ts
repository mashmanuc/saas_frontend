/**
 * Живий прогін власника 2026-08-15 — `set_param` більше не клемпить мовчки.
 *
 * Що було видно на екрані: «зроби коефіцієнт a п'ятіркою» при діапазоні
 * повзунка [-3; 3] → Інтегралик пише «Виконано: Ставлю параметр a = 5»,
 * на панелі лишається старе значення. Помилки немає ніде.
 *
 * Чому повідомленням це не лікується: рядок «Виконано: …» бере explain,
 * складений BE ДО виконання (`CommandPalette.executeAi`), а повернене
 * обробником значення нікуди не йде. Отже або дія робить те, що сказано,
 * або звіт бреше — третього немає.
 *
 * Межі повзунка — зручність UI, не математика. Тому обробник розсовує
 * порушену межу й ставить значення, яке просили.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const updateAsset = vi.fn()

function graph(params: Record<string, any>) {
  return { id: 'g1', type: 'graph_calculator',
           data: { state: { expressions: [{ id: 'e1', src: 'a*x^2 + b' }],
                            params, viewport: { cx: 0, cy: 0, scale: 38 } } } }
}

const PARAMS = {
  a: { value: 1, min: -3, max: 3, step: 0.1 },
  b: { value: 0, min: -3, max: 3, step: 0.1 },
}

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    currentPage: { id: 'p1', assets: [graph(JSON.parse(JSON.stringify(PARAMS)))] },
    updateAsset,
  }),
}))

import { runBoardAction } from '../boardActions'

const setParam = (value: any, name = 'a') =>
  runBoardAction({ kind: 'set_param',
                   payload: { object_id: 'g1', type: 'graph_param', name, value } })

const written = () => updateAsset.mock.calls[0][0].data.state.params

describe('set_param: значення поза межами повзунка', () => {
  beforeEach(() => updateAsset.mockReset())

  it('ставить саме те, що просили, розсунувши межу', async () => {
    await setParam(5)
    expect(written().a.value, 'значення клемпнуто — звіт «a = 5» бреше').toBe(5)
    expect(written().a.max).toBe(5)
    expect(written().a.min, 'протилежну межу чіпати не було потреби').toBe(-3)
  })

  it('те саме вниз', async () => {
    await setParam(-7.4)
    expect(written().a.value).toBe(-7.4)
    expect(written().a.min, 'округлення назовні, щоб значення влізло').toBe(-8)
    expect(written().a.max).toBe(3)
  })

  it('значення в межах не рухає діапазон', async () => {
    await setParam(2.5)
    expect(written().a).toEqual({ value: 2.5, min: -3, max: 3, step: 0.1 })
  })

  it('крок і сусідні параметри лишаються недоторканими', async () => {
    await setParam(5)
    expect(written().a.step).toBe(0.1)
    expect(written().b).toEqual(PARAMS.b)
  })

  it('абсурдне значення — чесна відмова, а не мовчазний no-op', async () => {
    await expect(setParam(1e9)).rejects.toThrow(/завелике/)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('параметра немає — відмова називає, що робити', async () => {
    await expect(setParam(1, 'zzz')).rejects.toThrow(/повзунок|немає/)
  })

  it('не число — відмова', async () => {
    await expect(setParam('п\'ять')).rejects.toThrow()
  })
})
