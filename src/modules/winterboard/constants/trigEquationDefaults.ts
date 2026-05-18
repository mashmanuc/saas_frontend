/**
 * TrigEquation asset defaults — SSOT §3.7.7.
 */
import type { TrigEquationData, TrigEqFunc } from '../types/trigEquation'

export { TRIG_EQUATION_DRAG_MIME } from '../types/trigEquation'
export type { TrigEquationDragPayload } from '../types/trigEquation'

export const DEFAULT_TRIG_EQUATION_W = 640
export const DEFAULT_TRIG_EQUATION_H = 380

export function buildDefaultTrigEquationData(func: TrigEqFunc = 'sin'): TrigEquationData {
  return {
    version: 1,
    func,
    value: 0.5,
    showFormula: true,
    showAngles: true,
  }
}
