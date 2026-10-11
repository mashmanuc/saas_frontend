/**
 * «Прямокутний трикутник» + «Описане»: центр кола O і середина гіпотенузи M — одна точка.
 * Раніше обидві мали підпис зі зсувом за замовчуванням (вгору-праворуч) і лягали одна на одну
 * та на підпис гіпотенузи «c=…» — темна пляма замість букв (видно на дошці в усіх учителів;
 * знайдено на огляді лендінгу 2026-10-11). Тепер підпис один — «O», усередині трикутника.
 *
 * Справжній рушій (geo2d.js + пресети + картка), як у geo2dViewStableOnToggle.spec.ts.
 */
import { beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => {
  ;(globalThis as any).ResizeObserver ??= class { observe() {} disconnect() {} unobserve() {} }
  await import('../vendor/geo2d')
})

function makeCard(type: string) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const card = new (window as any).GeoCard(el, { type })
  return { el, card }
}

function labels(el: HTMLElement) {
  return [...el.querySelectorAll('svg text')].map((t) => ({
    text: (t.textContent || '').trim(),
    x: Number(t.getAttribute('x')),
    y: Number(t.getAttribute('y')),
  }))
}

describe('geo2d: прямокутний трикутник з описаним колом — підписи не накладаються', () => {
  it('рівно один підпис «O», підпису «M» немає', () => {
    const { el, card } = makeCard('right_triangle')
    card.setToggle('circumcircle', true)
    const all = labels(el)
    expect(all.filter((l) => l.text === 'O')).toHaveLength(1)
    expect(all.filter((l) => l.text === 'M')).toHaveLength(0)
  })

  it('«O» не лежить на підписі гіпотенузи «c=…»', () => {
    const { el, card } = makeCard('right_triangle')
    card.setToggle('circumcircle', true)
    const all = labels(el)
    const o = all.find((l) => l.text === 'O')!
    const c = all.find((l) => l.text.startsWith('c='))!
    expect(o).toBeTruthy()
    expect(c).toBeTruthy()
    // Підписи — ~11–13 px; вони не можуть стояти ближче, ніж на висоту рядка
    expect(Math.hypot(o.x - c.x, o.y - c.y)).toBeGreaterThan(18)
  })

  it('інші пресети з «Описане» не змінились: у звичайного трикутника підпис центру лишається', () => {
    const { el, card } = makeCard('triangle')
    card.setToggle('circumcircle', true)
    expect(labels(el).some((l) => l.text === 'O')).toBe(true)
  })
})
