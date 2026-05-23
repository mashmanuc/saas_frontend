/**
 * compareReplaySnapshots tests — replay state parity (normalize + compare).
 *
 * Per colleague review P1.5.a — comparator must:
 *   1. Normalize (strip runtime_id + ephemeral keys)
 *   2. Compare via stable serialization
 *
 * Verifies that runtime_id / animating / hovered state DO NOT cause
 * false mismatches when underlying persisted state matches.
 */

import { describe, it, expect } from 'vitest'
import { compareReplaySnapshots } from '../replayParity'

describe('compareReplaySnapshots — runtime_id ignored', () => {
  it('different runtime_id → match (both have same persisted state)', () => {
    const legacy = {
      instance_id: 'abc',
      runtime_id: 100,
      template_id: 'helix@1',
      data: { theta: 0.5 },
    }
    const eod = {
      instance_id: 'abc',
      runtime_id: 999,  // different ephemeral runtime_id
      template_id: 'helix@1',
      data: { theta: 0.5 },
    }
    const r = compareReplaySnapshots(legacy, eod)
    expect(r.verdict).toBe('match')
    expect(r.diffs).toEqual([])
  })

  it('different runtime_id у nested asset → match', () => {
    const legacy = {
      pages: [{ assets: [{ id: 'a1', runtime_id: 1, data: { x: 0 } }] }],
    }
    const eod = {
      pages: [{ assets: [{ id: 'a1', runtime_id: 99, data: { x: 0 } }] }],
    }
    expect(compareReplaySnapshots(legacy, eod).verdict).toBe('match')
  })
})

describe('compareReplaySnapshots — ephemeral keys ignored', () => {
  it('different animating state → match', () => {
    const legacy = { theta: 0.5, animating: true }
    const eod = { theta: 0.5, animating: false }
    expect(compareReplaySnapshots(legacy, eod).verdict).toBe('match')
  })

  it('different selectedAnchor → match', () => {
    const legacy = { theta: 0.5, selectedAnchor: 'point-1' }
    const eod = { theta: 0.5, selectedAnchor: 'point-2' }
    expect(compareReplaySnapshots(legacy, eod).verdict).toBe('match')
  })

  it('different isLoading flag → match', () => {
    const legacy = { theta: 0.5, isLoading: true }
    const eod = { theta: 0.5, isLoading: false }
    expect(compareReplaySnapshots(legacy, eod).verdict).toBe('match')
  })
})

describe('compareReplaySnapshots — persisted state mismatch detected', () => {
  it('different theta → mismatch', () => {
    const r = compareReplaySnapshots(
      { theta: 0.5, animating: true },
      { theta: 0.7, animating: false },
    )
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs).toEqual([
      { path: 'theta', legacy: 0.5, eod: 0.7, reason: 'value_mismatch' },
    ])
  })

  it('different template_id → mismatch (persisted identity field)', () => {
    const r = compareReplaySnapshots(
      { instance_id: 'a', template_id: 'helix@1', runtime_id: 1 },
      { instance_id: 'a', template_id: 'helix@2', runtime_id: 99 },
    )
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs[0].path).toBe('template_id')
  })

  it('different page count → mismatch (length_mismatch у board_state)', () => {
    const legacy = {
      pages: [{ id: 'p1', strokes: [] }, { id: 'p2', strokes: [] }],
    }
    const eod = { pages: [{ id: 'p1', strokes: [] }] }
    const r = compareReplaySnapshots(legacy, eod)
    expect(r.verdict).toBe('mismatch')
    expect(r.diffs.some((d) => d.reason === 'length_mismatch')).toBe(true)
  })
})

describe('compareReplaySnapshots — board_state pipeline', () => {
  it('realistic helix snapshot with ephemeral noise → match', () => {
    const legacy = {
      pages: [
        {
          id: 'page-1',
          assets: [
            {
              instance_id: 'helix-001',
              runtime_id: 42,
              type: 'helix',
              data: {
                theta: 1.5,
                phi: 0.7,
                pitch: 0.3,
                showHelix: true,
                animating: true,   // ephemeral
                currentFrame: 12,  // ephemeral
              },
              x: 100,
              y: 50,
              w: 400,
              h: 300,
            },
          ],
          strokes: [],
        },
      ],
    }
    const eod = {
      pages: [
        {
          id: 'page-1',
          assets: [
            {
              instance_id: 'helix-001',
              runtime_id: 99,   // different
              type: 'helix',
              data: {
                theta: 1.5,
                phi: 0.7,
                pitch: 0.3,
                showHelix: true,
                animating: false,  // different
                currentFrame: 0,   // different
              },
              x: 100,
              y: 50,
              w: 400,
              h: 300,
            },
          ],
          strokes: [],
        },
      ],
    }
    expect(compareReplaySnapshots(legacy, eod).verdict).toBe('match')
  })

  it('realistic mismatch: stroke count differs → mismatch', () => {
    const legacy = {
      pages: [{ id: 'p1', strokes: [{ id: 's1' }, { id: 's2' }] }],
    }
    const eod = {
      pages: [{ id: 'p1', strokes: [{ id: 's1' }] }],
    }
    const r = compareReplaySnapshots(legacy, eod)
    expect(r.verdict).toBe('mismatch')
  })
})

describe('compareReplaySnapshots — extraEphemeralKeys for widget-specific', () => {
  it('NMT3D-style camera params can be marked ephemeral', () => {
    const legacy = {
      data: {
        params: { a: 1, b: 2 },
        cameraOrbit: 0.5,  // not у defaults but widget-specific ephemeral
      },
    }
    const eod = {
      data: {
        params: { a: 1, b: 2 },
        cameraOrbit: 1.7,
      },
    }
    expect(
      compareReplaySnapshots(legacy, eod, {
        extraEphemeralKeys: ['cameraOrbit'],
      }).verdict,
    ).toBe('match')
  })

  it('without extra keys → cameraOrbit causes mismatch (default behavior)', () => {
    const r = compareReplaySnapshots(
      { cameraOrbit: 0.5 },
      { cameraOrbit: 1.7 },
    )
    expect(r.verdict).toBe('mismatch')
  })
})

describe('compareReplaySnapshots — purity', () => {
  it('inputs not mutated', () => {
    const legacy = { runtime_id: 1, theta: 0.5, animating: true }
    const eod = { runtime_id: 2, theta: 0.5, animating: false }
    const legacyBefore = JSON.parse(JSON.stringify(legacy))
    const eodBefore = JSON.parse(JSON.stringify(eod))
    compareReplaySnapshots(legacy, eod)
    expect(legacy).toEqual(legacyBefore)
    expect(eod).toEqual(eodBefore)
  })
})
