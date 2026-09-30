// Дотична Інтегралика на картці «Похідна» (власник 2026-09-30, «так» на пропозицію).
//
// Живий випадок: на дошці картка «Похідна: x²», учитель «побудуй дотичну в точці 2» →
// «На дошці немає об'єкта «графік»». Картка сама малює дотичну в точці P (x₀), тож
// дія — поставити P у x0 одним штатним `updateAsset`, як перетягування. Якщо P поза
// вікном — вікно під функцію разом із x0, як кнопка «вписати».
//
// Попутно: після «До якого графіка провести дотичну?» вибір несе лише графік
// (BE шле `src: ''`), і рушій падав на порожньому виразі. Тепер одна видима крива —
// вона; кілька — просимо назвати.

import { describe, it, expect, vi, beforeEach } from 'vitest'

let assets: any[] = []
const updateAsset = vi.fn((asset: any) => {
  assets = assets.map((a) => (a.id === asset.id ? asset : a))
})

vi.mock('@/modules/winterboard/board/state/boardStore', () => ({
  useWBStore: () => ({
    workspaceId: 'ws-1',
    zoom: 1,
    currentPage: { id: 'p1', width: 1920, height: 1080, get assets() { return assets } },
    addAsset: (asset: any) => { assets.push(asset) },
    updateAsset,
    selectItems: vi.fn(),
  }),
}))
vi.mock('@/modules/ship/sceneRecorder', () => ({ recordCompanionScene: vi.fn() }))
vi.mock('@/modules/winterboard/constants/nmt3dDefaults', () => ({ NMT3D_TEMPLATE_LABELS: {} }))

import { runBoardAction } from '../boardActions'

const FIT = { xMin: -5, xMax: 5, yMin: -4, yMax: 6 }

function calc(data: Record<string, unknown> = {}) {
  return {
    id: 'c1', type: 'calculus_card', x: 100, y: 100, w: 600, h: 420,
    data: { version: 1, mode: 'derivative', expr: 'x^2', x0: 1, showSecant: false,
            viewport: { cx: 0, cy: 1, fit: { ...FIT } }, ...data },
  }
}

function graph(expressions: Array<Record<string, unknown>>) {
  return {
    id: 'g1', type: 'graph_calculator', x: 0, y: 0, w: 600, h: 420,
    data: { version: 1, state: { expressions, params: {}, viewport: { cx: 0, cy: 0, scale: 38 } } },
  }
}

const tangent = (payload: Record<string, unknown>) => runBoardAction({ kind: 'graph_add_tangent', payload })
const saved = () => updateAsset.mock.calls[0][0]

beforeEach(() => {
  assets = []
  updateAsset.mockClear()
})

describe('картка «Похідна» — точка P у x0', () => {
  it('одне updateAsset: змінюється лише x0, вікно, де P видно, те саме', async () => {
    assets = [calc()]
    await tangent({ object_id: 'c1', x0: 2 })

    expect(updateAsset).toHaveBeenCalledTimes(1)
    expect(saved().data.x0).toBe(2)
    expect({ ...saved().data, x0: 1 }).toEqual(calc().data)
  })

  it('P поза вписаним вікном — вікно під функцію разом із x0', async () => {
    assets = [calc({ viewport: { cx: 0, cy: 2, fit: { xMin: -2, xMax: 2, yMin: -1, yMax: 5 } } })]
    await tangent({ object_id: 'c1', x0: 4 })

    const vp = saved().data.viewport
    expect(saved().data.x0).toBe(4)
    expect(vp.fit.xMin).toBeLessThanOrEqual(4)
    expect(vp.fit.xMax).toBeGreaterThanOrEqual(4)
    expect(vp.fit.yMax).toBeGreaterThanOrEqual(16)   // P = (4; 16) видно
    expect(vp.cx).toBeCloseTo((vp.fit.xMin + vp.fit.xMax) / 2)
    expect(vp.cy).toBeCloseTo((vp.fit.yMin + vp.fit.yMax) / 2)
  })

  it('старе вікно «центр і масштаб» (50 px на одиницю, картка 600×420): P близько — те саме, далеко — вписується', async () => {
    const old = { cx: 0, cy: 0, scale: 50 }
    assets = [calc({ viewport: old })]
    await tangent({ object_id: 'c1', x0: 1 })          // (1; 1) — у вікні
    expect(saved().data.viewport).toEqual(old)

    updateAsset.mockClear()
    assets = [calc({ viewport: old })]
    await tangent({ object_id: 'c1', x0: 3 })          // (3; 9) — вище за вікно
    expect(saved().data.viewport.fit.yMax).toBeGreaterThanOrEqual(9)
  })

  it('картка без збереженого вікна — типове 50 px на одиницю, а не «нічого не видно»', async () => {
    assets = [calc({ viewport: undefined })]
    await tangent({ object_id: 'c1', x0: 1 })
    expect(saved().data.viewport).toBeUndefined()   // (1; 1) видно й у типовому вікні
  })

  it.each([
    ['abs(x)', 0, /злам/],
    ['sqrt(x)', -1, /не визначена/],
    ['1/x', 0, /не визначена/],
  ])('де дотичної немає (%s у x = %s) — людська відмова, картку не чіпаємо', async (expr, x0, why) => {
    assets = [calc({ expr })]
    await expect(tangent({ object_id: 'c1', x0 })).rejects.toThrow(why)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('картка первісної — відмова з причиною', async () => {
    assets = [calc({ mode: 'integral', a: 0, b: 2 })]
    await expect(tangent({ object_id: 'c1', x0: 1 })).rejects.toThrow(/первісної/)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('на картці ще немає функції — відмова', async () => {
    assets = [calc({ expr: '  ' })]
    await expect(tangent({ object_id: 'c1', x0: 1 })).rejects.toThrow(/немає функції/)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('інший об\'єкт — відмова, яка називає обидва адресати', async () => {
    assets = [{ id: 'f1', type: 'formula_card', data: {} }]
    await expect(tangent({ object_id: 'f1', x0: 1 })).rejects.toThrow('лише на графіку або на картці «Похідна»')
  })
})

describe('графік після «До якого графіка провести дотичну?» (src порожній)', () => {
  it('одна видима крива — дотична до неї (прихована не рахується)', async () => {
    assets = [graph([{ id: 'e1', src: 'x^2', hidden: false }, { id: 'e2', src: 'sin(x)', hidden: true }])]
    await tangent({ object_id: 'g1', src: '', x0: 2 })

    const added = saved().data.state.expressions[2]
    expect(added.src).toBe('4*x-4')
    expect(added.label).toBe('дотична в x = 2')
  })

  it('кілька видимих кривих — просимо назвати, нічого не пишемо', async () => {
    assets = [graph([{ id: 'e1', src: 'x^2', hidden: false }, { id: 'e2', src: 'sin(x)', hidden: false }])]
    await expect(tangent({ object_id: 'g1', src: '', x0: 2 })).rejects.toThrow(/кілька кривих/)
    expect(updateAsset).not.toHaveBeenCalled()
  })

  it('кривих немає — так і кажемо', async () => {
    assets = [graph([])]
    await expect(tangent({ object_id: 'g1', src: '', x0: 2 })).rejects.toThrow(/немає кривої/)
  })

  it('названа крива — як і раніше, навіть коли кривих кілька', async () => {
    assets = [graph([{ id: 'e1', src: 'x^2', hidden: false }, { id: 'e2', src: 'sin(x)', hidden: false }])]
    await tangent({ object_id: 'g1', src: 'sin(x)', x0: 0 })
    expect(saved().data.state.expressions[2].src).toBe('x')
  })
})
