// Phase S PR-3 (2026-04-28) — Stroke ops coalescer.
//
// Purpose: under load (pendingOps > 50) consecutive `stroke_append` ops для same
// stroke_id merge'аться у single op з combined points array. Reduces op count
// без втрати fidelity (server still receives all points).
//
// Pure function — no state, no side effects. Used inline у useReplayRecorder.record().
//
// Why це safe:
//   - INV-14 IDEMPOTENCY: coalesced op gets one op_id (last incoming op's id).
//     BE dedup на op_id — duplicates filtered out.
//   - INV-15 CLIENT-SEQ-FILTER: server assigns single seq per op. Coalescing FE-side
//     не affect server seq numbering.
//   - Drawing fidelity: stroke_append payload format `{stroke_id, points: [...]}`
//     — points concatenation produces visually identical stroke.
//
// Per REFACTOR_PLAN.md §3 task #8 (degradation strategy).

import type { OpsSyncOp } from '../stores/opsSyncStore'

interface StrokeAppendPayload {
  stroke_id?: string
  points?: Array<unknown>
  [key: string]: unknown
}

/**
 * Try to merge `incoming` op into `last` op (last entry у pendingOps).
 *
 * Returns true якщо merge happened (caller should NOT push incoming separately).
 * Returns false якщо ops cannot be coalesced — caller adds incoming as new op.
 *
 * Conditions для merge:
 *   1. Both ops are `stroke_append` type
 *   2. Same stroke_id
 *   3. Both have points arrays
 *
 * Side effect: mutates `last.payload.points` у place (extends with incoming's points).
 */
export function tryCoalesceStrokeAppend(last: OpsSyncOp, incoming: OpsSyncOp): boolean {
  if (last.op_type !== 'stroke_append' || incoming.op_type !== 'stroke_append') {
    return false
  }

  const lastPayload = (last.payload ?? {}) as StrokeAppendPayload
  const incomingPayload = (incoming.payload ?? {}) as StrokeAppendPayload

  if (!lastPayload.stroke_id || lastPayload.stroke_id !== incomingPayload.stroke_id) {
    return false
  }

  if (!Array.isArray(lastPayload.points) || !Array.isArray(incomingPayload.points)) {
    return false
  }

  // Mutate last op's points у place (combined points = backwards-compatible)
  lastPayload.points = [...lastPayload.points, ...incomingPayload.points]
  return true
}

/**
 * Pure function variant — returns NEW Op array з consecutive stroke_append для
 * same stroke_id merged. Useful для tests + offline analysis.
 *
 * Не used у production hot path (мутаційна tryCoalesceStrokeAppend faster).
 */
export function coalesceStrokeOps(ops: OpsSyncOp[]): OpsSyncOp[] {
  if (ops.length < 2) return ops.slice()

  const result: OpsSyncOp[] = []
  for (const op of ops) {
    const last = result[result.length - 1]
    if (last && op.op_type === 'stroke_append' && last.op_type === 'stroke_append') {
      const lastPayload = (last.payload ?? {}) as StrokeAppendPayload
      const incomingPayload = (op.payload ?? {}) as StrokeAppendPayload
      if (
        lastPayload.stroke_id &&
        lastPayload.stroke_id === incomingPayload.stroke_id &&
        Array.isArray(lastPayload.points) &&
        Array.isArray(incomingPayload.points)
      ) {
        // Clone last з combined points (avoid mutating input)
        const merged: OpsSyncOp = {
          ...last,
          payload: {
            ...lastPayload,
            points: [...lastPayload.points, ...incomingPayload.points],
          },
        }
        result[result.length - 1] = merged
        continue
      }
    }
    result.push(op)
  }
  return result
}
