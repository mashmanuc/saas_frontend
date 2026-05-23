/**
 * serializeParity — pure shadow validator for snapshot byte-equivalence.
 *
 * SSOT §15.4 (Shadow validation harness — P1 ships serialize parity ONLY).
 *
 * Per colleague review P1.f:
 *   - Pure function — no I/O, no state, no event hooks
 *   - Isolated test harness — no runtime integration
 *   - NO renderer taps, NO replay integration
 *
 * Comparison strategy:
 *   1. Stable-stringify both snapshots (sorted keys).
 *   2. If strings byte-equal → verdict 'match', no diff walking needed.
 *   3. If different → recursive walk to collect diff paths.
 *   4. Cap diffs at `maxDiffs` (default 50) to bound report size.
 */

import { stableStringify } from './stable-stringify'
import type {
  CompareOptions,
  ParityDiff,
  ParityReport,
} from './types'

const DEFAULT_MAX_DIFFS = 50

/**
 * Compare two snapshot values для byte-equivalence.
 *
 * @param legacy - snapshot produced by legacy renderer path
 * @param eod    - snapshot produced by EOD adapter
 * @param options - max diffs, ignore paths
 * @returns ParityReport з verdict + optional diffs
 */
export function compareSerializedSnapshots(
  legacy: unknown,
  eod: unknown,
  options: CompareOptions = {},
): ParityReport {
  const maxDiffs = options.maxDiffs ?? DEFAULT_MAX_DIFFS
  const ignorePaths = new Set(options.ignorePaths ?? [])

  const serializedLegacy = stableStringify(legacy)
  const serializedEod = stableStringify(eod)

  // Fast path: byte-equal → match (no walk needed).
  if (serializedLegacy === serializedEod) {
    return Object.freeze({
      verdict: 'match' as const,
      diffs: Object.freeze([] as ParityDiff[]),
      serializedLegacy,
      serializedEod,
      truncated: false,
    })
  }

  // Slow path: collect diff paths via recursive walk.
  const diffs: ParityDiff[] = []
  const truncated = walkDiffs(legacy, eod, '', diffs, maxDiffs, ignorePaths)

  return Object.freeze({
    verdict: 'mismatch' as const,
    diffs: Object.freeze(diffs),
    serializedLegacy,
    serializedEod,
    truncated,
  })
}

/**
 * Recursive diff walker. Returns true if truncation hit.
 */
function walkDiffs(
  legacy: unknown,
  eod: unknown,
  path: string,
  diffs: ParityDiff[],
  maxDiffs: number,
  ignorePaths: Set<string>,
): boolean {
  if (diffs.length >= maxDiffs) return true

  // Ignored path → treat as match (skip subtree)
  if (ignorePaths.has(path)) return false

  // Same reference or same primitive value
  if (Object.is(legacy, eod)) return false

  // Type mismatch — different JSON shapes
  const legacyType = jsonType(legacy)
  const eodType = jsonType(eod)
  if (legacyType !== eodType) {
    diffs.push({
      path,
      legacy,
      eod,
      reason: 'type_mismatch',
    })
    return diffs.length >= maxDiffs
  }

  // Same primitive type, different values
  if (isPrimitive(legacyType)) {
    diffs.push({
      path,
      legacy,
      eod,
      reason: 'value_mismatch',
    })
    return diffs.length >= maxDiffs
  }

  // Array — compare lengths and elements
  if (legacyType === 'array') {
    const legacyArr = legacy as unknown[]
    const eodArr = eod as unknown[]
    if (legacyArr.length !== eodArr.length) {
      diffs.push({
        path,
        legacy: legacyArr.length,
        eod: eodArr.length,
        reason: 'length_mismatch',
      })
      // Continue walking common prefix — caller may want elementwise diffs too
    }
    const commonLen = Math.min(legacyArr.length, eodArr.length)
    for (let i = 0; i < commonLen; i++) {
      const childPath = path ? `${path}.${i}` : String(i)
      const truncated = walkDiffs(
        legacyArr[i],
        eodArr[i],
        childPath,
        diffs,
        maxDiffs,
        ignorePaths,
      )
      if (truncated) return true
    }
    // Extra elements у legacy (eod is shorter)
    for (let i = commonLen; i < legacyArr.length; i++) {
      if (diffs.length >= maxDiffs) return true
      const childPath = path ? `${path}.${i}` : String(i)
      if (ignorePaths.has(childPath)) continue
      diffs.push({
        path: childPath,
        legacy: legacyArr[i],
        eod: undefined,
        reason: 'missing_in_eod',
      })
    }
    // Extra elements у eod (legacy is shorter)
    for (let i = commonLen; i < eodArr.length; i++) {
      if (diffs.length >= maxDiffs) return true
      const childPath = path ? `${path}.${i}` : String(i)
      if (ignorePaths.has(childPath)) continue
      diffs.push({
        path: childPath,
        legacy: undefined,
        eod: eodArr[i],
        reason: 'extra_in_eod',
      })
    }
    return diffs.length >= maxDiffs
  }

  // Object — compare keys
  const legacyObj = legacy as Record<string, unknown>
  const eodObj = eod as Record<string, unknown>
  const legacyKeys = Object.keys(legacyObj)
  const eodKeys = new Set(Object.keys(eodObj))

  for (const key of legacyKeys) {
    if (diffs.length >= maxDiffs) return true
    const childPath = path ? `${path}.${key}` : key
    if (ignorePaths.has(childPath)) {
      eodKeys.delete(key)
      continue
    }
    if (!eodKeys.has(key)) {
      diffs.push({
        path: childPath,
        legacy: legacyObj[key],
        eod: undefined,
        reason: 'missing_in_eod',
      })
      continue
    }
    eodKeys.delete(key)
    const truncated = walkDiffs(
      legacyObj[key],
      eodObj[key],
      childPath,
      diffs,
      maxDiffs,
      ignorePaths,
    )
    if (truncated) return true
  }

  // Remaining keys у eod → extra_in_eod
  for (const key of eodKeys) {
    if (diffs.length >= maxDiffs) return true
    const childPath = path ? `${path}.${key}` : key
    if (ignorePaths.has(childPath)) continue
    diffs.push({
      path: childPath,
      legacy: undefined,
      eod: eodObj[key],
      reason: 'extra_in_eod',
    })
  }
  return diffs.length >= maxDiffs
}

type JsonShape =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'

/**
 * Categorize JSON shape. Primitives are returned as distinct types
 * (number vs string vs boolean) so type-mismatch detection catches
 * 1 vs "1" as different JSON types (per JSON spec).
 */
function jsonType(v: unknown): JsonShape {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object') return 'object'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return 'number'
  // string fallback for any other primitive (includes BigInt → stringify)
  return 'string'
}

function isPrimitive(shape: JsonShape): boolean {
  return shape === 'null' || shape === 'boolean' || shape === 'number' || shape === 'string'
}
