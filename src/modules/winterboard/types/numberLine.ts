/**
 * Числова пряма (Б-184) — тип асета `number_line`.
 * Дані — контракт рушія (`engine/numberLine/types.ts`), тут лише обгортка асета.
 */
import type { WBAsset } from './winterboard'
import type { NumberLineData } from '../engine/numberLine/types'

export type { NumberLineData } from '../engine/numberLine/types'

export interface NumberLineAsset extends WBAsset {
  type: 'number_line'
  src: ''
  data: NumberLineData
}

/** MIME для «Інструменти» → дошка (drag і click). */
export const NUMBER_LINE_DRAG_MIME = 'application/x-m4sh-number-line'
