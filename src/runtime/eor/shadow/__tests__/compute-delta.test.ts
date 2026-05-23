/**
 * computeDelta tests — pure structural diff.
 *
 * Verifies:
 *   - Identical before/after → empty delta
 *   - added / removed / changed change types
 *   - Categorical counts correct
 *   - Array length changes detected per element
 *   - Nested paths use dot-notation
 *   - Frozen output
 *   - Pure (no input mutation)
 */

import { describe, it, expect } from 'vitest'
import { computeDelta } from '../compute-delta'

describe('computeDelta — no changes', () => {
  it('identical primitives → empty delta', () => {
    const r = computeDelta(42, 42)
    expect(r.changes).toEqual([])
    expect(r.changedCount).toBe(0)
    expect(r.addedCount).toBe(0)
    expect(r.removedCount).toBe(0)
  })

  it('identical objects → empty delta', () => {
    const r = computeDelta({ a: 1, b: 2 }, { a: 1, b: 2 })
    expect(r.changes).toEqual([])
  })

  it('identical nested → empty delta', () => {
    const a = { pages: [{ id: 'p1', strokes: [] }] }
    const b = { pages: [{ id: 'p1', strokes: [] }] }
    expect(computeDelta(a, b).changes).toEqual([])
  })

  it('null both → empty delta', () => {
    expect(computeDelta(null, null).changes).toEqual([])
  })
})

describe('computeDelta — added', () => {
  it('new key у after', () => {
    const r = computeDelta({ a: 1 }, { a: 1, b: 2 })
    expect(r.changes).toEqual([
      { path: 'b', changeType: 'added', before: undefined, after: 2 },
    ])
    expect(r.addedCount).toBe(1)
    expect(r.changedCount).toBe(0)
    expect(r.removedCount).toBe(0)
  })

  it('new array element', () => {
    const r = computeDelta([1, 2], [1, 2, 3])
    expect(r.changes).toEqual([
      { path: '2', changeType: 'added', before: undefined, after: 3 },
    ])
  })

  it('nested added', () => {
    const r = computeDelta(
      { pages: [{ id: 'p1', strokes: [] }] },
      { pages: [{ id: 'p1', strokes: [{ id: 's1' }] }] },
    )
    expect(r.changes).toEqual([
      {
        path: 'pages.0.strokes.0',
        changeType: 'added',
        before: undefined,
        after: { id: 's1' },
      },
    ])
  })
})

describe('computeDelta — removed', () => {
  it('key removed у after', () => {
    const r = computeDelta({ a: 1, b: 2 }, { a: 1 })
    expect(r.changes).toEqual([
      { path: 'b', changeType: 'removed', before: 2, after: undefined },
    ])
    expect(r.removedCount).toBe(1)
  })

  it('array element removed', () => {
    const r = computeDelta([1, 2, 3], [1, 2])
    expect(r.changes).toEqual([
      { path: '2', changeType: 'removed', before: 3, after: undefined },
    ])
  })
})

describe('computeDelta — changed', () => {
  it('primitive value change', () => {
    const r = computeDelta({ a: 1 }, { a: 2 })
    expect(r.changes).toEqual([
      { path: 'a', changeType: 'changed', before: 1, after: 2 },
    ])
    expect(r.changedCount).toBe(1)
  })

  it('type mismatch → changed at path', () => {
    const r = computeDelta({ a: 1 }, { a: '1' })
    expect(r.changes).toEqual([
      { path: 'a', changeType: 'changed', before: 1, after: '1' },
    ])
  })

  it('nested value change', () => {
    const r = computeDelta(
      { data: { theta: 0.5 } },
      { data: { theta: 0.7 } },
    )
    expect(r.changes).toEqual([
      { path: 'data.theta', changeType: 'changed', before: 0.5, after: 0.7 },
    ])
  })
})

describe('computeDelta — combined', () => {
  it('mix of added/removed/changed', () => {
    const before = { a: 1, b: 2, c: 3 }
    const after = { a: 99, b: 2, d: 4 }
    const r = computeDelta(before, after)
    expect(r.changedCount).toBe(1)  // a changed
    expect(r.removedCount).toBe(1)  // c removed
    expect(r.addedCount).toBe(1)    // d added
  })
})

describe('computeDelta — options', () => {
  it('maxChanges cap', () => {
    const before: Record<string, number> = {}
    const after: Record<string, number> = {}
    for (let i = 0; i < 100; i++) {
      before[`k${i}`] = i
      after[`k${i}`] = i + 1000
    }
    const r = computeDelta(before, after, { maxChanges: 10 })
    expect(r.changes).toHaveLength(10)
    expect(r.truncated).toBe(true)
  })

  it('ignorePaths skips subtree', () => {
    const r = computeDelta(
      { a: 1, b: 2 },
      { a: 99, b: 99 },
      { ignorePaths: ['a'] },
    )
    expect(r.changes.find((c) => c.path === 'a')).toBeUndefined()
    expect(r.changes.find((c) => c.path === 'b')).toBeDefined()
  })
})

describe('computeDelta — immutability + purity', () => {
  it('result is frozen', () => {
    const r = computeDelta({ a: 1 }, { a: 2 })
    expect(Object.isFrozen(r)).toBe(true)
    expect(Object.isFrozen(r.changes)).toBe(true)
  })

  it('does not mutate inputs', () => {
    const before = { a: 1, nested: { b: 2 } }
    const after = { a: 1, nested: { b: 99 } }
    const beforeSnapshot = JSON.parse(JSON.stringify(before))
    const afterSnapshot = JSON.parse(JSON.stringify(after))
    computeDelta(before, after)
    expect(before).toEqual(beforeSnapshot)
    expect(after).toEqual(afterSnapshot)
  })

  it('multiple calls return equivalent deltas', () => {
    const before = { a: 1 }
    const after = { a: 2 }
    const r1 = computeDelta(before, after)
    const r2 = computeDelta(before, after)
    expect(r1.changes).toEqual(r2.changes)
  })
})

describe('computeDelta — array semantics', () => {
  it('does not reorder arrays', () => {
    // Same content but different order → still detected як changed per index
    const r = computeDelta([1, 2, 3], [3, 2, 1])
    expect(r.changedCount).toBe(2)  // index 0 (1→3) and index 2 (3→1)
    expect(r.changes.find((c) => c.path === '0')).toBeDefined()
    expect(r.changes.find((c) => c.path === '2')).toBeDefined()
  })
})
