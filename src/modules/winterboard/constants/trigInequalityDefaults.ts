/**
 * TrigInequality asset defaults — SSOT §3.7.8.
 */
import type { TrigInequalityData, TrigIneqFunc, TrigIneqSign } from '../types/trigInequality'

export { TRIG_INEQUALITY_DRAG_MIME } from '../types/trigInequality'
export type { TrigInequalityDragPayload } from '../types/trigInequality'

export const DEFAULT_TRIG_INEQUALITY_W = 640
export const DEFAULT_TRIG_INEQUALITY_H = 380

export function buildDefaultTrigInequalityData(
  func: TrigIneqFunc = 'sin',
  sign: TrigIneqSign = '>',
): TrigInequalityData {
  return {
    version: 1,
    func,
    sign,
    value: 0.5,
    showInterval: true,
  }
}
