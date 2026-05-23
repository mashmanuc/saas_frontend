/**
 * Shadow validator type definitions.
 *
 * SSOT §15.4. Serialize parity ONLY у P1.f (per MIG-INV-6 phasing).
 * replay / applyOp / transport parity comparators land у separate tasks
 * before P2 shadow activation.
 *
 * STATUS: P1.f — pure data types. NO runtime hooks, NO metric registration,
 * NO renderer taps.
 */

/**
 * Verdict from a parity comparison.
 *
 *   match    — legacy і EOD serialized snapshots are byte-equivalent
 *   mismatch — diffs detected; see `ParityReport.diffs` for details
 */
export type ParityVerdict = 'match' | 'mismatch'

/**
 * Single diff entry — one path где legacy != EOD.
 *
 * `path` uses dot-notation with array indices:
 *   - 'pages.0.assets.1.data.theta'
 *   - 'pages.2.strokes.0.color'
 *   - '' (empty) when both top-level values differ entirely
 */
export interface ParityDiff {
  readonly path: string
  readonly legacy: unknown
  readonly eod: unknown
  readonly reason: ParityDiffReason
}

/**
 * Categorical reason for diff — helps consumers (loggers, dashboards)
 * categorize without re-parsing values.
 */
export type ParityDiffReason =
  | 'missing_in_eod'      // legacy has key/index, EOD does not
  | 'extra_in_eod'        // EOD has key/index, legacy does not
  | 'type_mismatch'       // values are different JSON types
  | 'value_mismatch'      // same type, different values
  | 'length_mismatch'     // arrays differ in length

/**
 * Parity comparison output. Stable shape — safe to log / serialize / count.
 */
export interface ParityReport {
  readonly verdict: ParityVerdict
  readonly diffs: readonly ParityDiff[]
  // Serialized canonical forms — included для debugging / mismatch logging.
  // Stable (sorted keys recursively) so byte-equivalence implies value-equivalence.
  readonly serializedLegacy: string
  readonly serializedEod: string
  // True if diffs were truncated to `maxDiffs` (rest dropped).
  readonly truncated: boolean
}

/**
 * Optional configuration для compareSerializedSnapshots.
 */
export interface CompareOptions {
  /**
   * Maximum number of diffs to collect before stopping recursion.
   * Default: 50. Prevents huge reports у case of structural mismatch.
   */
  readonly maxDiffs?: number

  /**
   * Dot-paths to ignore (treat as match regardless of value).
   * Used to skip ephemeral fields that aren't expected to match
   * (e.g., 'meta.last_snapshot_seq' if it's per-instance).
   *
   * Default: [] (no ignored paths).
   */
  readonly ignorePaths?: readonly string[]
}
