/**
 * TrigSolver asset defaults — SSOT §3.7.7.
 */
import type { TrigSolverData, TrigSolverFunc } from '../types/trigSolver'

export { TRIG_SOLVER_DRAG_MIME } from '../types/trigSolver'
export type { TrigSolverDragPayload } from '../types/trigSolver'

export const DEFAULT_TRIG_SOLVER_W = 640
export const DEFAULT_TRIG_SOLVER_H = 400

export function buildDefaultTrigSolverData(func: TrigSolverFunc = 'sin'): TrigSolverData {
  return {
    version: 1,
    mode: 'equation',
    func,
    sign: '>',
    value: 0.5,
    showInfo: true,
  }
}
