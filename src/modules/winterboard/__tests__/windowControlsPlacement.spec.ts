/**
 * INV-WIN-6: група «— ⛶ ×» — у правому верхньому куті картки.
 *
 * 2026-09-24 (власник): зовні збоку кнопки висіли «як апендицити» — тепер у
 * ШАПЦІ картки, праворуч, без рамки. Незалежно від місця навколо картки.
 */
import { describe, it, expect } from 'vitest'
import {
  windowControlsPlacement,
  WINDOW_CONTROLS_INSET_PX,
  WINDOW_CONTROLS_TOP_PX,
} from '../board/windowControlsPlacement'

describe('windowControlsPlacement — у шапці картки', () => {
  it('правий верхній кут усередині картки, група вирівняна правим краєм', () => {
    const s = windowControlsPlacement({ left: 22, top: 21, width: 432 })
    expect(s).toEqual({
      left: `${22 + 432 - WINDOW_CONTROLS_INSET_PX}px`,
      top: `${21 + WINDOW_CONTROLS_TOP_PX}px`,
      transform: 'translateX(-100%)',
    })
  })

  it('ніколи не виходить за картку: лівіше за правий край і не вище за верх', () => {
    for (const frame of [{ left: 0, top: 0, width: 200 }, { left: 900, top: 700, width: 640 }]) {
      const s = windowControlsPlacement(frame)
      expect(parseFloat(s.left)).toBeLessThanOrEqual(frame.left + frame.width)
      expect(parseFloat(s.top)).toBeGreaterThanOrEqual(frame.top)
      expect(s.transform).toBe('translateX(-100%)')
    }
  })
})
