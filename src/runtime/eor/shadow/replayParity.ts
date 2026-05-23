/**
 * compareReplaySnapshots — pure replay-state parity comparator.
 *
 * SSOT §6 (Replay) + §15.4 (Shadow validation).
 *
 * Per colleague review P1.5.a:
 *   Pipeline = normalize → compare (NOT raw snapshot comparison).
 *
 * Steps:
 *   1. normalizeForReplayParity(legacy)  — drop ephemeral keys + runtime_id
 *   2. normalizeForReplayParity(eod)     — same normalization rules
 *   3. compareSerializedSnapshots()      — byte-equivalence after normalize
 *
 * Used after applyOp sequence: compares engine state of legacy renderer
 * vs EOD renderer after replaying [start_seq..end_seq] ops.
 *
 * Pure function — no I/O, no state, no runtime activation.
 */

import { compareSerializedSnapshots } from './serializeParity'
import {
  normalizeForReplayParity,
  type NormalizeOptions,
} from './normalize-snapshot'
import type { CompareOptions, ParityReport } from './types'

/**
 * Compare two replay engine states (post-applyOp) для byte-equivalence
 * after canonicalization.
 *
 * @param legacy - engine state after legacy adapter's applyOp sequence
 * @param eod    - engine state after EOD adapter's applyOp sequence
 * @param options - normalization + comparison overrides
 * @returns ParityReport from compareSerializedSnapshots on normalized values
 */
export function compareReplaySnapshots(
  legacy: unknown,
  eod: unknown,
  options: NormalizeOptions & CompareOptions = {},
): ParityReport {
  const { extraEphemeralKeys, ephemeralKeys, ...compareOpts } = options
  const normalizeOpts: NormalizeOptions = {
    extraEphemeralKeys,
    ephemeralKeys,
  }
  const normalizedLegacy = normalizeForReplayParity(legacy, normalizeOpts)
  const normalizedEod = normalizeForReplayParity(eod, normalizeOpts)
  return compareSerializedSnapshots(normalizedLegacy, normalizedEod, compareOpts)
}
