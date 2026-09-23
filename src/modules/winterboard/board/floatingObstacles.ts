/**
 * Плаваючі вікна поверх дошки, які закривають частину полотна (координати екрана).
 *
 * Зараз одне — вікно Інтегралика: після «побудуй графік» воно лишається
 * відкритим (закріпленим) над дошкою, і група «— ⛶ ×» праворуч від графіка
 * опинялась під ним (FIRST USER GATE 2026-09-23). Вікно саме повідомляє, де
 * стоїть; полотно лише читає — щоб не ставити туди свої кнопки.
 *
 * Лише відображення: жодного стану дошки, жодних ops.
 */
import { reactive } from 'vue'

export interface ScreenRect {
  left: number
  top: number
  right: number
  bottom: number
}

export const floatingObstacles = reactive<Record<string, ScreenRect | null>>({})

export function setFloatingObstacle(id: string, rect: ScreenRect | null): void {
  floatingObstacles[id] = rect
}

/** Усі видимі перешкоди — у координатах елемента з прямокутником `origin`. */
export function obstaclesRelativeTo(origin: { left: number; top: number }): ScreenRect[] {
  return Object.values(floatingObstacles)
    .filter((r): r is ScreenRect => !!r)
    .map((r) => ({
      left: r.left - origin.left,
      top: r.top - origin.top,
      right: r.right - origin.left,
      bottom: r.bottom - origin.top,
    }))
}
