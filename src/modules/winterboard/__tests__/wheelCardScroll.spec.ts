/**
 * Б-147 (власник 2026-10-06: «так роби, бо при роботі це реальна проблема»).
 *
 * Коли аркуш більший за екран, коліщатко над карткою з прокруткою гортало аркуш, а не текст
 * картки; з олівцем (тіла карток прозорі для подій) — теж аркуш або нічого. Тепер коліщатко
 * спершу гортає текст картки, а коли текст дійшов до кінця — аркуш.
 *
 * Правило — utils/overlayTopHit.ts; обв'язка в полі (WBCanvas.handleWheel) — сторожем по джерелу:
 * полотно в тестах не монтується. Розмітку jsdom не рахує — розміри задаємо самі.
 */
import { afterEach, describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

import { canScrollToward, cardScrollerAt, hasOwnScrollToward } from '../utils/overlayTopHit'

afterEach(() => { document.body.innerHTML = '' })

/** jsdom рахує стилі лише для елементів у документі. */
function attached<T extends HTMLElement>(el: T): T {
  document.body.appendChild(el)
  return el
}

function box(el: HTMLElement, r: { left: number; top: number; width: number; height: number }) {
  el.getBoundingClientRect = () => ({
    ...r, right: r.left + r.width, bottom: r.top + r.height, x: r.left, y: r.top, toJSON: () => r,
  }) as DOMRect
  return el
}

function scroller(el: HTMLElement, { content = 1000, view = 400, top = 0, overflow = 'auto' } = {}) {
  el.style.overflowY = overflow
  Object.defineProperty(el, 'scrollHeight', { configurable: true, value: content })
  Object.defineProperty(el, 'clientHeight', { configurable: true, value: view })
  el.scrollTop = top
  Object.defineProperty(el, 'scrollTop', { configurable: true, writable: true, value: top })
  return el
}

/** Обгортка картки як у WBOverlayLayer: div.*-overlay з data-*-id; тіло з прокруткою всередині. */
function card(id: string, at: { left: number; top: number }, z = 0, bodyOpts = {}) {
  const wrap = box(document.createElement('div'), { ...at, width: 500, height: 700 })
  wrap.className = 'wb-theory-card-overlay'
  wrap.setAttribute('data-theory-card-id', id)
  wrap.style.zIndex = String(z)
  const header = box(document.createElement('header'), { ...at, width: 500, height: 40 })
  const body = scroller(box(document.createElement('div'), { left: at.left, top: at.top + 40, width: 500, height: 660 }), bodyOpts)
  const text = box(document.createElement('p'), { left: at.left, top: at.top + 40, width: 500, height: 2000 })
  body.appendChild(text)
  wrap.append(header, body)
  return { wrap, header, body, text }
}

describe('canScrollToward — чи є куди гортати', () => {
  it('є текст нижче — вниз так, вгору ні; дійшов до кінця — навпаки', () => {
    const el = scroller(attached(document.createElement('div')))
    expect(canScrollToward(el, 0, 100)).toBe(true)
    expect(canScrollToward(el, 0, -100)).toBe(false)
    const end = scroller(attached(document.createElement('div')), { top: 600 })
    expect(canScrollToward(end, 0, 100)).toBe(false)
    expect(canScrollToward(end, 0, -100)).toBe(true)
  })

  it('без власної прокрутки (overflow hidden) чи текст уміщається — ні', () => {
    expect(canScrollToward(scroller(attached(document.createElement('div')), { overflow: 'hidden' }), 0, 100)).toBe(false)
    expect(canScrollToward(scroller(attached(document.createElement('div')), { content: 400 }), 0, 100)).toBe(false)
  })
})

describe('hasOwnScrollToward — подія з тіла картки (стрілка)', () => {
  it('з тексту всередині тіла з прокруткою — так; поле (root) не рахується', () => {
    const root = scroller(attached(document.createElement('div')))
    const { wrap, text } = card('a', { left: 0, top: 0 })
    root.appendChild(wrap)
    expect(hasOwnScrollToward(text, root, 0, 100)).toBe(true)
    expect(hasOwnScrollToward(root, root, 0, 100)).toBe(false)
  })
})

describe('cardScrollerAt — картка під курсором, коли тіло прозоре для подій (олівець)', () => {
  it('над текстом картки — її тіло', () => {
    const root = attached(document.createElement('div'))
    const c = card('a', { left: 100, top: 100 })
    root.appendChild(c.wrap)
    expect(cardScrollerAt(root, 300, 400, 0, 100)).toBe(c.body)
  })

  it('над шапкою чи поза карткою — null (гортає аркуш)', () => {
    const root = attached(document.createElement('div'))
    root.appendChild(card('a', { left: 100, top: 100 }).wrap)
    expect(cardScrollerAt(root, 300, 120, 0, 100)).toBeNull()
    expect(cardScrollerAt(root, 900, 400, 0, 100)).toBeNull()
  })

  it('текст дійшов до кінця — null: далі гортає аркуш', () => {
    const root = attached(document.createElement('div'))
    root.appendChild(card('a', { left: 100, top: 100 }, 0, { top: 600 }).wrap)
    expect(cardScrollerAt(root, 300, 400, 0, 100)).toBeNull()
    expect(cardScrollerAt(root, 300, 400, 0, -100)).not.toBeNull()
  })

  it('дві картки внахлест — гортається лише верхня; у верхньої прокрутки немає — нічого', () => {
    const root = attached(document.createElement('div'))
    const low = card('low', { left: 100, top: 100 })
    const high = card('high', { left: 150, top: 150 }, 5)
    root.append(high.wrap, low.wrap)   // вища за z-index, хоч і раніше в DOM
    expect(cardScrollerAt(root, 300, 400, 0, 100)).toBe(high.body)
    const root2 = attached(document.createElement('div'))
    const low2 = card('low', { left: 100, top: 100 })
    const flat = card('flat', { left: 150, top: 150 }, 5, { content: 300 })
    root2.append(low2.wrap, flat.wrap)
    expect(cardScrollerAt(root2, 300, 400, 0, 100)).toBeNull()
  })
})

describe('сторож обв’язки в WBCanvas.handleWheel', () => {
  const src = fs.readFileSync(path.resolve(__dirname, '../components/canvas/WBCanvas.vue'), 'utf-8')
  const start = src.indexOf('function handleWheel(e: WheelEvent): void {')
  const body = src.slice(start, src.indexOf('\n}\n', start))

  it('спершу картка — лише для звичайного коліщатка, до блоку пера й до гортання аркуша', () => {
    const first = body.indexOf('if (!e.ctrlKey && !e.metaKey && scrollCardTextFirst(e)) return')
    expect(first).toBeGreaterThan(-1)
    expect(body.indexOf('if (isZoomBlocked()) return')).toBeGreaterThan(first)
    expect(body.indexOf("emit('scroll-change', c.x, c.y)", body.indexOf('stageFollowsScroll'))).toBeGreaterThan(first)
  })

  it('картка, яку гортаємо самі, гасить подію; та, що гортає браузер, — ні', () => {
    const fn = src.slice(src.indexOf('function scrollCardTextFirst'), start)
    const native = fn.indexOf('if (hasOwnScrollToward(e.target, root, e.deltaX, e.deltaY)) return true')
    const prevent = fn.indexOf('e.preventDefault()')
    expect(native).toBeGreaterThan(-1)
    expect(prevent).toBeGreaterThan(native)
    expect(fn).toContain('el.scrollBy(')
  })
})
