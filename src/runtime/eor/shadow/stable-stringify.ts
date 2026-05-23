/**
 * stableStringify — deterministic JSON with sorted keys.
 *
 * SSOT §15.4. Used by serialize parity comparator. Pure function — same
 * input always produces same output, regardless of property insertion order.
 *
 * Algorithm:
 *   - primitives → JSON.stringify (handles strings, numbers, bool, null)
 *   - arrays     → '[' + recursive elements + ']' (order preserved — array
 *                  ordering is semantic у board_state)
 *   - objects    → '{' + sorted keys + ':' + recursive values + '}'
 *   - undefined  → omitted (matches JSON.stringify behavior)
 */

/**
 * Recursively stringify value with sorted object keys.
 *
 * NOT a general-purpose JSON encoder — does not handle Date, BigInt,
 * Map/Set, or circular references. Inputs MUST be plain JSON-shaped
 * data (objects, arrays, strings, numbers, booleans, null).
 *
 * For shadow parity у P1.f, this constraint is fine — we only compare
 * already-serialized board_state JSON shapes.
 */
export function stableStringify(value: unknown): string {
  if (value === null) return 'null'
  if (value === undefined) return 'null'
  // Primitives + functions (functions stringify to undefined which we coerce)
  if (typeof value !== 'object') {
    // JSON.stringify handles strings (with escaping), numbers, booleans
    const str = JSON.stringify(value)
    return str === undefined ? 'null' : str
  }
  if (Array.isArray(value)) {
    return '[' + value.map((v) => stableStringify(v)).join(',') + ']'
  }
  // Plain object — sort keys для determinism
  const obj = value as Record<string, unknown>
  const keys = Object.keys(obj).sort()
  const pairs = keys.map((k) => {
    const keyStr = JSON.stringify(k)
    const valStr = stableStringify(obj[k])
    return keyStr + ':' + valStr
  })
  return '{' + pairs.join(',') + '}'
}
