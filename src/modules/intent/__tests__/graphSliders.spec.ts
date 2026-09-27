// Б-14: графік із буквеними параметрами — крива з повзунками, а не порожнє полотно.
//
// Живий урок 2026-09-06: «Додай графік квадратного рівняння» → модель шле
// `Ax² + Bx + C` без значень, дія проходить, картка з'являється, крива — ні, у
// чаті «✓». Після 2026-09-25 (`engineRejects`) запис із «²» відхилявся, а з «^»
// так і лягав порожнім: рушій бачить `Ax`, `Bx`, `C` як невідомі, а повзунків
// ніхто не створював. Власник 2026-09-27: такий вираз — крива з повзунками.
//
// Інваріанти:
//  - запис моделі перекладається в синтаксис рушія (x² → x^2, · → *, − → -);
//  - злите «літера + змінна» (`Ax`) — коефіцієнт: A*x, а не невідоме `Ax`;
//  - однолітерні невідомі — повзунки (1; −10…10; 0,1 — як у самого рушія), і
//    після цього рушій вираз МАЛЮЄ (не `needsParam`);
//  - інше невідоме (`sinx`, `abx`) — чесна відмова, нічого не пишемо;
//  - повзунків на графік не більше, ніж пускає BE (`_MAX_GRAPH_PARAMS` = 4).

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

import { GraphCalc } from '@/modules/winterboard/vendor/graph_calculator/graph-calculator.js'
import { MAX_GRAPH_PARAMS, planGraphSrc, toEngineSyntax, withSliders } from '../graphTangent'
import { runBoardAction } from '../boardActions'

const SLIDER = { value: 1, min: -10, max: 10, step: 0.1 }

/** Що рушій зробить із виразом при цих повзунках. */
function engineKind(src: string, params: Record<string, unknown>): string {
  return (GraphCalc.classify(src, Object.keys(params)) as { kind: string }).kind
}

beforeEach(() => {
  assets = []
  updateAsset.mockClear()
})

describe('запис моделі → синтаксис рушія', () => {
  it('степені, множення й мінус із підручника', () => {
    expect(toEngineSyntax('Ax² + Bx + C')).toBe('Ax^2 + Bx + C')
    expect(toEngineSyntax('y = x³ − 2·x')).toBe('x^3 - 2*x')
    expect(toEngineSyntax('x⁻¹ + 3×x')).toBe('x^(-1) + 3*x')
  })
})

describe('план виразу — через сам рушій', () => {
  it('випадок уроку: Ax² + Bx + C → A*x^2 + B*x + C і повзунки A, B, C', () => {
    const plan = planGraphSrc('Ax² + Bx + C')

    expect(plan.reject).toBeNull()
    expect(plan.src).toBe('A*x^2 + B*x + C')
    expect(plan.sliders).toEqual(['A', 'B', 'C'])
  })

  it('пряма kx + b — коефіцієнт k, не невідоме kx', () => {
    const plan = planGraphSrc('kx + b')

    expect(plan.src).toBe('k*x + b')
    expect(plan.sliders).toEqual(['k', 'b'])
  })

  it('наявний параметр повзунком удруге не стає', () => {
    expect(planGraphSrc('a*x^2 + c', ['a']).sliders).toEqual(['c'])
  })

  it('звичайний вираз — без повзунків і без відмови', () => {
    expect(planGraphSrc('x^2 - x - 6')).toEqual({ src: 'x^2 - x - 6', sliders: [], reject: null })
  })

  it('незрозуміле невідоме — відмова, а не повзунки s, i, n чи пряма', () => {
    expect(planGraphSrc('sinx + 1').reject).toContain('sinx')
    expect(planGraphSrc('abx').reject).toContain('abx')
  })

  it('синтаксична помилка — як і раніше, відмова рушія', () => {
    expect(planGraphSrc("(2*x-2)'(2)").reject).not.toBeNull()
  })
})

describe('повзунки для графіка', () => {
  it('з повзунками рушій криву малює', () => {
    const planned = withSliders(['Ax² + Bx + C'], {})

    expect(planned.params).toEqual({ A: SLIDER, B: SLIDER, C: SLIDER })
    expect(engineKind(planned.srcs[0], planned.params)).toBe('explicitY')
  })

  it(`понад ${MAX_GRAPH_PARAMS} повзунки — відмова`, () => {
    expect(() => withSliders(['a*x^4 + b*x^3 + c*x^2 + d*x + f'], {})).toThrow(/щонайбільше 4 повзунки/)
  })
})

describe('шляхи запису на дошку', () => {
  it('новий графік з уроку: крива з повзунками, а не порожня картка', async () => {
    await runBoardAction({ kind: 'add_graph', payload: { expressions: [{ src: 'Ax² + Bx + C' }] } })

    expect(assets).toHaveLength(1)
    const state = assets[0].data.state
    expect(state.expressions[0].src).toBe('A*x^2 + B*x + C')
    expect(state.params).toEqual({ A: SLIDER, B: SLIDER, C: SLIDER })
    expect(engineKind(state.expressions[0].src, state.params)).toBe('explicitY')
  })

  it('параметри від моделі лишаються, бракуючі — додаються', async () => {
    const a = { value: 2, min: -5, max: 5, step: 0.5 }
    await runBoardAction({ kind: 'add_graph', payload: { expressions: [{ src: 'a*x^2 + c' }], params: { a } } })

    expect(assets[0].data.state.params).toEqual({ a, c: SLIDER })
  })

  it('незрозумілий вираз на дошку не лягає', async () => {
    await expect(runBoardAction({ kind: 'add_graph', payload: { expressions: [{ src: 'sinx + 1' }] } }))
      .rejects.toThrow(/sinx/)
    expect(assets).toHaveLength(0)
  })

  it('додана крива в наявний графік — із власними повзунками', async () => {
    assets = [{
      id: 'g1',
      type: 'graph_calculator',
      data: { state: { expressions: [{ id: 'e1', src: 'x^2' }], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } } },
    }]

    await runBoardAction({ kind: 'graph_add_expression', payload: { object_id: 'g1', src: 'kx + b' } })

    const state = assets[0].data.state
    expect(state.expressions.map((e: { src: string }) => e.src)).toEqual(['x^2', 'k*x + b'])
    expect(state.params).toEqual({ k: SLIDER, b: SLIDER })
  })

  it('заміна кривої — те саме правило', async () => {
    assets = [{
      id: 'g1',
      type: 'graph_calculator',
      data: { state: { expressions: [{ id: 'e1', src: 'x^2' }], params: {}, viewport: { cx: 0, cy: 0, scale: 38 } } },
    }]

    await runBoardAction({ kind: 'set_param', payload: { object_id: 'g1', type: 'graph_expression', value: 'y = Ax² + C' } })

    const state = assets[0].data.state
    expect(state.expressions[0].src).toBe('A*x^2 + C')
    expect(state.params).toEqual({ A: SLIDER, C: SLIDER })
  })
})
