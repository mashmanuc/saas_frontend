/**
 * EOR Shadow validator — public API barrel.
 *
 * P1.f: serialize parity comparison ONLY (per MIG-INV-6 phasing).
 *
 * Future tasks before P2 shadow activation:
 *   - replay parity (compare engine state after applyOp sequence)
 *   - applyOp parity (compare per-op state delta)
 *   - transport parity (compare emitted op shape + timing)
 *
 * All comparators must be pure functions з isolated test harnesses.
 * NO runtime hooks, NO renderer taps, NO live integration у P1.
 */

export { stableStringify } from './stable-stringify'
export { compareSerializedSnapshots } from './serializeParity'
export type {
  ParityVerdict,
  ParityDiff,
  ParityDiffReason,
  ParityReport,
  CompareOptions,
} from './types'
