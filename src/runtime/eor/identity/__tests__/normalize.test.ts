/**
 * normalizeIdentity tests — pure canonicalization.
 *
 * Verifies:
 *   - Legacy asset (only instance_id) → all defaults applied
 *   - Modern asset (all fields) → preserve values
 *   - template_id default = `${typeFallback}@1`
 *   - origin_id / canonical_id default = null
 *   - derived_chain default = [] (frozen)
 *   - Idempotency: normalize(normalize(x)) === normalize(x)
 *   - Pure: same input → same output, no side effects
 *   - NO runtime_id у output (boundary separation)
 */

import { describe, it, expect } from 'vitest'
import { normalizeIdentity } from '../normalize'
import type { EOIdentity, NormalizedEOIdentity } from '../../types/identity'

describe('normalizeIdentity — legacy asset (only instance_id)', () => {
  it('fills template_id from typeFallback', () => {
    const raw: EOIdentity = { instance_id: 'abc-123' }
    const normalized = normalizeIdentity(raw, 'trig_circle')
    expect(normalized.template_id).toBe('trig_circle@1')
  })

  it('fills origin_id with null', () => {
    const normalized = normalizeIdentity({ instance_id: 'abc' }, 'helix')
    expect(normalized.origin_id).toBeNull()
  })

  it('fills derived_chain with empty array', () => {
    const normalized = normalizeIdentity({ instance_id: 'abc' }, 'helix')
    expect(normalized.derived_chain).toEqual([])
  })

  it('fills canonical_id with null', () => {
    const normalized = normalizeIdentity({ instance_id: 'abc' }, 'helix')
    expect(normalized.canonical_id).toBeNull()
  })

  it('preserves instance_id verbatim', () => {
    const normalized = normalizeIdentity({ instance_id: 'unique-uuid-xyz' }, 'helix')
    expect(normalized.instance_id).toBe('unique-uuid-xyz')
  })

  it('output does NOT contain runtime_id (boundary separation)', () => {
    const normalized = normalizeIdentity({ instance_id: 'abc' }, 'helix')
    expect((normalized as Record<string, unknown>).runtime_id).toBeUndefined()
  })
})

describe('normalizeIdentity — modern asset (all fields)', () => {
  it('preserves all provided fields', () => {
    const raw: EOIdentity = {
      instance_id: 'abc',
      template_id: 'graph_calculator@2',
      origin_id: 'parent-id',
      derived_chain: ['ancestor-1', 'ancestor-2'],
      canonical_id: 'marketplace-canonical',
    }
    const normalized = normalizeIdentity(raw, 'fallback_type')
    expect(normalized.instance_id).toBe('abc')
    expect(normalized.template_id).toBe('graph_calculator@2')
    expect(normalized.origin_id).toBe('parent-id')
    expect(normalized.derived_chain).toEqual(['ancestor-1', 'ancestor-2'])
    expect(normalized.canonical_id).toBe('marketplace-canonical')
  })

  it('typeFallback ignored when template_id provided', () => {
    const raw: EOIdentity = { instance_id: 'abc', template_id: 'real@5' }
    const normalized = normalizeIdentity(raw, 'should_not_appear')
    expect(normalized.template_id).toBe('real@5')
  })
})

describe('normalizeIdentity — derived_chain immutability', () => {
  it('derived_chain is frozen у output', () => {
    const normalized = normalizeIdentity({ instance_id: 'abc' }, 'helix')
    expect(Object.isFrozen(normalized.derived_chain)).toBe(true)
  })

  it('derived_chain from input is copied (not aliased)', () => {
    const input = ['a', 'b']
    const normalized = normalizeIdentity(
      { instance_id: 'abc', derived_chain: input },
      'helix',
    )
    // Mutation of input does NOT affect output
    input.push('c')
    expect(normalized.derived_chain).toEqual(['a', 'b'])
  })

  it('frozen output array rejects mutation', () => {
    const normalized = normalizeIdentity(
      { instance_id: 'abc', derived_chain: ['a'] },
      'helix',
    )
    expect(() => {
      ;(normalized.derived_chain as string[]).push('attempted')
    }).toThrow(TypeError)
  })
})

describe('normalizeIdentity — idempotency', () => {
  it('normalize(normalize(x)) deep-equals normalize(x) [legacy input]', () => {
    const raw: EOIdentity = { instance_id: 'abc' }
    const once = normalizeIdentity(raw, 'helix')
    // Second pass: feed normalized back as raw input. typeFallback ignored
    // because template_id now set.
    const twice = normalizeIdentity(once, 'helix')
    expect(twice).toEqual(once)
  })

  it('normalize(normalize(x)) deep-equals normalize(x) [modern input]', () => {
    const raw: EOIdentity = {
      instance_id: 'abc',
      template_id: 'graph@3',
      origin_id: 'parent',
      derived_chain: ['a'],
      canonical_id: 'canon',
    }
    const once = normalizeIdentity(raw, 'fallback')
    const twice = normalizeIdentity(once, 'fallback')
    expect(twice).toEqual(once)
  })
})

describe('normalizeIdentity — purity / determinism', () => {
  it('same input + typeFallback → same output (no randomness)', () => {
    const raw: EOIdentity = { instance_id: 'abc' }
    const a = normalizeIdentity(raw, 'helix')
    const b = normalizeIdentity(raw, 'helix')
    expect(a).toEqual(b)
  })

  it('does not mutate input', () => {
    const raw: EOIdentity = { instance_id: 'abc', derived_chain: ['x'] }
    const before = JSON.parse(JSON.stringify(raw))
    normalizeIdentity(raw, 'helix')
    expect(raw).toEqual(before)
  })

  it('produces NormalizedEOIdentity shape (5 fields)', () => {
    const normalized: NormalizedEOIdentity = normalizeIdentity(
      { instance_id: 'abc' },
      'helix',
    )
    const keys = Object.keys(normalized).sort()
    expect(keys).toEqual([
      'canonical_id',
      'derived_chain',
      'instance_id',
      'origin_id',
      'template_id',
    ])
  })
})
