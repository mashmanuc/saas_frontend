/**
 * Mismatch classification — deterministic taxonomy layer.
 *
 * Per colleague review P1.5.e:
 *
 *   Classification = taxonomy. NOT interpretation, explanation, causality.
 *
 *   Constraints:
 *     - Lossless + deterministic (same input → same categories, counts,
 *       ordering)
 *     - Multi-label (one diff may carry multiple categories)
 *     - Stable precedence ordering (NOT severity scoring)
 *     - Unknown reason → reserved 'unknown_mismatch' bucket (NEVER throw)
 *     - ClassificationSummary IMMUTABLE
 *
 *   STRICTLY NOT included у P1.5.e:
 *     - metrics, runtime hooks, alerts, logging, Prometheus
 *     - "race_condition_likely", "animation_artifact", "semantic_drift"
 *       (reserved for future heuristic layer, not part of base taxonomy)
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md §15.4
 */

import { stableStringify } from './stable-stringify'
import type { ParityDiff, ParityReport } from './types'
import type {
  ApplyOpDeltaReport,
  DeltaMismatch,
} from './applyOpParity'

/**
 * Classification categories — the taxonomy.
 *
 * Order у this union matches `CATEGORY_PRECEDENCE` below (stable
 * ordering для telemetry / UI aggregation).
 */
export type ClassificationCategory =
  | 'type_mismatch'
  | 'missing_field'
  | 'extra_field'
  | 'value_mismatch'
  | 'ordering_mismatch'
  | 'unknown_mismatch'

/**
 * Stable precedence — for telemetry aggregation, dashboards, sorted
 * summaries. NOT a severity score — каrier of "where to display first".
 *
 * Order matches `ClassificationCategory` declaration above.
 */
export const CATEGORY_PRECEDENCE: readonly ClassificationCategory[] = Object.freeze(
  [
    'type_mismatch',
    'missing_field',
    'extra_field',
    'value_mismatch',
    'ordering_mismatch',
    'unknown_mismatch',
  ] as const,
)

/**
 * Numeric rank for sorting — lower = appears first у stable orderings.
 */
const CATEGORY_RANK: Readonly<Record<ClassificationCategory, number>> = (() => {
  const obj: Partial<Record<ClassificationCategory, number>> = {}
  CATEGORY_PRECEDENCE.forEach((c, i) => {
    obj[c] = i
  })
  return Object.freeze(obj as Record<ClassificationCategory, number>)
})()

/**
 * Single diff with assigned categories.
 *
 * `categories` is multi-label per colleague spec — one diff may carry
 * multiple categories simultaneously (e.g., type_mismatch + value_mismatch
 * when types differ AND values would also differ structurally).
 *
 * Categories within array are sorted by `CATEGORY_PRECEDENCE` for
 * deterministic output.
 */
export interface ClassifiedDiff {
  readonly path: string
  readonly categories: readonly ClassificationCategory[]
  /**
   * Original diff (ParityDiff or DeltaMismatch) preserved для downstream
   * consumers that need raw values / reasons.
   */
  readonly raw: ParityDiff | DeltaMismatch
}

/**
 * Aggregated classification result — frozen, telemetry-ready.
 *
 * `countByCategory` includes ALL categories from `CATEGORY_PRECEDENCE`
 * with explicit zeros — ensures stable shape across reports (important
 * для dashboards що group by category).
 */
export interface ClassificationSummary {
  readonly classified: readonly ClassifiedDiff[]
  readonly countByCategory: Readonly<
    Record<ClassificationCategory, number>
  >
  readonly totalMismatches: number
}

// ─── ParityReport classifier (serialize parity, replay parity) ──────────

/**
 * Classify a ParityReport's diffs into taxonomy categories.
 *
 * Pure deterministic. Empty report → all-zero summary.
 */
export function classifyParityReport(
  report: Pick<ParityReport, 'diffs'>,
): ClassificationSummary {
  const baseClassified: ClassifiedDiff[] = report.diffs.map((d) =>
    Object.freeze({
      path: d.path,
      categories: sortCategories(parityDiffToCategories(d)),
      raw: d,
    }),
  )
  const classified = applyOrderingDetection(baseClassified)
  return buildSummary(classified)
}

/**
 * Map ParityDiff.reason → base categories.
 */
function parityDiffToCategories(d: ParityDiff): ClassificationCategory[] {
  switch (d.reason) {
    case 'type_mismatch':
      return ['type_mismatch']
    case 'missing_in_eod':
      return ['missing_field']
    case 'extra_in_eod':
      return ['extra_field']
    case 'value_mismatch':
      return ['value_mismatch']
    case 'length_mismatch':
      // Length differs у both directions conceptually — eod either has
      // fewer (missing) OR more (extra). Without comparing values we
      // can't tell which side is the reference. Multi-label both.
      return ['missing_field', 'extra_field']
    default:
      // Unknown reason — future comparator evolution safe
      return ['unknown_mismatch']
  }
}

// ─── ApplyOpDeltaReport classifier ─────────────────────────────────────

/**
 * Classify an ApplyOpDeltaReport's mismatches into taxonomy categories.
 */
export function classifyApplyOpDeltaReport(
  report: Pick<ApplyOpDeltaReport, 'mismatches'>,
): ClassificationSummary {
  const baseClassified: ClassifiedDiff[] = report.mismatches.map((m) =>
    Object.freeze({
      path: m.path,
      categories: sortCategories(deltaMismatchToCategories(m)),
      raw: m,
    }),
  )
  const classified = applyOrderingDetection(baseClassified)
  return buildSummary(classified)
}

/**
 * Map DeltaMismatch.reason → base categories.
 *
 * Per colleague — different_change_type у delta context = type-level
 * disagreement on what kind of change happened. Map to type_mismatch
 * within taxonomy.
 */
function deltaMismatchToCategories(
  m: DeltaMismatch,
): ClassificationCategory[] {
  switch (m.reason) {
    case 'different_change_type':
      return ['type_mismatch']
    case 'different_before':
    case 'different_after':
      return ['value_mismatch']
    case 'only_in_legacy':
      // Legacy recorded change, EOD didn't — EOD missing it
      return ['missing_field']
    case 'only_in_eod':
      // EOD recorded change, legacy didn't — EOD has extra
      return ['extra_field']
    default:
      return ['unknown_mismatch']
  }
}

// ─── Ordering detection (post-processing pass) ─────────────────────────

/**
 * Detect ordering_mismatch among groups of value_mismatch diffs under
 * the same array parent path.
 *
 * Per colleague spec:
 *   ordering_mismatch ONLY if: same elements, different order
 *   NOT if: array lengths differ
 *
 * Algorithm:
 *   1. Group value_mismatch diffs by array-parent-path
 *      (e.g., 'pages.0.strokes.0' → parent 'pages.0.strokes')
 *   2. For each group with >= 2 diffs:
 *      - Collect legacy values from those diffs
 *      - Collect eod values from those diffs
 *      - If multisets equal (same values, just reordered) → add
 *        'ordering_mismatch' as additional label to those diffs
 *   3. Categories ordering preserved via sortCategories.
 *
 * Multi-label per colleague — diffs keep value_mismatch AND
 * ordering_mismatch.
 */
function applyOrderingDetection(
  classified: ClassifiedDiff[],
): ClassifiedDiff[] {
  // Group indices by array-parent-path (only for value_mismatch diffs)
  const groups = new Map<string, number[]>()
  classified.forEach((cd, idx) => {
    if (!cd.categories.includes('value_mismatch')) return
    const parent = getArrayParentPath(cd.path)
    if (parent === null) return
    const existing = groups.get(parent)
    if (existing) existing.push(idx)
    else groups.set(parent, [idx])
  })

  if (groups.size === 0) return classified

  // Collect indices to enrich з ordering_mismatch
  const enrichIndices = new Set<number>()

  for (const [, indices] of groups) {
    if (indices.length < 2) continue
    const legacyValues: unknown[] = []
    const eodValues: unknown[] = []
    for (const idx of indices) {
      const raw = classified[idx].raw
      // Both ParityDiff and DeltaMismatch carry .legacy / .eod (DeltaMismatch
      // wraps DeltaChange — extract before/after from those if relevant).
      if ('legacy' in raw && 'eod' in raw) {
        const lv = raw.legacy
        const ev = raw.eod
        // ParityDiff: legacy and eod are raw values
        // DeltaMismatch: legacy/eod are DeltaChange or null — extract after values
        const lVal = isDeltaChangeLike(lv) ? lv.after : lv
        const eVal = isDeltaChangeLike(ev) ? ev.after : ev
        legacyValues.push(lVal)
        eodValues.push(eVal)
      }
    }
    if (multisetEqual(legacyValues, eodValues)) {
      for (const idx of indices) enrichIndices.add(idx)
    }
  }

  if (enrichIndices.size === 0) return classified

  return classified.map((cd, idx) => {
    if (!enrichIndices.has(idx)) return cd
    return Object.freeze({
      ...cd,
      categories: sortCategories([...cd.categories, 'ordering_mismatch']),
    })
  })
}

// ─── Helpers ───────────────────────────────────────────────────────────

/**
 * Parent array path detection. Last segment must be numeric для array index.
 *
 *   'pages.0.strokes.0' → 'pages.0.strokes'
 *   'pages.0.id'        → null (last segment 'id' not numeric)
 *   '0'                 → ''   (root array)
 *   ''                  → null
 */
function getArrayParentPath(path: string): string | null {
  if (!path) return null
  const lastDot = path.lastIndexOf('.')
  const lastSeg = lastDot >= 0 ? path.slice(lastDot + 1) : path
  if (!/^\d+$/.test(lastSeg)) return null
  return lastDot >= 0 ? path.slice(0, lastDot) : ''
}

/**
 * Multiset equality — same values, ignoring order.
 *
 * Uses stableStringify so primitives + objects + nested structures
 * compare deterministically.
 */
function multisetEqual(a: readonly unknown[], b: readonly unknown[]): boolean {
  if (a.length !== b.length) return false
  const aSerialized = a.map(stableStringify).sort()
  const bSerialized = b.map(stableStringify).sort()
  for (let i = 0; i < aSerialized.length; i++) {
    if (aSerialized[i] !== bSerialized[i]) return false
  }
  return true
}

/**
 * Type guard: object that looks like DeltaChange (has changeType field).
 */
function isDeltaChangeLike(
  v: unknown,
): v is { before: unknown; after: unknown; changeType: string } {
  return (
    typeof v === 'object' &&
    v !== null &&
    'changeType' in v &&
    'before' in v &&
    'after' in v
  )
}

/**
 * Sort categories by precedence; dedupe.
 */
function sortCategories(
  cats: readonly ClassificationCategory[],
): readonly ClassificationCategory[] {
  const dedup = Array.from(new Set(cats))
  dedup.sort((a, b) => CATEGORY_RANK[a] - CATEGORY_RANK[b])
  return Object.freeze(dedup)
}

/**
 * Build the immutable summary з classified diff list.
 */
function buildSummary(
  classified: readonly ClassifiedDiff[],
): ClassificationSummary {
  const counts: Record<ClassificationCategory, number> = {
    type_mismatch: 0,
    missing_field: 0,
    extra_field: 0,
    value_mismatch: 0,
    ordering_mismatch: 0,
    unknown_mismatch: 0,
  }
  for (const cd of classified) {
    for (const cat of cd.categories) {
      counts[cat]++
    }
  }
  return Object.freeze({
    classified: Object.freeze([...classified]),
    countByCategory: Object.freeze(counts),
    totalMismatches: classified.length,
  })
}
