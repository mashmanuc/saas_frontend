/**
 * compareApplyOpDelta tests — per-op parity (delta vs delta).
 *
 * Per colleague review P1.5.b:
 *   - Compare DELTAS, not after-states only
 *   - Catches: accidental no-op masking, compensating mutations
 *   - Pure structural — no op semantics
 *   - op_metadata for DIAGNOSTICS ONLY (not branched on)
 */

import { describe, it, expect } from 'vitest'
import { compareApplyOpDelta } from '../applyOpParity'

const META = { op_type: 'asset_update', instance_id: 'helix-001' }

describe('compareApplyOpDelta — identical deltas → match', () => {
  it('both sides made same change', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.7 },
      { theta: 0.5 },
      { theta: 0.7 },
      META,
    )
    expect(r.verdict).toBe('match')
    expect(r.mismatches).toEqual([])
    expect(r.legacyDelta.changedCount).toBe(1)
    expect(r.eodDelta.changedCount).toBe(1)
  })

  it('both sides no-op', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.5 },
      { theta: 0.5 },
      { theta: 0.5 },
      META,
    )
    expect(r.verdict).toBe('match')
    expect(r.legacyDelta.changes).toEqual([])
    expect(r.eodDelta.changes).toEqual([])
  })
})

describe('compareApplyOpDelta — same final state but different deltas', () => {
  it('catches accidental no-op masking', () => {
    // Legacy: no change (theta stays 0.5)
    // EOD: changed to 0.7, then back to 0.5 — final state matches but
    // delta differs (no change vs change-then-restore).
    // We model that as before→after only — у real case if EOD ended with
    // same value, delta would be empty too. So this test is conceptual.
    // Real catch: when both ended same but ONE side had a different
    // intermediate move. Since applyOp is atomic-per-op, "intermediate"
    // would be different ops. Here we test: what if EOD recorded a value
    // change that legacy did not (e.g., set a derived field).
    const r = compareApplyOpDelta(
      { theta: 0.5 },           // legacy before
      { theta: 0.5 },           // legacy after (no change)
      { theta: 0.5 },           // eod before
      { theta: 0.5, derived: 1 }, // eod after (extra derived field)
      META,
    )
    expect(r.verdict).toBe('mismatch')
    // legacy delta: empty
    // eod delta: added 'derived'
    expect(r.legacyDelta.changes).toEqual([])
    expect(r.eodDelta.addedCount).toBe(1)
    expect(r.mismatches.some((m) => m.reason === 'only_in_eod')).toBe(true)
  })

  it('catches divergent delta direction', () => {
    // Legacy: theta 0.5 → 0.7
    // EOD: theta 0.5 → 0.9
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.7 },
      { theta: 0.5 },
      { theta: 0.9 },
      META,
    )
    expect(r.verdict).toBe('mismatch')
    expect(r.mismatches[0].reason).toBe('different_after')
    expect(r.mismatches[0].path).toBe('theta')
  })
})

describe('compareApplyOpDelta — different change types у legacy vs eod', () => {
  it('legacy adds, eod changes', () => {
    const r = compareApplyOpDelta(
      { existing: 0 },              // legacy before
      { existing: 0, new_field: 1 }, // legacy added 'new_field'
      { existing: 0, new_field: 5 }, // eod before (already has new_field)
      { existing: 0, new_field: 10 },// eod changed 'new_field'
      META,
    )
    expect(r.verdict).toBe('mismatch')
    expect(r.mismatches.some((m) => m.reason === 'different_change_type')).toBe(
      true,
    )
  })
})

describe('compareApplyOpDelta — only_in_legacy / only_in_eod', () => {
  it('legacy changes path, eod does not', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.7 },
      { theta: 0.5 },
      { theta: 0.5 },
      META,
    )
    expect(r.verdict).toBe('mismatch')
    expect(r.mismatches).toEqual([
      expect.objectContaining({ path: 'theta', reason: 'only_in_legacy' }),
    ])
  })

  it('eod changes path, legacy does not', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5 },
      { theta: 0.5 },
      { theta: 0.5 },
      { theta: 0.7 },
      META,
    )
    expect(r.mismatches).toEqual([
      expect.objectContaining({ path: 'theta', reason: 'only_in_eod' }),
    ])
  })
})

describe('compareApplyOpDelta — ephemeral noise filtered', () => {
  it('runtime_id changes ignored', () => {
    const r = compareApplyOpDelta(
      { runtime_id: 1, theta: 0.5 },
      { runtime_id: 2, theta: 0.7 },  // runtime_id changed (ephemeral)
      { runtime_id: 99, theta: 0.5 },
      { runtime_id: 100, theta: 0.7 }, // different runtime_id move (ephemeral)
      META,
    )
    expect(r.verdict).toBe('match')
  })

  it('animation state changes ignored', () => {
    const r = compareApplyOpDelta(
      { theta: 0.5, animating: false },
      { theta: 0.7, animating: true },
      { theta: 0.5, animating: false },
      { theta: 0.7, animating: false }, // different animation handling
      META,
    )
    expect(r.verdict).toBe('match')
  })
})

describe('compareApplyOpDelta — op_metadata is diagnostic only', () => {
  it('op_metadata included у report unchanged', () => {
    const customMeta = { op_type: 'eo_param_set', instance_id: 'graph-77' }
    const r = compareApplyOpDelta(
      { x: 0 },
      { x: 1 },
      { x: 0 },
      { x: 1 },
      customMeta,
    )
    expect(r.opMetadata).toEqual(customMeta)
  })

  it('different op_metadata does NOT affect verdict (logic is structural)', () => {
    const r1 = compareApplyOpDelta(
      { x: 0 },
      { x: 1 },
      { x: 0 },
      { x: 1 },
      { op_type: 'asset_update', instance_id: 'a' },
    )
    const r2 = compareApplyOpDelta(
      { x: 0 },
      { x: 1 },
      { x: 0 },
      { x: 1 },
      { op_type: 'eo_param_set', instance_id: 'b' },
    )
    expect(r1.verdict).toBe(r2.verdict)
    expect(r1.mismatches).toEqual(r2.mismatches)
  })
})

describe('compareApplyOpDelta — report structure', () => {
  it('includes both delta summaries', () => {
    const r = compareApplyOpDelta(
      { a: 1 },
      { a: 2 },
      { a: 1 },
      { a: 2 },
      META,
    )
    expect(r.legacyDelta).toBeDefined()
    expect(r.eodDelta).toBeDefined()
    expect(r.legacyDelta.changedCount).toBe(1)
    expect(r.eodDelta.changedCount).toBe(1)
  })

  it('report is frozen', () => {
    const r = compareApplyOpDelta({ a: 1 }, { a: 2 }, { a: 1 }, { a: 2 }, META)
    expect(Object.isFrozen(r)).toBe(true)
    expect(Object.isFrozen(r.mismatches)).toBe(true)
    expect(Object.isFrozen(r.opMetadata)).toBe(true)
  })
})

describe('compareApplyOpDelta — purity', () => {
  it('inputs not mutated', () => {
    const lb = { a: 1 }
    const la = { a: 2 }
    const eb = { a: 1 }
    const ea = { a: 2 }
    const snapshots = {
      lb: JSON.parse(JSON.stringify(lb)),
      la: JSON.parse(JSON.stringify(la)),
      eb: JSON.parse(JSON.stringify(eb)),
      ea: JSON.parse(JSON.stringify(ea)),
    }
    compareApplyOpDelta(lb, la, eb, ea, META)
    expect(lb).toEqual(snapshots.lb)
    expect(la).toEqual(snapshots.la)
    expect(eb).toEqual(snapshots.eb)
    expect(ea).toEqual(snapshots.ea)
  })
})

describe('compareApplyOpDelta — realistic scenarios', () => {
  it('helix-style param tweak: both sides identical → match', () => {
    const before = {
      pages: [
        {
          assets: [
            {
              instance_id: 'helix-001',
              runtime_id: 1,
              data: { theta: 1.0, phi: 0.5, animating: false },
            },
          ],
        },
      ],
    }
    const legacyAfter = {
      pages: [
        {
          assets: [
            {
              instance_id: 'helix-001',
              runtime_id: 1,
              data: { theta: 1.5, phi: 0.5, animating: false },  // theta tweaked
            },
          ],
        },
      ],
    }
    const eodAfter = {
      pages: [
        {
          assets: [
            {
              instance_id: 'helix-001',
              runtime_id: 99,  // different ephemeral
              data: { theta: 1.5, phi: 0.5, animating: true },  // animating diverged (ephemeral)
            },
          ],
        },
      ],
    }
    const r = compareApplyOpDelta(before, legacyAfter, before, eodAfter, META)
    expect(r.verdict).toBe('match')
  })
})
