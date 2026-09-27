/**
 * Розкладка вікна Інтегралика — TABLET 2А + 3А + 3Б (рішення власника 2026-09-27).
 * Макети й причини: `saas_docs/feedback/TABLET_VARIANTS_2026-09-27.md`.
 */
import { describe, expect, it } from 'vitest'

import { dockBox, keyboardInset, resolvePaletteLayout, shouldAutofocus } from '../paletteLayout'

const base = { narrow: false, touch: false, wide: false, onBoard: false, keyboard: false }

describe('resolvePaletteLayout', () => {
  it('телефон — завжди лист знизу, як і було', () => {
    expect(resolvePaletteLayout({ ...base, narrow: true })).toBe('sheet')
    expect(resolvePaletteLayout({ ...base, narrow: true, touch: true, onBoard: true })).toBe('sheet')
  })

  it('планшет в альбомі на дошці — панель праворуч (2А)', () => {
    expect(resolvePaletteLayout({ ...base, touch: true, wide: true, onBoard: true })).toBe('dock')
  })

  it('планшет у портреті на дошці — лист знизу', () => {
    expect(resolvePaletteLayout({ ...base, touch: true, wide: false, onBoard: true })).toBe('sheet')
  })

  it('планшет поза дошкою — вікно, а з клавіатурою — лист над нею (3А)', () => {
    expect(resolvePaletteLayout({ ...base, touch: true, wide: true })).toBe('float')
    expect(resolvePaletteLayout({ ...base, touch: true, wide: true, keyboard: true })).toBe('sheet')
  })

  it('комп\'ютер (миша) — як і було, вікно, навіть на дошці й на широкому екрані', () => {
    expect(resolvePaletteLayout({ ...base, wide: true, onBoard: true })).toBe('float')
    expect(resolvePaletteLayout({ ...base, onBoard: true })).toBe('float')
  })
})

describe('keyboardInset', () => {
  it('клавіатура — висота прихованої частини екрана', () => {
    expect(keyboardInset(800, 330, 0)).toBe(470)
  })
  it('рядок адреси (менше 90 px) — не клавіатура', () => {
    expect(keyboardInset(800, 744, 0)).toBe(0)
  })
  it('враховує прокручену видиму частину', () => {
    expect(keyboardInset(800, 330, 100)).toBe(370)
  })
})

describe('dockBox', () => {
  it('без клавіатури — на висоту полотна дошки', () => {
    expect(dockBox({ top: 112, bottom: 752 }, 800, 0)).toEqual({ top: 112, bottom: 48 })
  })
  it('з клавіатурою — рівно у видимій частині над нею', () => {
    expect(dockBox({ top: 112, bottom: 752 }, 800, 470, 0)).toEqual({ top: 0, bottom: 470 })
    expect(dockBox({ top: 112, bottom: 752 }, 800, 370, 100)).toEqual({ top: 100, bottom: 370 })
  })
  it('без полотна — на весь екран', () => {
    expect(dockBox(null, 800, 0)).toEqual({ top: 0, bottom: 0 })
  })
})

describe('shouldAutofocus (3Б)', () => {
  it('сенсорний екран — поле без фокусу, щоб не відкривати клавіатуру', () => {
    expect(shouldAutofocus(true)).toBe(false)
  })
  it('миша й клавіатура — фокус як і був', () => {
    expect(shouldAutofocus(false)).toBe(true)
  })
})
