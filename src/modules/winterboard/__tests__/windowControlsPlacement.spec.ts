/**
 * INV-WIN-6: група «— ⛶ ×» — у правому верхньому куті картки, ЗОВНІ, щоб не
 * лягати на вміст (FIRST USER GATE 2026-09-23: кнопки закривали графік).
 */
import { describe, it, expect } from 'vitest'
import {
  windowControlsPlacement,
  WINDOW_CONTROLS_GAP_PX,
  WINDOW_CONTROLS_H_PX,
  WINDOW_CONTROLS_INSET_PX,
  WINDOW_CONTROLS_MAX_W_PX,
} from '../board/windowControlsPlacement'

// Графік Інтегралика на ноутбуці 1440×900: картка біля верху аркуша.
const GRAPH = { left: 22, top: 21, width: 432 }

describe('windowControlsPlacement', () => {
  it('є місце праворуч — група зовні праворуч, верхом урівень з карткою', () => {
    const s = windowControlsPlacement(GRAPH, 1037)
    expect(s).toEqual({ left: `${22 + 432 + WINDOW_CONTROLS_GAP_PX}px`, top: '21px' })
  })

  it('праворуч тісно, над карткою є місце — група над правим верхнім кутом', () => {
    const frame = { left: 400, top: 200, width: 600 }
    const field = 400 + 600 + WINDOW_CONTROLS_MAX_W_PX - 1
    const s = windowControlsPlacement(frame, field)
    expect(s).toEqual({
      left: '1000px',
      top: `${200 - WINDOW_CONTROLS_GAP_PX - WINDOW_CONTROLS_H_PX}px`,
      transform: 'translateX(-100%)',
    })
  })

  it('ні праворуч, ні зверху місця немає — як було: всередині кута', () => {
    const frame = { left: 100, top: 10, width: 900 }
    const s = windowControlsPlacement(frame, 1000)
    expect(s).toEqual({
      left: `${1000 - WINDOW_CONTROLS_INSET_PX}px`,
      top: `${10 + WINDOW_CONTROLS_INSET_PX}px`,
      transform: 'translateX(-100%)',
    })
  })

  it('ширина поля ще невідома (0) — праворуч не ставимо', () => {
    const s = windowControlsPlacement({ left: 0, top: 100, width: 200 }, 0)
    expect(s.transform).toBe('translateX(-100%)')
  })
})
