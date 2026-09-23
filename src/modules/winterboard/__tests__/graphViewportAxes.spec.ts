/**
 * Окремі масштаби осей і вписане вікно (TZ_GRAPH_VIEWPORT_AUTOFIT_2026-09-22 §3.1, §5.4, §5.6).
 *
 * Головне, що тут стережемо: стара дошка `{cx, cy, scale: 38}` читається й
 * ЗБЕРІГАЄТЬСЯ рівно в тій самій формі — інакше кожне відкриття старої дошки
 * породжувало б asset_update з «новим» вікном.
 */
import { describe, expect, it } from 'vitest'

// happy-dom не має 2D-контексту — даємо заглушку, як у GraphCalculatorParamDetect.
const CANVAS_2D_STUB = new Proxy({ measureText: () => ({ width: 0 }) } as Record<string, unknown>, {
  get: (target, prop) => (prop in target ? target[prop as string] : () => undefined),
  set: () => true,
})
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = function getContext(kind: string) {
    return kind === '2d' ? (CANVAS_2D_STUB as unknown as CanvasRenderingContext2D) : null
  } as typeof HTMLCanvasElement.prototype.getContext
}

import { GraphCalculator, GraphViewportIO } from '../vendor/graph_calculator/graph-calculator.js'
import { graphViewportFor } from '../utils/graphAutofit'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeEngine(width = 600, height = 400): any {
  const container = document.createElement('div')
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width, height, x: 0, y: 0 }),
  })
  document.body.appendChild(container)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calc: any = new GraphCalculator(container, { disableAnimation: true })
  calc._resize()
  return calc
}

const state = (viewport: unknown) => ({
  expressions: [{ id: 'e1', src: 'y = x^3 - 9*x^2 - 216*x', color: '#c00', hidden: false }],
  params: {},
  viewport,
})

describe('читання й запис вікна', () => {
  it('стара форма {cx, cy, scale} → scaleX = scaleY = scale і назад БЕЗ нових полів', () => {
    const calc = makeEngine()
    calc.setState(state({ cx: 1, cy: -2, scale: 38 }))
    expect(calc.viewport).toEqual({ cx: 1, cy: -2, scaleX: 38, scaleY: 38 })
    expect(calc.getState().viewport).toEqual({ cx: 1, cy: -2, scale: 38 })
  })

  it('без scale — типове 38 (як і раніше)', () => {
    const { viewport } = GraphViewportIO.readViewport({ cx: 0, cy: 0 })
    expect(viewport).toEqual({ cx: 0, cy: 0, scaleX: 38, scaleY: 38 })
  })

  it('scaleX ≠ scaleY зберігаються обидва, `scale` лишається для старих читачів', () => {
    const calc = makeEngine()
    calc.setState(state({ cx: 0, cy: 0, scaleX: 20, scaleY: 0.5 }))
    expect(calc.getState().viewport).toEqual({ cx: 0, cy: 0, scale: 20, scaleX: 20, scaleY: 0.5 })
  })
})

describe('перетворення координат зі scaleX ≠ scaleY', () => {
  it('math → px → math — тотожність; осі масштабуються незалежно', () => {
    const calc = makeEngine(600, 400)
    calc.setState(state({ cx: 5, cy: 100, scaleX: 20, scaleY: 0.5 }))
    const p = calc._mathToPx(10, 300)
    expect(p.x).toBeCloseTo(300 + (10 - 5) * 20)
    expect(p.y).toBeCloseTo(200 - (300 - 100) * 0.5)
    const m = calc._pxToMath(p.x, p.y)
    expect(m.x).toBeCloseTo(10)
    expect(m.y).toBeCloseTo(300)
  })

  it('зум колесом — пропорційно: відношення осей зберігається, точка під курсором на місці', () => {
    const calc = makeEngine()
    calc.setState(state({ cx: 0, cy: 0, scaleX: 20, scaleY: 0.5 }))
    const before = calc._pxToMath(450, 100)
    calc._zoomAt(450, 100, 1.4)
    expect(calc.viewport.scaleX / calc.viewport.scaleY).toBeCloseTo(40)
    expect(calc.viewport.scaleX).toBeCloseTo(28)
    const after = calc._pxToMath(450, 100)
    expect(after.x).toBeCloseTo(before.x)
    expect(after.y).toBeCloseTo(before.y)
  })
})

describe('вписане вікно (fit)', () => {
  const fit = { xMin: -15, xMax: 25, yMin: -2500, yMax: 1000 }

  it('діапазон заповнює полотно будь-якого розміру; зберігається сам діапазон', () => {
    for (const [w, h] of [[600, 400], [300, 500]]) {
      const calc = makeEngine(w, h)
      calc.setState(state({ cx: 5, cy: -750, fit }))
      const tl = calc._pxToMath(0, 0)
      const br = calc._pxToMath(w, h)
      expect(tl.x).toBeCloseTo(-15); expect(br.x).toBeCloseTo(25)
      expect(tl.y).toBeCloseTo(1000); expect(br.y).toBeCloseTo(-2500)
      // `scale` поруч із `fit` обов'язковий — без нього бекенд відхиляв op
      // (FIRST USER GATE 2026-09-23, блокер №1). Тут раніше стояло рівно
      // `{ cx, cy, fit }`, тобто тест закріплював саме зламану форму.
      const saved = calc.getState().viewport
      expect(saved).toMatchObject({ cx: 5, cy: -750, fit })
      expect(Number.isFinite(saved.scale)).toBe(true)
    }
  })

  it('після пану — зберігаються масштаби, не діапазон', () => {
    const calc = makeEngine()
    calc.setState(state({ cx: 5, cy: -750, fit }))
    calc._zoomAt(300, 200, 1.2)
    const vp = calc.getState().viewport
    expect(vp.fit).toBeUndefined()
    expect(vp.scaleX).toBeCloseTo((600 / 40) * 1.2)
    expect(vp.scaleY).toBeCloseTo((400 / 3500) * 1.2)
  })

  it('«додому» — старе типове вікно', () => {
    const calc = makeEngine()
    calc.setState(state({ cx: 5, cy: -750, fit }))
    ;(calc.zoomBox.querySelector('[data-z="home"]') as HTMLButtonElement).click()
    expect(calc.getState().viewport).toEqual({ cx: 0, cy: 0, scale: 38 })
  })

  it('кнопка «вписати» видима лише з setFitEnabled(true) і кличе onFitRequest', () => {
    const calc = makeEngine()
    const btn = calc.zoomBox.querySelector('[data-z="fit"]') as HTMLButtonElement
    expect(btn.style.display).toBe('none')
    calc.setFitEnabled(true)
    expect(btn.style.display).toBe('')
    let calls = 0
    calc.onFitRequest = () => { calls++ }
    btn.click()
    expect(calls).toBe(1)
  })

  it('битий fit (min ≥ max, NaN) ігнорується — лишається scale', () => {
    const calc = makeEngine()
    calc.setState(state({ cx: 0, cy: 0, scale: 38, fit: { xMin: 3, xMax: 3, yMin: 0, yMax: 1 } }))
    expect(calc.getState().viewport).toEqual({ cx: 0, cy: 0, scale: 38 })
  })
})

describe('add_graph: вікно пишеться один раз при вставці', () => {
  it('x³ − 9x² − 216x → fit з обома екстремумами', () => {
    const vp = graphViewportFor(['x^3 - 9*x^2 - 216*x'], {})
    expect(vp.fit).toBeDefined()
    expect(vp.fit!.yMin).toBeLessThan(-2160)
    expect(vp.fit!.yMax).toBeGreaterThan(756)
    expect(vp.fit!.xMin).toBeLessThan(-10.9)
    expect(vp.fit!.xMax).toBeGreaterThan(19.9)
  })

  it('параметри беруться зі стану графіка {value, min, max, step}', () => {
    const vp = graphViewportFor(['a*x^2 - 4'], { a: { value: 100, min: 0, max: 200, step: 1 } })
    expect(vp.fit!.xMin).toBeLessThan(-0.2)
    expect(vp.fit!.xMax).toBeGreaterThan(0.2)
    expect(vp.fit!.xMax).toBeLessThan(10)
  })

  it('немає явних функцій → старе типове вікно', () => {
    expect(graphViewportFor(['x^2 + y^2 = 9'], {})).toEqual({ cx: 0, cy: 0, scale: 38 })
  })
})

describe('підписи поділок', () => {
  it('сотні й тисячі — звичайними числами, дроби — без хвоста', () => {
    const f = GraphViewportIO.formatTick
    expect(f(500, 500)).toBe('500')
    expect(f(-2000, 500)).toBe('-2000')
    expect(f(0.30000000000000004, 0.1)).toBe('0.3')
    expect(f(0, 1)).toBe('')
    expect(f(200000, 100000)).toBe('2.0e+5')
  })
})

describe('картка похідної: те саме вікно', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function makeCard(): Promise<any> {
    await import('../vendor/calculus')
    const el = document.createElement('div')
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, width: 480, height: 360, x: 0, y: 0 }),
    })
    document.body.appendChild(el)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Card = (window as any).CalculusCard
    const card = new Card(el, { mode: 'derivative', expr: 'x^3 - 9*x^2 - 216*x', x0: 1 })
    card._resize()
    return card
  }

  it('стара {cx, cy, scale: 50} читається й пишеться без змін', async () => {
    const card = await makeCard()
    card.setViewport({ cx: 1, cy: 2, scale: 50 })
    expect(card.getViewport()).toEqual({ cx: 1, cy: 2, scale: 50 })
  })

  it('fit: P = (1, −224) у вікні, після зуму — масштаби', async () => {
    const card = await makeCard()
    card.setViewportFit({ xMin: -15, xMax: 25, yMin: -2500, yMax: 1000 })
    const p = card._mathToPx(1, -224)
    expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(card.canvas.width)
    expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(card.canvas.height)
    expect(card.getViewport().fit).toBeDefined()
    card._zoomAt(10, 10, 2)
    const vp = card.getViewport()
    expect(vp.fit).toBeUndefined()
    expect(vp.scaleX / vp.scaleY).toBeCloseTo((480 / 40) / (360 / 3500))
  })
})
