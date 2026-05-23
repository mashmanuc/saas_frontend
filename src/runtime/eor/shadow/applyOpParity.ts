/**
 * compareApplyOpDelta — per-op parity comparator.
 *
 * SSOT §15.4 (Shadow validation harness). Per colleague review P1.5.b:
 *
 *   Compare DELTAS (before→after) per side, NOT after-states only.
 *   Otherwise: accidental no-op masking, compensating mutations,
 *              hidden side effects all hide behind same final state.
 *
 * Pipeline per side:
 *   before → normalize
 *   after  → normalize
 *   delta  = computeDelta(normalized_before, normalized_after)
 *
 * Then compare legacy_delta vs eod_delta structurally.
 *
 * Strict boundaries (per colleague):
 *   - NO op semantics knowledge
 *   - NO transport policy knowledge
 *   - NO replay order awareness
 *   - op_metadata is FOR DIAGNOSTICS ONLY, not for logic
 *
 * Pure function. No I/O. No runtime hooks.
 */

import { computeDelta } from './compute-delta'
import type {
  DeltaChange,
  DeltaChangeType,
  DeltaSummary,
} from './compute-delta'
import { normalizeForReplayParity } from './normalize-snapshot'
import type { NormalizeOptions } from './normalize-snapshot'

/**
 * Op metadata — used FOR DIAGNOSTICS ONLY у the report.
 *
 * compareApplyOpDelta MUST NOT branch on these fields. Logic must be
 * purely structural на before/after snapshots.
 */
export interface OpMetadata {
  readonly op_type: string
  readonly instance_id: string
}

/**
 * Categorical reason for a delta-vs-delta mismatch.
 *
 *   different_change_type — same path, different change type (e.g., one
 *                            side added, other side changed)
 *   different_before      — same path у both deltas, before values differ
 *   different_after       — same path у both deltas, after values differ
 *   only_in_legacy        — path appears у legacy delta but not eod
 *   only_in_eod           — path appears у eod delta but not legacy
 */
export type DeltaMismatchReason =
  | 'different_change_type'
  | 'different_before'
  | 'different_after'
  | 'only_in_legacy'
  | 'only_in_eod'

export interface DeltaMismatch {
  readonly path: string
  readonly reason: DeltaMismatchReason
  readonly legacy: DeltaChange | null   // null if missing у legacy
  readonly eod: DeltaChange | null      // null if missing у eod
}

export type ApplyOpVerdict = 'match' | 'mismatch'

export interface ApplyOpDeltaReport {
  readonly verdict: ApplyOpVerdict
  readonly opMetadata: OpMetadata
  readonly legacyDelta: DeltaSummary
  readonly eodDelta: DeltaSummary
  readonly mismatches: readonly DeltaMismatch[]
  readonly truncated: boolean
}

export interface ApplyOpCompareOptions {
  readonly maxChanges?: number
  readonly maxMismatches?: number
  readonly ignorePaths?: readonly string[]
}

const DEFAULT_MAX_MISMATCHES = 50

/**
 * Compare delta semantics between legacy adapter and EOD adapter for
 * the same op application.
 *
 * @param legacyBefore - engine state у legacy adapter before applyOp
 * @param legacyAfter  - engine state у legacy adapter after applyOp
 * @param eodBefore    - engine state у EOD adapter before applyOp
 * @param eodAfter     - engine state у EOD adapter after applyOp
 * @param opMetadata   - op identity for diagnostics (NOT used by logic)
 * @param options      - normalization + comparison overrides
 */
export function compareApplyOpDelta(
  legacyBefore: unknown,
  legacyAfter: unknown,
  eodBefore: unknown,
  eodAfter: unknown,
  opMetadata: OpMetadata,
  options: NormalizeOptions & ApplyOpCompareOptions = {},
): ApplyOpDeltaReport {
  const { extraEphemeralKeys, ephemeralKeys, maxChanges, maxMismatches, ignorePaths } =
    options
  const normOpts: NormalizeOptions = { extraEphemeralKeys, ephemeralKeys }

  // Step 1 + 2: normalize all 4 states, compute deltas per side
  const legacyDelta = computeDelta(
    normalizeForReplayParity(legacyBefore, normOpts),
    normalizeForReplayParity(legacyAfter, normOpts),
    { maxChanges, ignorePaths },
  )
  const eodDelta = computeDelta(
    normalizeForReplayParity(eodBefore, normOpts),
    normalizeForReplayParity(eodAfter, normOpts),
    { maxChanges, ignorePaths },
  )

  // Step 3: compare deltas structurally
  const cap = maxMismatches ?? DEFAULT_MAX_MISMATCHES
  const ignoredPaths = new Set(ignorePaths ?? [])
  const result = compareDeltas(legacyDelta, eodDelta, cap, ignoredPaths)

  return Object.freeze({
    verdict: result.mismatches.length === 0 ? ('match' as const) : ('mismatch' as const),
    opMetadata: Object.freeze({ ...opMetadata }),
    legacyDelta,
    eodDelta,
    mismatches: Object.freeze(result.mismatches),
    truncated: result.truncated || legacyDelta.truncated || eodDelta.truncated,
  })
}

/**
 * Compare two delta lists structurally. Path-keyed comparison.
 *
 * NOT op-semantic — does not know which op_type каже that path is
 * expected to change. Pure path-by-path comparison.
 */
function compareDeltas(
  legacyDelta: DeltaSummary,
  eodDelta: DeltaSummary,
  maxMismatches: number,
  ignoredPaths: Set<string>,
): { mismatches: DeltaMismatch[]; truncated: boolean } {
  // Build path → change maps for stable lookup
  const legacyByPath = new Map<string, DeltaChange>()
  for (const c of legacyDelta.changes) legacyByPath.set(c.path, c)
  const eodByPath = new Map<string, DeltaChange>()
  for (const c of eodDelta.changes) eodByPath.set(c.path, c)

  // Stable order: sorted paths union
  const allPaths = Array.from(
    new Set<string>([...legacyByPath.keys(), ...eodByPath.keys()]),
  ).sort()

  const mismatches: DeltaMismatch[] = []
  let truncated = false

  for (const path of allPaths) {
    if (mismatches.length >= maxMismatches) {
      truncated = true
      break
    }
    if (ignoredPaths.has(path)) continue

    const lc = legacyByPath.get(path) ?? null
    const ec = eodByPath.get(path) ?? null

    if (lc && !ec) {
      mismatches.push({ path, reason: 'only_in_legacy', legacy: lc, eod: null })
      continue
    }
    if (!lc && ec) {
      mismatches.push({ path, reason: 'only_in_eod', legacy: null, eod: ec })
      continue
    }
    if (lc && ec) {
      // Same path у both deltas — check change type + before/after values
      if (lc.changeType !== ec.changeType) {
        mismatches.push({
          path,
          reason: 'different_change_type',
          legacy: lc,
          eod: ec,
        })
        continue
      }
      // Same change type — compare values
      if (!deepEqual(lc.before, ec.before)) {
        mismatches.push({ path, reason: 'different_before', legacy: lc, eod: ec })
        continue
      }
      if (!deepEqual(lc.after, ec.after)) {
        mismatches.push({ path, reason: 'different_after', legacy: lc, eod: ec })
        continue
      }
      // All equal — no mismatch
    }
  }

  return { mismatches, truncated }
}

/**
 * Stable structural equality для unknown values. Pure.
 *
 * Uses JSON serialization with sorted keys for deterministic comparison.
 * Sufficient for board_state shapes (plain data).
 */
function deepEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (a === null || b === null) return a === b
  if (typeof a !== typeof b) return false
  // Plain data only — use stable-stringify trick
  try {
    return stableStringify(a) === stableStringify(b)
  } catch {
    return false
  }
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return 'null'
  if (typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']'
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  return (
    '{' +
    keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') +
    '}'
  )
}

// Re-export for consumer convenience (avoid forcing import of compute-delta module)
export type { DeltaChange, DeltaChangeType, DeltaSummary }
