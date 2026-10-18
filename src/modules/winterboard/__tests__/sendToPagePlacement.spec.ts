/**
 * «Надіслати на сторінку» (власник 2026-10-18): біля низу екрана список відкривався вниз на
 * 280 px і нижні сторінки опинялись за краєм — не догорнути. Тепер: вниз, якщо там уміщається
 * весь список; інакше вгору аж до верху екрана; висота — не більша за вільне місце, решту гортає.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { POPOVER_EDGE, POPOVER_GAP, placeListPopover, sendToPageListHeight } from '../board/popoverPlacement'

const VH = 1000

describe('де відкрити список', () => {
  it('кнопка вгорі, місця вдосталь — вниз на весь вільний простір', () => {
    const p = placeListPopover({ top: 100, bottom: 130 }, VH, sendToPageListHeight(13))
    expect(p.top).toBe(130 + POPOVER_GAP)
    expect(p.bottom).toBeUndefined()
    expect(p.maxHeight).toBe(VH - 130 - POPOVER_GAP - POPOVER_EDGE)
  })

  it('кнопка біля низу (як на скриншоті власника) — вгору, аж до верху екрана', () => {
    const p = placeListPopover({ top: 860, bottom: 890 }, VH, sendToPageListHeight(13))
    expect(p.top).toBeUndefined()
    expect(p.bottom).toBe(VH - 860 + POPOVER_GAP)
    expect(p.maxHeight).toBe(860 - POPOVER_GAP - POPOVER_EDGE)
    // 13 сторінок уміщаються повністю — прокрутка не потрібна
    expect(p.maxHeight).toBeGreaterThan(sendToPageListHeight(13))
  })

  it('короткий список, що вміщається внизу, — вниз навіть біля низу', () => {
    const p = placeListPopover({ top: 860, bottom: 890 }, VH, sendToPageListHeight(2))
    expect(p.top).toBe(890 + POPOVER_GAP)
  })

  it('дуже довгий список — висота в межах екрана, решту гортає прокрутка', () => {
    const p = placeListPopover({ top: 860, bottom: 890 }, VH, sendToPageListHeight(200))
    expect(p.maxHeight).toBeLessThan(sendToPageListHeight(200))
    expect(p.maxHeight).toBeLessThanOrEqual(VH)
  })
})

describe('WBSelectionToolbar користується цим правилом', () => {
  const src = readFileSync(resolve(__dirname, '../components/canvas/WBSelectionToolbar.vue'), 'utf-8')
  it('відкриття рахує місце, стиль ставить top або bottom і maxHeight', () => {
    expect(src).toMatch(/placeListPopover\(rect, vh, sendToPageListHeight\(props\.pages\?\.length \?\? 0\)\)/)
    expect(src).toMatch(/a\.top !== undefined \? \{ top: `\$\{a\.top\}px` \} : \{ bottom: `\$\{a\.bottom\}px` \}/)
    expect(src).toMatch(/maxHeight: `\$\{a\.maxHeight\}px`/)
  })
})
