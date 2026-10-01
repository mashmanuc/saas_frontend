// Підписи, яким бракує місця, ховаємо, а не тиснемо (власник 2026-10-01, `vendor/trig/labelFit.js`).
import { describe, it, expect } from 'vitest'
import { boxesOverlap, firstFittingVariant, fitLabelGroups, textBox } from '../vendor/trig/labelFit.js'

describe('textBox — рамка за вирівнюванням canvas', () => {
  it.each([
    ['left', 'top', { left: 100, top: 50, right: 140, bottom: 60 }],
    ['right', 'bottom', { left: 60, top: 40, right: 100, bottom: 50 }],
    ['center', 'middle', { left: 80, top: 45, right: 120, bottom: 55 }],
  ])('%s / %s', (align, baseline, want) => {
    expect(textBox(100, 50, 40, 10, align, baseline)).toEqual(want)
  })
})

describe('boxesOverlap', () => {
  const a = { left: 0, top: 0, right: 10, bottom: 10 }
  it('торкання без проміжку — ще не налазять, з проміжком — уже так', () => {
    const b = { left: 10, top: 0, right: 20, bottom: 10 }
    expect(boxesOverlap(a, b)).toBe(false)
    expect(boxesOverlap(a, b, 2)).toBe(true)
  })
  it('рознесені по вертикалі не налазять', () => {
    expect(boxesOverlap(a, { left: 0, top: 30, right: 10, bottom: 40 }, 2)).toBe(false)
  })
})

describe('firstFittingVariant — найповніший варіант без накладань', () => {
  const ok = { name: 'ok', boxes: [{ left: 0, top: 0, right: 10, bottom: 10 }, { left: 20, top: 0, right: 30, bottom: 10 }] }
  const clash = { name: 'clash', boxes: [{ left: 0, top: 0, right: 10, bottom: 10 }, { left: 5, top: 0, right: 15, bottom: 10 }] }
  it('перший, що поміщається', () => {
    expect(firstFittingVariant([clash, ok], 0)).toBe(ok)
  })
  it('жоден не поміщається — найскупіший (останній)', () => {
    expect(firstFittingVariant([clash, clash], 0)).toBe(clash)
  })
})

describe('fitLabelGroups — групи від найважливішої, як autoSkip', () => {
  const g0 = [{ left: 0, top: 0, right: 10, bottom: 10 }]
  const g1 = [{ left: 30, top: 0, right: 40, bottom: 10 }]
  const g2clash = [{ left: 5, top: 0, right: 12, bottom: 10 }]
  const g3 = [{ left: 60, top: 0, right: 70, bottom: 10 }]
  it('бере поспіль, доки нова група не налізе; після першої відмови — далі не бере', () => {
    expect(fitLabelGroups([g0, g1, g2clash, g3], 0)).toBe(2)
  })
  it('перша група — завжди, навіть якщо налазить сама на себе; далі — за загальним правилом', () => {
    expect(fitLabelGroups([[...g0, ...g2clash]], 0)).toBe(1)
    expect(fitLabelGroups([[...g0, ...g2clash], g1], 0)).toBe(2)
    expect(fitLabelGroups([[...g0, ...g2clash], [{ left: 8, top: 0, right: 9, bottom: 10 }]], 0)).toBe(1)
  })
})
