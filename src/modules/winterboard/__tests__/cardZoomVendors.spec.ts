// Картки з власним полотном на масштабі дошки (власник 2026-10-01: «як усі нормальні люди»).
//
// Скрін власника: DEMO на 35 % — коло тригонометрії стиснулось, а підписи градусів,
// радіан і значень лишились повного розміру й налізли один на одного. Як у Miro чи
// Excalidraw: масштаб дошки зменшує картку цілком; мала картка (на самій дошці)
// ховає підписи, яким бракує місця, — спершу радіани й значення.
//
// Тут — справжні рушії (коло, «Похідна», графік) з полотном, що записує малювання:
//  • набір підписів кола не залежить від масштабу показу, лише від розміру картки;
//  • жодні два підписи кутів не налазять — на будь-якому розмірі картки;
//  • вказівник на 35 % потрапляє туди, де точку видно.
import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { textBox, boxesOverlap } from '../vendor/trig/labelFit.js'

type Drawn = { text: string; x: number; y: number; font: string; align: string; baseline: string }

let current: { ctx: unknown; drawn: Drawn[] } | null = null

function recordingCtx() {
  const drawn: Drawn[] = []
  const state: Record<string, unknown> = { font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic' }
  const px = () => Number(/(\d+(?:\.\d+)?)px/.exec(String(state.font))?.[1] ?? 10)
  const ctx = new Proxy(state, {
    get(t, p: string) {
      if (p === 'fillText') {
        return (text: string, x: number, y: number) => drawn.push({
          text: String(text), x, y, font: String(t.font), align: String(t.textAlign), baseline: String(t.textBaseline),
        })
      }
      if (p === 'measureText') return (text: string) => ({ width: String(text).length * px() * 0.6 })
      if (p in t) return t[p]
      return () => undefined
    },
    set(t, p: string, v) { t[p] = v; return true },
  })
  return { ctx, drawn }
}

const dprBefore = window.devicePixelRatio
beforeAll(async () => {
  Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
  HTMLCanvasElement.prototype.getContext = function getContext() {
    return (current?.ctx ?? null) as CanvasRenderingContext2D | null
  } as unknown as typeof HTMLCanvasElement.prototype.getContext
  await import('../vendor/graph_calculator/graph-calculator.js')   // window.GraphCalc для «Похідної»
  await import('../vendor/calculus/calculus.js')
  await import('../vendor/trig/trig-circle.js')
})

const mounted: Array<{ destroy: () => void }> = []
afterEach(() => {
  while (mounted.length) { try { mounted.pop()!.destroy() } catch { /* noop */ } }
  document.body.innerHTML = ''
})

/** Картка cardW×cardH пікселів на дошці, показана з масштабом view (обгортка scale()). */
function cardBox(cardW: number, cardH: number, view: number) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { get: () => cardW })
  Object.defineProperty(container, 'clientHeight', { get: () => cardH })
  const rect = () => ({ left: 100, top: 50, x: 100, y: 50, width: cardW * view, height: cardH * view, right: 100 + cardW * view, bottom: 50 + cardH * view })
  Object.defineProperty(container, 'getBoundingClientRect', { value: rect })
  document.body.appendChild(container)
  return { container, rect }
}

function mountTrig(cardW: number, cardH: number, view: number, opts: Record<string, unknown> = {}) {
  const { container, rect } = cardBox(cardW, cardH, view)
  current = recordingCtx()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const trig: any = new (window as any).TrigCircle(container, {
    theta: 1, showDeg: true, showRad: true, showRefLabels: true, showSpecialPoints: true, showGraphs: true,
    showExactGrid: true, ...opts,
  })
  Object.defineProperty(trig.canvas, 'getBoundingClientRect', { value: rect })
  mounted.push(trig)
  current.drawn.length = 0
  trig._render()
  return { trig, drawn: current.drawn, rect }
}

/** Підпис кута: градуси («30°») або радіани («π/6»; для 0° — «0»), шрифт 600 14px. */
const isRad = (d: Drawn) => d.font.startsWith('600 14px') && (d.text.includes('π') || d.text === '0')
const isAngle = (d: Drawn) => (d.font.startsWith('600 14px') && /^\d+°$/.test(d.text)) || isRad(d)
const isValue = (d: Drawn) => /^(sin|cos) θ = /.test(d.text)
const signature = (drawn: Drawn[]) => drawn.filter((d) => isAngle(d) || isValue(d)).map((d) => d.text).sort().join('|')

describe('коло: картка на масштабі дошки — зменшена копія самої себе', () => {
  it('ті самі підписи на 35 %, 100 % і 250 % — вирішує розмір картки, не масштаб', () => {
    const at35 = signature(mountTrig(640, 360, 0.35).drawn)
    const at100 = signature(mountTrig(640, 360, 1).drawn)
    const at250 = signature(mountTrig(640, 360, 2.5).drawn)
    expect(at35).toBe(at100)
    expect(at250).toBe(at100)
  })

  it.each([[240, 160], [640, 360], [900, 500], [1280, 720]])('картка %i×%i: жодні два підписи кутів не налазять', (w, h) => {
    const angles = mountTrig(w, h, 1).drawn.filter(isAngle)
    const boxes = angles.map((d) => textBox(d.x, d.y, d.text.length * 14 * 0.6, 14, d.align, d.baseline))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(boxesOverlap(boxes[i], boxes[j]), `${angles[i].text} / ${angles[j].text}`).toBe(false)
      }
    }
  })

  it('велика картка — усе: 16 градусів, 16 радіан і значення sin/cos', () => {
    const drawn = mountTrig(1280, 720, 1).drawn
    expect(drawn.filter((d) => isAngle(d) && d.text.endsWith('°'))).toHaveLength(16)
    expect(drawn.filter(isRad)).toHaveLength(16)
    expect(drawn.filter(isValue).map((d) => d.text.slice(0, 5)).sort()).toEqual(['cos θ', 'sin θ'])
  })

  it('картка за замовчуванням (640×360) — спершу ховаються радіани й значення, градуси лишаються', () => {
    const drawn = mountTrig(640, 360, 1).drawn
    expect(drawn.filter((d) => isAngle(d) && d.text.endsWith('°'))).toHaveLength(16)
    expect(drawn.filter(isRad)).toHaveLength(0)
    expect(drawn.filter(isValue)).toHaveLength(0)
  })

  it('крихітна картка — лишаються щонайменше осі: 0°, 90°, 180°, 270°', () => {
    const texts = mountTrig(240, 160, 1).drawn.filter(isAngle).map((d) => d.text)
    expect(texts).toEqual(expect.arrayContaining(['0°', '90°', '180°', '270°']))
  })

  it.each([[240, 160], [640, 360], [1280, 720]])('картка %i×%i: підписи поділок ½, √2/2, √3/2 (13px) не налазять', (w, h) => {
    const ticks = mountTrig(w, h, 1).drawn.filter((d) => d.font.startsWith('13px') && /[½√1]/.test(d.text))
    expect(ticks.length).toBeGreaterThan(0)
    const boxes = ticks.map((d) => textBox(d.x, d.y, d.text.length * 13 * 0.6, 13, d.align, d.baseline))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j]), `${ticks[i].text} / ${ticks[j].text}`).toBe(false)
    }
  })

  it('чим більша картка, тим більше підписів (не менше)', () => {
    const count = (w: number, h: number) => mountTrig(w, h, 1).drawn.filter(isAngle).length
    const small = count(240, 160), mid = count(640, 360), big = count(1280, 720)
    expect(mid).toBeGreaterThanOrEqual(small)
    expect(big).toBeGreaterThanOrEqual(mid)
  })

  it('підписи графіка sin/cos під віссю x теж не налазять (кратні π/2 лишаються завжди)', () => {
    const xLabels = mountTrig(640, 360, 1).drawn.filter((d) => d.font.startsWith('10px'))
    const texts = xLabels.map((d) => d.text)
    expect(texts).toEqual(expect.arrayContaining(['0', 'π/2', 'π', '3π/2', '2π']))
    const boxes = xLabels.map((d) => textBox(d.x, d.y, d.text.length * 10 * 0.6, 10, d.align, d.baseline))
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j])).toBe(false)
    }
  })
})

describe('вказівник на 35 %: точка там, де її видно', () => {
  const down = (el: Element, x: number, y: number) =>
    el.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 1, bubbles: true }))
  const move = (el: Element, x: number, y: number) =>
    el.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 1, bubbles: true }))

  it('коло: тап у праву точку кола — θ = 0; у верхню — θ = π/2', () => {
    const { trig, rect } = mountTrig(640, 360, 0.35, { showGraphs: false })
    const L = trig._layout().circle
    const k = trig._lw / rect().width
    down(trig.canvas, rect().left + (L.cx + L.r) / k, rect().top + L.cy / k)
    expect(Math.min(trig.opts.theta, 2 * Math.PI - trig.opts.theta)).toBeLessThan(0.02)
    down(trig.canvas, rect().left + L.cx / k, rect().top + (L.cy - L.r) / k)
    expect(trig.opts.theta).toBeCloseTo(Math.PI / 2, 1)
  })

  it('«Похідна»: P хапається за 10 екранних px від центру і йде за пальцем до x = 2', () => {
    const { container, rect } = cardBox(480, 360, 0.35)
    current = recordingCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const card: any = new (window as any).CalculusCard(container, { mode: 'derivative', expr: 'x^2', x0: 1 })
    Object.defineProperty(card.canvas, 'getBoundingClientRect', { value: rect })
    mounted.push(card)
    card._resize()
    card.setViewport({ cx: 0, cy: 0, scale: 50 })
    const k = card._lw / rect().width
    const P = card._mathToPx(1, 1)
    down(card.canvas, rect().left + P.x / k + 10, rect().top + P.y / k)
    expect(card.canvas.style.cursor).toBe('ew-resize')   // точку, не зсув вікна
    const target = card._mathToPx(2, 4)
    move(card.canvas, rect().left + target.x / k, rect().top + target.y / k)
    expect(card.opts.x0).toBeCloseTo(2, 1)
  })

  it('графік: точка ловиться за 8 екранних px (на 100 % так і було — 10 px)', () => {
    const { container, rect } = cardBox(600, 400, 0.35)
    current = recordingCtx()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calc: any = new (window as any).GraphCalculator(container, { disableAnimation: true })
    Object.defineProperty(calc.canvas, 'getBoundingClientRect', { value: rect })
    mounted.push(calc)
    calc._resize()
    calc.setState({ expressions: [], params: {}, viewport: { cx: 0, cy: 0, scale: 38 }, points: { p1: { x: 1, y: 1, mode: 'free' } } })
    const k = calc._lw / rect().width
    const at = calc._mathToPx(1, 1)
    expect(calc._hitTestPoint(at.x + 8 * k, at.y)).toBe('p1')
    expect(calc._hitTestPoint(at.x + 14 * k, at.y)).toBe(null)
  })
})

afterEach(() => { Object.defineProperty(window, 'devicePixelRatio', { value: dprBefore, configurable: true }) })
