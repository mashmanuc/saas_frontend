/**
 * Mismatch classification tests — deterministic taxonomy.
 *
 * Per colleague review P1.5.e:
 *   - lossless + deterministic
 *   - multi-label
 *   - stable precedence ordering
 *   - unknown bucket (no throws)
 *   - empty baseline
 *   - mixed aggregation (real-world)
 *   - ordering detection (same elements, different order)
 */

import { describe, it, expect } from 'vitest'
import {
  CATEGORY_PRECEDENCE,
  classifyApplyOpDeltaReport,
  classifyParityReport,
} from '../classify'
import { compareSerializedSnapshots } from '../serializeParity'
import { compareApplyOpDelta } from '../applyOpParity'
import type { ParityReport } from '../types'

// ─── Precedence ─────────────────────────────────────────────────────────

describe('CATEGORY_PRECEDENCE', () => {
  it('declares 6 categories у stable order', () => {
    expect(CATEGORY_PRECEDENCE).toEqual([
      'type_mismatch',
      'missing_field',
      'extra_field',
      'value_mismatch',
      'ordering_mismatch',
      'unknown_mismatch',
    ])
  })

  it('is frozen', () => {
    expect(Object.isFrozen(CATEGORY_PRECEDENCE)).toBe(true)
  })
})

// ─── Empty baseline ────────────────────────────────────────────────────

describe('classifyParityReport — empty baseline', () => {
  it('empty diffs → all-zero counts, totalMismatches=0', () => {
    const report: ParityReport = {
      verdict: 'match',
      diffs: [],
      serializedLegacy: '{}',
      serializedEod: '{}',
      truncated: false,
    }
    const c = classifyParityReport(report)
    expect(c.totalMismatches).toBe(0)
    expect(c.classified).toEqual([])
    expect(c.countByCategory).toEqual({
      type_mismatch: 0,
      missing_field: 0,
      extra_field: 0,
      value_mismatch: 0,
      ordering_mismatch: 0,
      unknown_mismatch: 0,
    })
  })

  it('classifyApplyOpDeltaReport empty → zeros', () => {
    const c = classifyApplyOpDeltaReport({ mismatches: [] })
    expect(c.totalMismatches).toBe(0)
    expect(c.countByCategory.type_mismatch).toBe(0)
  })
})

// ─── Determinism ───────────────────────────────────────────────────────

describe('classifyParityReport — determinism', () => {
  it('same input → identical summary', () => {
    const report = compareSerializedSnapshots(
      { a: 1, b: 'x', c: { nested: 1 } },
      { a: 2, b: 99, c: { nested: 1, extra: 5 } },
    )
    const c1 = classifyParityReport(report)
    const c2 = classifyParityReport(report)
    expect(c1).toEqual(c2)
  })

  it('classified order matches report.diffs order', () => {
    const report = compareSerializedSnapshots(
      { a: 1, b: 2, c: 3 },
      { a: 99, b: 88, c: 77 },
    )
    const c = classifyParityReport(report)
    expect(c.classified.map((cd) => cd.path)).toEqual(
      report.diffs.map((d) => d.path),
    )
  })
})

// ─── ParityDiff reason mapping ─────────────────────────────────────────

describe('classifyParityReport — base category mapping', () => {
  it('type_mismatch → type_mismatch', () => {
    const r = compareSerializedSnapshots(1, '1')
    const c = classifyParityReport(r)
    expect(c.classified[0].categories).toEqual(['type_mismatch'])
    expect(c.countByCategory.type_mismatch).toBe(1)
  })

  it('missing_in_eod → missing_field', () => {
    const r = compareSerializedSnapshots({ a: 1, b: 2 }, { a: 1 })
    const c = classifyParityReport(r)
    expect(c.classified[0].categories).toEqual(['missing_field'])
    expect(c.countByCategory.missing_field).toBe(1)
  })

  it('extra_in_eod → extra_field', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 1, b: 2 })
    const c = classifyParityReport(r)
    expect(c.classified[0].categories).toEqual(['extra_field'])
    expect(c.countByCategory.extra_field).toBe(1)
  })

  it('value_mismatch → value_mismatch', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 2 })
    const c = classifyParityReport(r)
    expect(c.classified[0].categories).toEqual(['value_mismatch'])
  })

  it('length_mismatch → multi-label missing + extra', () => {
    const r = compareSerializedSnapshots([1, 2], [1, 2, 3])
    const c = classifyParityReport(r)
    const lengthDiff = c.classified.find((cd) =>
      cd.categories.includes('missing_field') &&
      cd.categories.includes('extra_field'),
    )
    expect(lengthDiff).toBeDefined()
    // Categories sorted by precedence
    expect(lengthDiff!.categories).toEqual(['missing_field', 'extra_field'])
  })
})

// ─── Multi-label ───────────────────────────────────────────────────────

describe('classifyParityReport — multi-label', () => {
  it('length_mismatch carries both missing_field + extra_field labels', () => {
    const r = compareSerializedSnapshots({ arr: [1] }, { arr: [1, 2, 3] })
    const c = classifyParityReport(r)
    // Length mismatch у arr path → multi-label
    const lengthDiff = c.classified.find((cd) => cd.path === 'arr')
    if (lengthDiff) {
      expect(lengthDiff.categories.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('categories within array sorted by precedence', () => {
    const r = compareSerializedSnapshots([1, 2], [1, 2, 3])
    const c = classifyParityReport(r)
    for (const cd of c.classified) {
      // Verify precedence order maintained
      const ranks = cd.categories.map((cat) => CATEGORY_PRECEDENCE.indexOf(cat))
      for (let i = 1; i < ranks.length; i++) {
        expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1])
      }
    }
  })
})

// ─── Unknown bucket ────────────────────────────────────────────────────

describe('classifyParityReport — unknown bucket safety', () => {
  it('synthetic future reason → unknown_mismatch (no throw)', () => {
    // Forge a diff з unknown reason
    const synth = {
      diffs: [
        {
          path: 'x',
          legacy: 1,
          eod: 2,
          // @ts-expect-error testing forward-compat
          reason: 'future_reason_not_yet_defined',
        },
      ],
    } as unknown as ParityReport
    expect(() => classifyParityReport(synth)).not.toThrow()
    const c = classifyParityReport(synth)
    expect(c.classified[0].categories).toEqual(['unknown_mismatch'])
    expect(c.countByCategory.unknown_mismatch).toBe(1)
  })
})

// ─── Ordering detection ────────────────────────────────────────────────

describe('classifyParityReport — ordering_mismatch detection', () => {
  it('same elements у different order → ordering_mismatch added', () => {
    // legacy = [A, B], eod = [B, A] → 2 value_mismatch diffs at indices 0, 1
    // Multiset(diffs.legacy) = {A,B} = Multiset(diffs.eod) → ordering
    const r = compareSerializedSnapshots(
      { arr: ['A', 'B'] },
      { arr: ['B', 'A'] },
    )
    const c = classifyParityReport(r)
    const arrDiffs = c.classified.filter((cd) =>
      cd.path.startsWith('arr.'),
    )
    expect(arrDiffs.length).toBe(2)
    for (const cd of arrDiffs) {
      expect(cd.categories).toContain('ordering_mismatch')
      // Multi-label — keeps value_mismatch too
      expect(cd.categories).toContain('value_mismatch')
    }
    expect(c.countByCategory.ordering_mismatch).toBe(2)
  })

  it('different lengths → NOT ordering_mismatch (per colleague rule)', () => {
    const r = compareSerializedSnapshots([1, 2], [1, 2, 3])
    const c = classifyParityReport(r)
    expect(c.countByCategory.ordering_mismatch).toBe(0)
  })

  it('different values + different order → NOT ordering_mismatch', () => {
    // legacy=[A,B], eod=[B,C] — different multisets
    const r = compareSerializedSnapshots(
      { arr: ['A', 'B'] },
      { arr: ['B', 'C'] },
    )
    const c = classifyParityReport(r)
    expect(c.countByCategory.ordering_mismatch).toBe(0)
  })

  it('single-element diff у array → NOT ordering (need >= 2)', () => {
    const r = compareSerializedSnapshots(
      { arr: ['A', 'B', 'C'] },
      { arr: ['A', 'X', 'C'] },
    )
    const c = classifyParityReport(r)
    // Only index 1 differs — single diff, no ordering pattern
    expect(c.countByCategory.ordering_mismatch).toBe(0)
  })

  it('nested array ordering detected', () => {
    const r = compareSerializedSnapshots(
      { pages: [{ strokes: ['s1', 's2'] }] },
      { pages: [{ strokes: ['s2', 's1'] }] },
    )
    const c = classifyParityReport(r)
    expect(c.countByCategory.ordering_mismatch).toBe(2)
  })
})

// ─── Mixed aggregation (real-world) ────────────────────────────────────

describe('classifyParityReport — mixed real-world aggregation', () => {
  it('mix of type/missing/extra/value/ordering', () => {
    const r = compareSerializedSnapshots(
      {
        version: 1,
        typed: 'number',
        existing_key: 1,
        arr: ['A', 'B'],
        unchanged: 'same',
      },
      {
        version: '1',          // type_mismatch (number → string)
        typed: 'number',
        // existing_key missing → missing_field
        arr: ['B', 'A'],       // ordering_mismatch
        unchanged: 'same',
        new_key: 'value',      // extra_field
      },
    )
    const c = classifyParityReport(r)
    expect(c.countByCategory.type_mismatch).toBeGreaterThanOrEqual(1)
    expect(c.countByCategory.missing_field).toBeGreaterThanOrEqual(1)
    expect(c.countByCategory.extra_field).toBeGreaterThanOrEqual(1)
    expect(c.countByCategory.ordering_mismatch).toBe(2)
    expect(c.totalMismatches).toBeGreaterThanOrEqual(4)
  })
})

// ─── ApplyOpDelta classifier ───────────────────────────────────────────

describe('classifyApplyOpDeltaReport — DeltaMismatch mapping', () => {
  const META = { op_type: 'asset_update', instance_id: 'a' }

  it('different_change_type → type_mismatch', () => {
    const r = compareApplyOpDelta(
      { existing: 0 },
      { existing: 0, new_field: 1 },     // legacy added 'new_field'
      { existing: 0, new_field: 5 },
      { existing: 0, new_field: 10 },    // eod changed 'new_field'
      META,
    )
    const c = classifyApplyOpDeltaReport(r)
    expect(c.countByCategory.type_mismatch).toBeGreaterThanOrEqual(1)
  })

  it('different_after → value_mismatch', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.7 },
      { theta: 0.5 },
      { theta: 0.9 },
      META,
    )
    const c = classifyApplyOpDeltaReport(r)
    expect(c.countByCategory.value_mismatch).toBeGreaterThanOrEqual(1)
  })

  it('only_in_legacy → missing_field', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.7 },
      { theta: 0.5 },
      { theta: 0.5 },
      META,
    )
    const c = classifyApplyOpDeltaReport(r)
    expect(c.countByCategory.missing_field).toBe(1)
  })

  it('only_in_eod → extra_field', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.5 },
      { theta: 0.5 },
      { theta: 0.7 },
      META,
    )
    const c = classifyApplyOpDeltaReport(r)
    expect(c.countByCategory.extra_field).toBe(1)
  })
})

// ─── Immutability ──────────────────────────────────────────────────────

describe('ClassificationSummary — immutability', () => {
  it('summary is frozen', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 2 })
    const c = classifyParityReport(r)
    expect(Object.isFrozen(c)).toBe(true)
    expect(Object.isFrozen(c.classified)).toBe(true)
    expect(Object.isFrozen(c.countByCategory)).toBe(true)
  })

  it('classified diffs frozen', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 2 })
    const c = classifyParityReport(r)
    if (c.classified.length > 0) {
      expect(Object.isFrozen(c.classified[0])).toBe(true)
      expect(Object.isFrozen(c.classified[0].categories)).toBe(true)
    }
  })

  it('mutation attempt throws', () => {
    const r = compareSerializedSnapshots({ a: 1 }, { a: 2 })
    const c = classifyParityReport(r)
    expect(() => {
      // @ts-expect-error testing runtime guard
      c.totalMismatches = 999
    }).toThrow(TypeError)
  })
})
