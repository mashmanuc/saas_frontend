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
//  - інше невідоме (`abx`) — чесна відмова, нічого не пишемо. `sinx` з 2026-09-29 рушій сам читає
//    як sin(x) (калькулятор «як у Desmos», FE 9bee2835) — крива без повзунків s, i, n;
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
import { extractParamsFromAll } from '@/modules/winterboard/utils/graphCalculatorUtils'
import { MAX_GRAPH_PARAMS, planGraphSrc, toEngineSyntax, withSliders } from '../graphTangent'
import { runBoardAction } from '../boardActions'

const SLIDER = { value: 1, min: -10, max: 10, step: 0.1 }

/** Що рушій зробить із виразом при цих повзунках. */
function engineKind(src: string, params: Record<string, unknown>): string {
  return (GraphCalc.classify(src, Object.keys(params)) as { kind: string }).kind
}

/** Значення кривої в точці — тим самим рушієм, що малює (повзунки = 1). */
function valueAt(src: string, sliders: string[], x: number): number {
  const env = { ...(GraphCalc as any).CONSTS, ...Object.fromEntries(sliders.map((n) => [n, 1])), x }
  return (GraphCalc as any).evalAst((GraphCalc as any).parse(src), env) as number
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

  it('незрозуміле невідоме — відмова, а не повзунки чи пряма', () => {
    expect(planGraphSrc('abx').reject).toContain('abx')
    expect(planGraphSrc('abx + 1').reject).toContain('abx')
  })

  it('sinx — це sin(x), як у Desmos (2026-09-29): крива без повзунків s, i, n і без відмови', () => {
    expect(planGraphSrc('sinx + 1')).toEqual({ src: 'sinx + 1', sliders: [], reject: null })
  })

  it('синтаксична помилка — як і раніше, відмова рушія', () => {
    expect(planGraphSrc("(2*x-2)'(2)").reject).not.toBeNull()
  })

  // Рецензія 2026-09-27: без дужок `e^kx` ставало (e^k)·x, `1/kx` — x/k —
  // крива будувалась ХИБНО, а не порожньо. Звіряємо значення, а не рядок.
  it.each([
    ['e^kx', 2, Math.exp(2)],
    ['2^ax', 3, 8],
    ['1/kx', 2, 0.5],
    ['Ax^2 + Bx + C', 2, 7],
    ['2ax + b', 2, 5],
    ['0.5ax^2', 2, 2],
    ['x^2 + 2ax', 2, 8],
    ['sin(πx)', 0.5, 1],
  ])('%s у x = %s — те, що мав на увазі вчитель', (src, x, expected) => {
    const plan = planGraphSrc(src as string)

    expect(plan.reject).toBeNull()
    expect(valueAt(plan.src, plan.sliders, x as number)).toBeCloseTo(expected as number, 9)
  })

  it('`t` рушій тримає для себе — відмова, а не повзунок, який param-sync прибере', () => {
    expect(planGraphSrc('3t^2').reject).toContain('«t»')
    expect(planGraphSrc('sin(x - t)').reject).toContain('«t»')
  })

  it('злите з літерою рушія (`ex`) — відмова, а не тиха пряма e·x без повзунка', () => {
    // Розбиваємо злите лише тоді, коли з першої літери вийде повзунок; `e` — стала.
    expect(planGraphSrc('ex + 1').reject).toContain('«ex»')
  })

  it('кожен новий повзунок param-sync визнає параметром (інакше прибрав би разом із кривою)', () => {
    for (const src of ['Ax² + Bx + C', 'kx + b', 'e^kx', 'x^2 + y^2 = r^2', 'a*sin(b*x)']) {
      const plan = planGraphSrc(src)
      expect(extractParamsFromAll([plan.src]), src).toEqual(expect.arrayContaining(plan.sliders))
    }
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

  it('стеля — лише на НОВІ повзунки: п\'ять власних повзунків учителя не блокують криву без літер', () => {
    const own = { a: SLIDER, b: SLIDER, c: SLIDER, d: SLIDER, f: SLIDER }

    const planned = withSliders(['x^2'], own)

    expect(planned.srcs).toEqual(['x^2'])
    expect(planned.params).toEqual(own)
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
    await expect(runBoardAction({ kind: 'add_graph', payload: { expressions: [{ src: 'abx + 1' }] } }))
      .rejects.toThrow(/abx/)
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

  it('заміна кривої: повзунки лише старої кривої йдуть, сусідньої — лишаються', async () => {
    assets = [{
      id: 'g1',
      type: 'graph_calculator',
      data: { state: {
        expressions: [{ id: 'e1', src: 'A*x^2 + B*x' }, { id: 'e2', src: 'x + C' }],
        params: { A: SLIDER, B: SLIDER, C: SLIDER },
        viewport: { cx: 0, cy: 0, scale: 38 },
      } },
    }]

    // Рецензія 2026-09-27: A, B, C + k, b = 5 → хибна відмова «щонайбільше 4».
    await runBoardAction({ kind: 'set_param', payload: { object_id: 'g1', type: 'graph_expression', value: 'kx + b' } })

    const state = assets[0].data.state
    expect(state.expressions.map((e: { src: string }) => e.src)).toEqual(['k*x + b', 'x + C'])
    expect(state.params).toEqual({ C: SLIDER, k: SLIDER, b: SLIDER })
  })
})
