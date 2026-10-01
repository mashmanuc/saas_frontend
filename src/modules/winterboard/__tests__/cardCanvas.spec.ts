// Полотно картки на масштабі дошки (власник 2026-10-01, `vendor/cardCanvas.js`).
// Розмітка — у пікселях картки (clientWidth), роздільність — від масштабу показу,
// екранні пікселі вказівника → логічні.
import { describe, it, expect, afterEach } from 'vitest'
import { CARD_CANVAS_MAX_SIDE, fitCardCanvas, toCanvasPx } from '../vendor/cardCanvas.js'

function box(cardW: number, cardH: number, view: number) {
  const container = document.createElement('div')
  Object.defineProperty(container, 'clientWidth', { get: () => cardW })
  Object.defineProperty(container, 'clientHeight', { get: () => cardH })
  Object.defineProperty(container, 'getBoundingClientRect', {
    value: () => ({ left: 10, top: 20, width: cardW * view, height: cardH * view, x: 10, y: 20 }),
  })
  const canvas = document.createElement('canvas')
  Object.defineProperty(canvas, 'getBoundingClientRect', {
    value: () => ({ left: 10, top: 20, width: cardW * view, height: cardH * view, x: 10, y: 20 }),
  })
  const calls: number[][] = []
  const ctx = { setTransform: (...a: number[]) => { calls.push(a) } }
  return { container, canvas, ctx, calls }
}

const dprBefore = window.devicePixelRatio
afterEach(() => { Object.defineProperty(window, 'devicePixelRatio', { value: dprBefore, configurable: true }) })

describe('fitCardCanvas', () => {
  it('логічне полотно — від розміру картки, не екрана: на 35 % те саме, що на 100 %', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    const at100 = box(640, 360, 1)
    const at35 = box(640, 360, 0.35)
    const a = fitCardCanvas(at100.container, at100.canvas, at100.ctx)
    const b = fitCardCanvas(at35.container, at35.canvas, at35.ctx)
    expect([a.lw, a.lh]).toEqual([1280, 720])
    expect([b.lw, b.lh]).toEqual([1280, 720])
    expect(b.view).toBeCloseTo(0.35)
    // CSS-розмір полотна — картка; обгортку масштабує WBCanvas
    expect([at35.canvas.style.width, at35.canvas.style.height]).toEqual(['640px', '360px'])
  })

  it('фізична роздільність — логічна × масштаб показу; трансформація переводить логічні в фізичні', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
    const z = box(600, 400, 2.5)
    fitCardCanvas(z.container, z.canvas, z.ctx)
    expect([z.canvas.width, z.canvas.height]).toEqual([1500, 1000])
    expect(z.calls[z.calls.length - 1]).toEqual([2.5, 0, 0, 2.5, 0, 0])
  })

  it('стеля 4096 px на сторону — і на великому масштабі полотно не роздувається', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    const big = box(1600, 900, 3)
    fitCardCanvas(big.container, big.canvas, big.ctx)
    expect(Math.max(big.canvas.width, big.canvas.height)).toBe(CARD_CANVAS_MAX_SIDE)
  })

  it('clientWidth 0 (happy-dom, display:none) — як раніше, з прямокутника', () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 1, configurable: true })
    const container = document.createElement('div')
    Object.defineProperty(container, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 600, height: 400 }) })
    const canvas = document.createElement('canvas')
    const r = fitCardCanvas(container, canvas, null)
    expect([r.lw, r.lh, r.view]).toEqual([600, 400, 1])
    expect([canvas.width, canvas.height]).toEqual([600, 400])
  })
})

describe('toCanvasPx', () => {
  it('екранний піксель → логічні: на 35 % один екранний = 1/0,35 пікселя картки × dpr', () => {
    const z = box(640, 360, 0.35)
    expect(toCanvasPx(z.canvas, 1280, 2)).toBeCloseTo(1280 / (640 * 0.35))
  })
  it('полотна не видно (ширина 0) — запасний множник', () => {
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'getBoundingClientRect', { value: () => ({ left: 0, top: 0, width: 0, height: 0 }) })
    expect(toCanvasPx(canvas, 1280, 2)).toBe(2)
  })
})
