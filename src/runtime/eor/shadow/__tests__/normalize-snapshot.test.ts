/**
 * normalizeForReplayParity tests — strip ephemeral keys + runtime_id.
 */

import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EPHEMERAL_KEYS,
  normalizeForReplayParity,
} from '../normalize-snapshot'

describe('DEFAULT_EPHEMERAL_KEYS', () => {
  it('is a frozen Set', () => {
    expect(Object.isFrozen(DEFAULT_EPHEMERAL_KEYS)).toBe(true)
  })

  it('includes runtime_id (per ID-MIG-INV-5)', () => {
    expect(DEFAULT_EPHEMERAL_KEYS.has('runtime_id')).toBe(true)
  })

  it('includes animation playback state', () => {
    expect(DEFAULT_EPHEMERAL_KEYS.has('animating')).toBe(true)
    expect(DEFAULT_EPHEMERAL_KEYS.has('currentFrame')).toBe(true)
    expect(DEFAULT_EPHEMERAL_KEYS.has('playbackSpeed')).toBe(true)
  })

  it('includes selection / hover UI state', () => {
    expect(DEFAULT_EPHEMERAL_KEYS.has('selectedAnchor')).toBe(true)
    expect(DEFAULT_EPHEMERAL_KEYS.has('hoveredHandle')).toBe(true)
  })

  it('includes loading flags', () => {
    expect(DEFAULT_EPHEMERAL_KEYS.has('isApplyingExternalState')).toBe(true)
    expect(DEFAULT_EPHEMERAL_KEYS.has('isLoading')).toBe(true)
  })

  it('does NOT include persisted fields', () => {
    expect(DEFAULT_EPHEMERAL_KEYS.has('instance_id')).toBe(false)
    expect(DEFAULT_EPHEMERAL_KEYS.has('template_id')).toBe(false)
    expect(DEFAULT_EPHEMERAL_KEYS.has('theta')).toBe(false)
    expect(DEFAULT_EPHEMERAL_KEYS.has('expressions')).toBe(false)
  })
})

describe('normalizeForReplayParity — primitives', () => {
  it('null', () => {
    expect(normalizeForReplayParity(null)).toBeNull()
  })

  it('undefined', () => {
    expect(normalizeForReplayParity(undefined)).toBeUndefined()
  })

  it('numbers', () => {
    expect(normalizeForReplayParity(42)).toBe(42)
  })

  it('strings', () => {
    expect(normalizeForReplayParity('hello')).toBe('hello')
  })

  it('booleans', () => {
    expect(normalizeForReplayParity(true)).toBe(true)
    expect(normalizeForReplayParity(false)).toBe(false)
  })
})

describe('normalizeForReplayParity — drops ephemeral keys', () => {
  it('drops runtime_id at top level', () => {
    const result = normalizeForReplayParity({
      instance_id: 'abc',
      runtime_id: 42,
      template_id: 'helix@1',
    })
    expect(result).toEqual({ instance_id: 'abc', template_id: 'helix@1' })
  })

  it('drops animating + currentFrame', () => {
    const result = normalizeForReplayParity({
      theta: 0.5,
      animating: true,
      currentFrame: 42,
    })
    expect(result).toEqual({ theta: 0.5 })
  })

  it('drops nested ephemeral keys', () => {
    const result = normalizeForReplayParity({
      pages: [
        {
          assets: [
            {
              instance_id: 'a1',
              runtime_id: 99,
              data: { theta: 0.5, animating: true },
            },
          ],
        },
      ],
    })
    expect(result).toEqual({
      pages: [
        {
          assets: [
            {
              instance_id: 'a1',
              data: { theta: 0.5 },
            },
          ],
        },
      ],
    })
  })

  it('preserves persisted fields', () => {
    const result = normalizeForReplayParity({
      version: 1,
      type: 'helix',
      theta: 0.5,
      showHelix: true,
    })
    expect(result).toEqual({
      version: 1,
      type: 'helix',
      theta: 0.5,
      showHelix: true,
    })
  })
})

describe('normalizeForReplayParity — array elementwise', () => {
  it('processes array elements but preserves order', () => {
    const result = normalizeForReplayParity([
      { id: 'b', runtime_id: 2 },
      { id: 'a', runtime_id: 1 },
    ])
    expect(result).toEqual([{ id: 'b' }, { id: 'a' }])
  })

  it('does NOT reorder arrays (preserves board_state semantics)', () => {
    const result = normalizeForReplayParity({
      pages: [{ id: 'z' }, { id: 'a' }, { id: 'm' }],
    })
    expect((result as { pages: { id: string }[] }).pages.map((p) => p.id)).toEqual(
      ['z', 'a', 'm'],
    )
  })

  it('arrays of primitives unchanged', () => {
    expect(normalizeForReplayParity([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('empty array', () => {
    expect(normalizeForReplayParity([])).toEqual([])
  })
})

describe('normalizeForReplayParity — purity', () => {
  it('does not mutate input', () => {
    const input = {
      instance_id: 'abc',
      runtime_id: 42,
      nested: { animating: true, theta: 0.5 },
      arr: [{ runtime_id: 1, x: 0 }],
    }
    const before = JSON.parse(JSON.stringify(input))
    normalizeForReplayParity(input)
    expect(input).toEqual(before)
  })

  it('returns new object reference', () => {
    const input = { a: 1 }
    const result = normalizeForReplayParity(input)
    expect(result).not.toBe(input)
  })

  it('idempotent: normalize(normalize(x)) === normalize(x)', () => {
    const input = {
      instance_id: 'abc',
      runtime_id: 42,
      pages: [{ runtime_id: 99, assets: [{ animating: true, theta: 0.5 }] }],
    }
    const once = normalizeForReplayParity(input)
    const twice = normalizeForReplayParity(once)
    expect(twice).toEqual(once)
  })
})

describe('normalizeForReplayParity — options', () => {
  it('extraEphemeralKeys adds to defaults', () => {
    const result = normalizeForReplayParity(
      {
        runtime_id: 1,
        tabFocus: 'params',
        theta: 0.5,
      },
      { extraEphemeralKeys: ['tabFocus'] },
    )
    expect(result).toEqual({ theta: 0.5 })
  })

  it('extraEphemeralKeys does not exclude defaults', () => {
    const result = normalizeForReplayParity(
      {
        runtime_id: 1,
        tabFocus: 'params',
        theta: 0.5,
      },
      { extraEphemeralKeys: ['tabFocus'] },
    )
    expect((result as Record<string, unknown>).runtime_id).toBeUndefined()
  })

  it('ephemeralKeys override replaces defaults entirely', () => {
    const result = normalizeForReplayParity(
      {
        runtime_id: 1,
        animating: true,
        theta: 0.5,
      },
      { ephemeralKeys: new Set(['theta']) },
    )
    // With custom override, runtime_id and animating are kept
    expect(result).toEqual({ runtime_id: 1, animating: true })
  })
})
