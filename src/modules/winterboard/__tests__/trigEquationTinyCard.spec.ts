// Б-93 (2026-09-27): Replay на телефоні падав на «Щось пішло не так», якщо на дошці був віджет
// тригонометричних рівнянь. На крихітній картці радіус кола виходив від'ємним
// (size/2 − 44·dpr), ctx.arc кидав IndexSizeError з таймера малювання — поза будь-яким try,
// і глобальний обробник показував екран падіння всієї сторінки.
//
// Перевіряємо сам вендорний віджет у jsdom з підробленим 2D-контекстом, який поводиться як
// Chromium: arc з від'ємним радіусом кидає IndexSizeError.

import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'

type Rect = { width: number; height: number }

let arcRadii: number[] = []
let failOn: string | null = null

function fakeContext(): CanvasRenderingContext2D {
  const store: Record<string | symbol, unknown> = {}
  const noop = () => {}
  return new Proxy(store, {
    get(target, prop) {
      if (prop === 'arc') {
        return (_x: number, _y: number, r: number) => {
          arcRadii.push(r)
          if (r < 0) throw new DOMException(`The radius provided (${r}) is negative.`, 'IndexSizeError')
        }
      }
      if (failOn && prop === failOn) return () => { throw new Error(`boom in ${failOn}`) }
      if (prop === 'measureText') return () => ({ width: 10 })
      if (prop in target) return target[prop]
      return noop
    },
    set(target, prop, value) { target[prop] = value; return true },
  }) as unknown as CanvasRenderingContext2D
}

function container(rect: Rect): HTMLElement {
  const el = document.createElement('div')
  el.getBoundingClientRect = () => ({ ...rect, x: 0, y: 0, top: 0, left: 0, right: rect.width, bottom: rect.height, toJSON: () => ({}) }) as DOMRect
  document.body.appendChild(el)
  return el
}

type TrigEquationInstance = {
  destroy?: () => void
  setA: (a: number) => void
  setRel: (rel: string) => void
  setType: (type: string) => void
  hud: HTMLElement
  _layout: () => { circle: { r: number }; graph?: { y0: number } }
}
type TrigEquationCtor = new (el: HTMLElement, opts: Record<string, unknown>) => TrigEquationInstance
let TrigEquation: TrigEquationCtor

beforeAll(async () => {
  ;(globalThis as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
  HTMLCanvasElement.prototype.getContext = (() => fakeContext()) as any
  await import('../vendor/trig/index')   // штатний завантажувач вендорних віджетів (ставить window.TrigEquation)
  TrigEquation = (window as any).TrigEquation
})

describe('віджет тригонометричних рівнянь на крихітній картці (Б-93)', () => {
  let consoleError: ReturnType<typeof vi.spyOn>
  const made: Array<{ destroy?: () => void }> = []

  beforeEach(() => {
    vi.useFakeTimers()
    arcRadii = []
    failOn = null
    Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true })
    consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    while (made.length) made.pop()?.destroy?.()
    vi.useRealTimers()
    consoleError.mockRestore()
    document.body.innerHTML = ''
  })

  it('картка 30×30 на телефоні (dpr 2): жодного від\'ємного радіуса, таймери не кидають, консоль чиста', () => {
    const w = new TrigEquation(container({ width: 30, height: 30 }), { type: 'sin', rel: '=', a: 0.5, showGraph: true })
    made.push(w)
    expect(() => vi.runAllTimers()).not.toThrow()
    expect(arcRadii.length).toBeGreaterThan(0)
    expect(arcRadii.every((r) => r >= 0)).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()   // виправлено причину, а не лише зловлено помилку
  })

  it('нерівність на крихітній картці (інший шлях малювання кола) — теж без від\'ємного радіуса', () => {
    const w = new TrigEquation(container({ width: 24, height: 60 }), { type: 'cos', rel: '>', a: 0.3 })
    made.push(w)
    expect(() => vi.runAllTimers()).not.toThrow()
    expect(arcRadii.every((r) => r >= 0)).toBe(true)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('будь-який інший збій малювання не валить сторінку: віджет мовчить, у консолі — один запис', () => {
    failOn = 'fillText'
    const w = new TrigEquation(container({ width: 400, height: 400 }), { type: 'sin', a: 0.5 })
    made.push(w)
    expect(() => vi.runAllTimers()).not.toThrow()   // 4 таймери малювання
    expect(consoleError).toHaveBeenCalledTimes(1)   // не спам на кожен таймер/resize
    expect(String(consoleError.mock.calls[0][0])).toContain('[TrigEquation] render failed')
  })

  it('звичайна картка: коло малюється з додатним радіусом, як і раніше', () => {
    const w = new TrigEquation(container({ width: 800, height: 420 }), { type: 'sin', a: 0.5, showGraph: true })
    made.push(w)
    vi.runAllTimers()
    expect(Math.max(...arcRadii)).toBeGreaterThan(40)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('формула й розв’язок лишаються видимими; спалах — лише на зміну знака чи функції, не на тягання a', () => {
    const w = new TrigEquation(container({ width: 750, height: 580 }), { type: 'sin', rel: '=', a: 0.5, showGraph: true })
    made.push(w)
    vi.runAllTimers()
    expect(w.hud.querySelector('.calc-equation')?.textContent).toContain('sin x = ½')
    expect(w.hud.querySelectorAll('.calc-hud__details .calc-line').length).toBeGreaterThan(2)
    expect(w.hud.classList.contains('calc-hud--changed')).toBe(false)

    // Власник 2026-10-01: спалах, що перезапускався на кожен рух повзунка, — «як старий телевізор».
    w.setA(1)
    expect(w.hud.querySelector('.calc-equation')?.textContent).toContain('sin x = 1')
    expect(w.hud.classList.contains('calc-hud--changed')).toBe(false)
    w.setA(0.379)
    expect(w.hud.classList.contains('calc-hud--changed')).toBe(false)

    w.setRel('>=')
    expect(w.hud.querySelector('.calc-equation')?.textContent).toContain('Нерівність')
    expect(w.hud.querySelector('.calc-equation')?.textContent).toContain('≥')
    expect(w.hud.classList.contains('calc-hud--changed')).toBe(true)
    w.setType('cos')
    expect(w.hud.querySelector('.calc-equation')?.textContent).toContain('cos')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('великий верхній пояс не зменшує коло й не перекриває графік на демонстраційній картці', () => {
    const w = new TrigEquation(container({ width: 750, height: 580 }), { type: 'sin', rel: '=', a: 0.5, showGraph: true })
    made.push(w)
    // jsdom не міряє розміри DOM; підставляємо висоту великого текстового поясу.
    Object.defineProperty(w.hud, 'offsetHeight', { get: () => 150 })
    Object.defineProperty(w.hud, 'offsetTop', { get: () => 10 })
    vi.runAllTimers()
    const layout = w._layout()
    expect(layout.circle.r).toBeCloseTo(217)
    expect(layout.graph?.y0).toBeGreaterThan((10 + 150 + 14) * 2)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('sin: табличне й звичайне a — та сама кількість рядків розв’язку (шапка не стрибає)', () => {
    // Власник 2026-10-01: рядок «≡ x = (−1)ⁿ · α + πn» був лише для табличних a — під час тягання
    // з'являвся й зникав, шапка стрибала. Формула правильна для будь-якого |a| ≤ 1.
    const w = new TrigEquation(container({ width: 750, height: 580 }), { type: 'sin', rel: '=', a: 0.5, showGraph: true })
    made.push(w)
    vi.runAllTimers()
    const lines = () => [...w.hud.querySelectorAll('.calc-hud__details .calc-line')].map((n) => n.textContent ?? '')
    const table = lines()
    w.setA(0.379)
    const plain = lines()
    expect(plain.length).toBe(table.length)
    expect(plain[plain.length - 1]).toContain('(−1)ⁿ')
    expect(plain[plain.length - 1]).toContain('arcsin(0,379)')
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('коло й графік не рухаються, коли шапка на мить нижча під час тягання a', () => {
    const w = new TrigEquation(container({ width: 750, height: 580 }), { type: 'sin', rel: '=', a: 0.5, showGraph: true })
    made.push(w)
    let hudH = 150
    Object.defineProperty(w.hud, 'offsetHeight', { get: () => hudH })
    Object.defineProperty(w.hud, 'offsetTop', { get: () => 10 })
    vi.runAllTimers()
    const before = w._layout()
    hudH = 90                      // напр. «|a| > 1 → розв'язків немає» — один рядок
    w.setA(1.3)
    const during = w._layout()
    expect(during.circle.r).toBeCloseTo(before.circle.r)
    expect(during.graph?.y0).toBeCloseTo(before.graph?.y0 ?? NaN)
    w.setType('cos')               // дискретна зміна — пояс перераховується під нову шапку
    expect(w._layout().graph?.y0).toBeLessThan(before.graph?.y0 ?? 0)
    expect(consoleError).not.toHaveBeenCalled()
  })

  it('масштаб тексту враховує і ширину, і висоту картки', () => {
    const large = container({ width: 1200, height: 900 })
    made.push(new TrigEquation(large, { type: 'sin', a: 0.5 }))
    const wide = container({ width: 1200, height: 480 })
    made.push(new TrigEquation(wide, { type: 'sin', a: 0.5 }))
    vi.runAllTimers()
    expect(large.style.getPropertyValue('--trig-presentation-scale')).toBe('1.600')
    expect(wide.style.getPropertyValue('--trig-presentation-scale')).toBe('0.857')
    expect(consoleError).not.toHaveBeenCalled()
  })
})
