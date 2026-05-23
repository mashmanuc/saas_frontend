/**
 * serializeParity tests — snapshot byte-equivalence comparison.
 *
 * Per colleague review P1.f:
 *   - Pure function (no side effects)
 *   - Isolated test harness
 *   - NO runtime / renderer / replay hooks
 *
 * Verifies:
 *   - Identical snapshots → verdict 'match', empty diffs
 *   - Property order independence (uses stable-stringify)
 *   - Mismatch reasons categorized (type/value/length/missing/extra)
 *   - maxDiffs caps diff collection
 *   - ignorePaths skip subtrees
 *   - Report frozen (immutable)
 */

import { describe, it, expect } from 'vitest'
import { compareSerializedSnapshots } from '../serializeParity'

describe('compareSerializedSnapshots — match cases', () => {
  it('identical primitives → match', () => {
    const r = compareSerializedSnapshots(42, 42)
    expect(r.verdict).toBe('match')
    expect(r.diffs).toEqual([])
  })

  it('identical objects → match', () => {
    const a = { x: 1, y: 2 }
    const b = { x: 1, y: 2 }
    const r = compareSerializedSnapshots(a, b)
    expect(r.verdict).toBe('match')
    expect(r.diffs).toEqual([])
  })

  it('property order independence', () => {
    const a = { x: 1, y: 2, z: 3 }
    const b = { z: 3, y: 2, x: 1 }
    const r = compareSerializedSnapshots(a, b)
    expect(r.verdict).toBe('match')
  })

  it('null both → match', () => {
    const r = compareSerializedSnapshots(null, null)
    expect(r.verdict).toBe('match')
  })

  it('empty arrays → match', () => {
    const r = compareSerializedSnapshots([], [])
    expect(r.verdict).toBe('match')
  })

  it('deeply nested same structure → match', () => {
    const a = { pages: [{ assets: [{ id: 'x', data: { v: 1 } }] }] }
    const b = { pages: [{ assets: [{ id: 'x', data: { v: 1 } }] }] }
    const r = compareSerializedSnapshots(a, b)
    expect(r.verdict).toBe('match')
  })
})

describe('compareSerializedSnapshots — primitive mismatch', () => {
  it('different numbers', () => {
    const r = compareSerializedSnapshots(1, 2)
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs).toHaveLength(1)
    expect(r.diffs[0]).toEqual({
      path: '',
      legacy: 1,
      eod: 2,
      reason: 'value_mismatch',
    })
  })

  it('number vs string → type_mismatch', () => {
    const r = compareSerializedSnapshots(1, '1')
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs[0].reason).toBe('type_mismatch')
  })

  it('null vs object → type_mismatch', () => {
    const r = compareSerializedSnapshots(null, {})
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs[0].reason).toBe('type_mismatch')
  })
})

describe('compareSerializedSnapshots — object mismatch', () => {
  it('missing_in_eod when legacy has extra key', () => {
    const r = compareSerializedSnapshots({ a: 1, b: 2 }, { a: 1 })
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs).toEqual([
      { path: 'b', legacy: 2, eod: undefined, reason: 'missing_in_eod' },
    ])
  })

  it('extra_in_eod when eod has extra key', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 1, b: 2 })
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs).toEqual([
      { path: 'b', legacy: undefined, eod: 2, reason: 'extra_in_eod' },
    ])
  })

  it('value_mismatch at nested path', () => {
    const r = compareSerializedSnapshots(
      { data: { theta: 0.5 } },
      { data: { theta: 0.7 } },
    )
    expect(r.diffs).toEqual([
      { path: 'data.theta', legacy: 0.5, eod: 0.7, reason: 'value_mismatch' },
    ])
  })

  it('multiple diffs collected', () => {
    const r = compareSerializedSnapshots(
      { a: 1, b: 2, c: 3 },
      { a: 99, b: 2, c: 88 },
    )
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs).toHaveLength(2)
    expect(r.diffs.map((d) => d.path)).toEqual(['a', 'c'])
  })
})

describe('compareSerializedSnapshots — array mismatch', () => {
  it('length_mismatch', () => {
    const r = compareSerializedSnapshots([1, 2], [1, 2, 3])
    expect(r.diffs).toContainEqual({
      path: '',
      legacy: 2,
      eod: 3,
      reason: 'length_mismatch',
    })
  })

  it('value_mismatch by index path', () => {
    const r = compareSerializedSnapshots([1, 2, 3], [1, 99, 3])
    expect(r.diffs).toEqual([
      { path: '1', legacy: 2, eod: 99, reason: 'value_mismatch' },
    ])
  })

  it('extra_in_eod for trailing items', () => {
    const r = compareSerializedSnapshots([1], [1, 2, 3])
    // length_mismatch reported at root (path '')
    expect(r.diffs).toContainEqual({
      path: '',
      legacy: 1,
      eod: 3,
      reason: 'length_mismatch',
    })
    // index 0 matches (both 1) — no diff there
    // trailing items reported individually at '1' and '2'
    const extras = r.diffs.filter((d) => d.reason === 'extra_in_eod')
    expect(extras).toHaveLength(2)
    expect(extras.map((d) => d.path)).toEqual(['1', '2'])
  })

  it('nested array path notation', () => {
    const r = compareSerializedSnapshots(
      { pages: [{ assets: [{ id: 'a', x: 0 }] }] },
      { pages: [{ assets: [{ id: 'a', x: 100 }] }] },
    )
    expect(r.diffs).toEqual([
      {
        path: 'pages.0.assets.0.x',
        legacy: 0,
        eod: 100,
        reason: 'value_mismatch',
      },
    ])
  })
})

describe('compareSerializedSnapshots — options', () => {
  it('respects maxDiffs cap', () => {
    const legacy: Record<string, number> = {}
    const eod: Record<string, number> = {}
    for (let i = 0; i < 100; i++) {
      legacy[`key${i}`] = i
      eod[`key${i}`] = i + 1000  // all values differ
    }
    const r = compareSerializedSnapshots(legacy, eod, { maxDiffs: 10 })
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs).toHaveLength(10)
    expect(r.truncated).toBe(true)
  })

  it('ignorePaths skips matched key', () => {
    const r = compareSerializedSnapshots(
      { a: 1, b: 2 },
      { a: 1, b: 999 },
      { ignorePaths: ['b'] },
    )
    // Path 'b' ignored — verdict still mismatch (because serialized strings
    // differ at top level), but diff walk omits the ignored path.
    expect(r.diffs.find((d) => d.path === 'b')).toBeUndefined()
  })

  it('ignorePaths with nested path', () => {
    const r = compareSerializedSnapshots(
      { meta: { last_snapshot_seq: 1 }, data: { x: 1 } },
      { meta: { last_snapshot_seq: 999 }, data: { x: 1 } },
      { ignorePaths: ['meta.last_snapshot_seq'] },
    )
    expect(
      r.diffs.find((d) => d.path === 'meta.last_snapshot_seq'),
    ).toBeUndefined()
  })

  it('default maxDiffs is 50', () => {
    const legacy: Record<string, number> = {}
    const eod: Record<string, number> = {}
    for (let i = 0; i < 200; i++) {
      legacy[`k${i}`] = i
      eod[`k${i}`] = i + 1000
    }
    const r = compareSerializedSnapshots(legacy, eod)
    expect(r.diffs.length).toBeLessThanOrEqual(50)
    expect(r.truncated).toBe(true)
  })
})

describe('compareSerializedSnapshots — report immutability', () => {
  it('report is frozen', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 1 })
    expect(Object.isFrozen(r)).toBe(true)
  })

  it('diffs array is frozen', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 2 })
    expect(Object.isFrozen(r.diffs)).toBe(true)
  })

  it('serializedLegacy + serializedEod present in match case', () => {
    const r = compareSerializedSnapshots({ x: 1 }, { x: 1 })
    expect(r.serializedLegacy).toBe('{"x":1}')
    expect(r.serializedEod).toBe('{"x":1}')
  })

  it('serializedLegacy + serializedEod present in mismatch case', () => {
    const r = compareSerializedSnapshots({ x: 1 }, { x: 2 })
    expect(r.serializedLegacy).toBe('{"x":1}')
    expect(r.serializedEod).toBe('{"x":2}')
  })
})

describe('compareSerializedSnapshots — purity', () => {
  it('does not mutate inputs', () => {
    const legacy = { a: 1, nested: { b: 2 } }
    const eod = { a: 1, nested: { b: 99 } }
    const legacyBefore = JSON.parse(JSON.stringify(legacy))
    const eodBefore = JSON.parse(JSON.stringify(eod))
    compareSerializedSnapshots(legacy, eod)
    expect(legacy).toEqual(legacyBefore)
    expect(eod).toEqual(eodBefore)
  })

  it('multiple calls with same inputs return equivalent reports', () => {
    const a = { x: 1 }
    const b = { x: 2 }
    const r1 = compareSerializedSnapshots(a, b)
    const r2 = compareSerializedSnapshots(a, b)
    expect(r1.verdict).toBe(r2.verdict)
    expect(r1.diffs).toEqual(r2.diffs)
    expect(r1.serializedLegacy).toBe(r2.serializedLegacy)
  })
})
