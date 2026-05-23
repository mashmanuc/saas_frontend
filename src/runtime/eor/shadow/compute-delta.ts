/**
 * computeDelta — pure structural diff between two state snapshots.
 *
 * Per colleague review P1.5.b — delta computation MUST be STRUCTURAL:
 *
 *   YES: field changed / removed / added, array length changed, value changed
 *   NO:  op semantics, intent-aware, "stroke_add should behave like..."
 *
 * Does NOT apply ops. Does NOT know transport policies. Does NOT know
 * replay order. Just compares two snapshots і describes what changed.
 *
 * Reused for applyOp parity (P1.5.b) where we compute deltas per side
 * (legacy before→after) and (eod before→after) then compare those deltas.
 *
 * Path notation matches P1.f/P1.5.a (dot-notation with array indices).
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md §15.4
 */

/**
 * Categorical change type per delta entry.
 */
export type DeltaChangeType = 'added' | 'removed' | 'changed'

/**
 * Single delta entry — one path that changed between before and after.
 */
export interface DeltaChange {
  readonly path: string
  readonly changeType: DeltaChangeType
  readonly before: unknown
  readonly after: unknown
}

/**
 * Summary of structural delta. Used by shadow telemetry та dashboards.
 *
 * Provides changed/added/removed counts for quick mismatch clustering
 * without enumerating all paths.
 */
export interface DeltaSummary {
  readonly changes: readonly DeltaChange[]
  readonly changedCount: number
  readonly addedCount: number
  readonly removedCount: number
  readonly truncated: boolean
}

export interface ComputeDeltaOptions {
  /**
   * Maximum number of changes to collect before stopping recursion.
   * Default: 200. Prevents huge deltas for structural mismatches.
   */
  readonly maxChanges?: number

  /**
   * Dot-paths to ignore (treat as unchanged).
   */
  readonly ignorePaths?: readonly string[]
}

const DEFAULT_MAX_CHANGES = 200

/**
 * Compute structural delta between two snapshots.
 *
 * Pure function. Returns categorized list of changes + counts. Result
 * is frozen — safe to share / log / serialize.
 */
export function computeDelta(
  before: unknown,
  after: unknown,
  options: ComputeDeltaOptions = {},
): DeltaSummary {
  const maxChanges = options.maxChanges ?? DEFAULT_MAX_CHANGES
  const ignorePaths = new Set(options.ignorePaths ?? [])
  const changes: DeltaChange[] = []
  const truncated = walkDelta(before, after, '', changes, maxChanges, ignorePaths)

  // Categorical counts — derived from changes list
  let changedCount = 0
  let addedCount = 0
  let removedCount = 0
  for (const c of changes) {
    if (c.changeType === 'changed') changedCount++
    else if (c.changeType === 'added') addedCount++
    else if (c.changeType === 'removed') removedCount++
  }

  return Object.freeze({
    changes: Object.freeze(changes),
    changedCount,
    addedCount,
    removedCount,
    truncated,
  })
}

/**
 * Recursive delta walker. Returns true if truncation hit.
 *
 * Conventions matching serializeParity.ts:
 *   - dot-paths з array indices
 *   - 'added' = key/index present у after, not у before
 *   - 'removed' = key/index present у before, not у after
 *   - 'changed' = same path у both with different values
 *   - type mismatch / length mismatch → recorded as 'changed' at parent
 *     (path describes what changed, before/after carry old + new values)
 */
function walkDelta(
  before: unknown,
  after: unknown,
  path: string,
  changes: DeltaChange[],
  maxChanges: number,
  ignorePaths: Set<string>,
): boolean {
  if (changes.length >= maxChanges) return true
  if (ignorePaths.has(path)) return false
  if (Object.is(before, after)) return false

  const beforeType = jsonType(before)
  const afterType = jsonType(after)

  // Type mismatch → record at this path
  if (beforeType !== afterType) {
    changes.push({
      path,
      changeType: 'changed',
      before,
      after,
    })
    return changes.length >= maxChanges
  }

  // Same primitive type, different values
  if (isPrimitive(beforeType)) {
    changes.push({
      path,
      changeType: 'changed',
      before,
      after,
    })
    return changes.length >= maxChanges
  }

  // Array — compare elementwise + length
  if (beforeType === 'array') {
    const beforeArr = before as unknown[]
    const afterArr = after as unknown[]
    const commonLen = Math.min(beforeArr.length, afterArr.length)
    for (let i = 0; i < commonLen; i++) {
      const childPath = path ? `${path}.${i}` : String(i)
      const truncated = walkDelta(
        beforeArr[i],
        afterArr[i],
        childPath,
        changes,
        maxChanges,
        ignorePaths,
      )
      if (truncated) return true
    }
    // Removed elements (у before, not у after)
    for (let i = commonLen; i < beforeArr.length; i++) {
      if (changes.length >= maxChanges) return true
      const childPath = path ? `${path}.${i}` : String(i)
      if (ignorePaths.has(childPath)) continue
      changes.push({
        path: childPath,
        changeType: 'removed',
        before: beforeArr[i],
        after: undefined,
      })
    }
    // Added elements (у after, not у before)
    for (let i = commonLen; i < afterArr.length; i++) {
      if (changes.length >= maxChanges) return true
      const childPath = path ? `${path}.${i}` : String(i)
      if (ignorePaths.has(childPath)) continue
      changes.push({
        path: childPath,
        changeType: 'added',
        before: undefined,
        after: afterArr[i],
      })
    }
    return changes.length >= maxChanges
  }

  // Object — compare keys
  const beforeObj = before as Record<string, unknown>
  const afterObj = after as Record<string, unknown>
  const beforeKeys = Object.keys(beforeObj)
  const afterKeys = new Set(Object.keys(afterObj))

  for (const key of beforeKeys) {
    if (changes.length >= maxChanges) return true
    const childPath = path ? `${path}.${key}` : key
    if (ignorePaths.has(childPath)) {
      afterKeys.delete(key)
      continue
    }
    if (!afterKeys.has(key)) {
      changes.push({
        path: childPath,
        changeType: 'removed',
        before: beforeObj[key],
        after: undefined,
      })
      continue
    }
    afterKeys.delete(key)
    const truncated = walkDelta(
      beforeObj[key],
      afterObj[key],
      childPath,
      changes,
      maxChanges,
      ignorePaths,
    )
    if (truncated) return true
  }

  for (const key of afterKeys) {
    if (changes.length >= maxChanges) return true
    const childPath = path ? `${path}.${key}` : key
    if (ignorePaths.has(childPath)) continue
    changes.push({
      path: childPath,
      changeType: 'added',
      before: undefined,
      after: afterObj[key],
    })
  }
  return changes.length >= maxChanges
}

type JsonShape =
  | 'null'
  | 'boolean'
  | 'number'
  | 'string'
  | 'array'
  | 'object'

function jsonType(v: unknown): JsonShape {
  if (v === null || v === undefined) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'object') return 'object'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'number') return 'number'
  return 'string'
}

function isPrimitive(shape: JsonShape): boolean {
  return (
    shape === 'null' || shape === 'boolean' || shape === 'number' || shape === 'string'
  )
}
