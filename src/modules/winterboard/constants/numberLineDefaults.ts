/**
 * Числова пряма (Б-184) — розмір і будівник нового асета. Один будівник на всі
 * шляхи вставки («Інструменти» клік / перетягування, Інтегралик).
 */
import { defaultNumberLineData, type NumberLineData } from '../engine/numberLine/types'
import type { NumberLineAsset } from '../types/numberLine'

export { NUMBER_LINE_DRAG_MIME } from '../types/numberLine'

export const DEFAULT_NUMBER_LINE_W = 600
export const DEFAULT_NUMBER_LINE_H = 300

/** Новий асет з центром у `pos`. `data` — уже перевірені умови (Інтегралик) або порожньо. */
export function buildNumberLineAsset(
  pos: { x: number; y: number },
  data: Partial<NumberLineData> = {},
  id: string = `numline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
): NumberLineAsset {
  return {
    id,
    type: 'number_line',
    src: '',
    x: pos.x - DEFAULT_NUMBER_LINE_W / 2,
    y: pos.y - DEFAULT_NUMBER_LINE_H / 2,
    w: DEFAULT_NUMBER_LINE_W,
    h: DEFAULT_NUMBER_LINE_H,
    rotation: 0,
    locked: false,
    data: { ...defaultNumberLineData(), ...data },
  }
}
