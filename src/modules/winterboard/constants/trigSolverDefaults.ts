/**
 * TrigSolver asset defaults — SSOT §3.7.7.
 */
import type { TrigFuncType, TrigSolverData } from '../types/trigSolver'

export { TRIG_SOLVER_DRAG_MIME } from '../types/trigSolver'
export type { TrigSolverDragPayload } from '../types/trigSolver'

export const DEFAULT_TRIG_SOLVER_W = 700
export const DEFAULT_TRIG_SOLVER_H = 480

export function buildDefaultTrigSolverData(type: TrigFuncType = 'sin'): TrigSolverData {
  return {
    version: 1,
    type,
    rel: '=',
    a: 0.5,
    snapSpecial: true,
    showGraph: true,
    showAllSolutions: true,
  }
}
