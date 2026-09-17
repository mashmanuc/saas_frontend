/**
 * TLV2-RC1.1 · вигляд мінікартки трею — лише подання, без стану й без запису.
 *
 * Мінікартка читає вже наявні `type` і назву: кольоровий маркер родини типу,
 * монограма з підпису типу й позиція меню над карткою. Невідомий тип отримує
 * нейтральну родину `generic`, тож вкладка ніколи не буває порожньою.
 */

export type TrayCardFamily = 'text' | 'task' | 'math' | 'animation' | 'media' | 'generic'

const FAMILY_BY_TYPE: Readonly<Record<string, TrayCardFamily>> = Object.freeze({
  theory_card: 'text',
  formula_card: 'text',
  sticky: 'text',
  document_viewer: 'text',
  nmt_task: 'task',
  geometry_2d_v2: 'math',
  geometry_solid: 'math',
  graph_calculator: 'math',
  calculus_card: 'math',
  quadratic_card: 'math',
  trig_circle: 'math',
  trig_solver: 'math',
  helix: 'math',
  nmt3d: 'math',
  mash_scene: 'math',
  geomash_scene: 'math',
  graphmash_3d: 'math',
  visual_capsule: 'animation',
  image: 'media',
})

/** Родина типу для кольору маркера; невідомий тип — `generic`. */
export function trayCardFamily(type: string): TrayCardFamily {
  return FAMILY_BY_TYPE[type] ?? 'generic'
}

/** Монограма маркера — перша літера підпису типу; порожній підпис — «•». */
export function trayMonogram(label: string): string {
  const first = Array.from(label.trim())[0]
  return first ? first.toLocaleUpperCase('uk') : '•'
}

export interface TrayRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface TraySize {
  width: number
  height: number
}

export interface TrayMenuPlacement {
  left: number
  top: number
  placement: 'above' | 'below'
}

/**
 * Меню мінікартки — `position: fixed` у viewport, тож його не обрізає ні скрол трею,
 * ні полотно. Трей стоїть унизу, тому меню йде НАД карткою, праве ребро — по картці;
 * якщо згори бракує місця — під карткою. Завжди в межах viewport з відступом `margin`.
 */
export function trayMenuPosition(
  anchor: TrayRect,
  menu: TraySize,
  viewport: TraySize,
  gap = 6,
  margin = 8,
): TrayMenuPlacement {
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))
  const above = anchor.top - gap - menu.height
  const placement = above >= margin ? 'above' : 'below'
  const rawTop = placement === 'above' ? above : anchor.bottom + gap
  return {
    left: clamp(anchor.right - menu.width, margin, viewport.width - menu.width - margin),
    top: clamp(rawTop, margin, viewport.height - menu.height - margin),
    placement,
  }
}
