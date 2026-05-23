/**
 * Runtime identity tests — ephemeral runtime_id.
 *
 * Verifies:
 *   - generateRuntimeId returns monotonic positive integers
 *   - attachRuntimeIdentity adds runtime_id to persisted shape
 *   - stripRuntimeIdentity removes runtime_id
 *   - round-trip stripRuntime(attach(x)) === x
 *   - _resetRuntimeIdCounter restores determinism for tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  generateRuntimeId,
  attachRuntimeIdentity,
  stripRuntimeIdentity,
  _resetRuntimeIdCounter,
} from '../runtime'
import { normalizeIdentity } from '../normalize'
import type {
  NormalizedEOIdentity,
  MountedEOIdentity,
} from '../../types/identity'

function persisted(): NormalizedEOIdentity {
  return normalizeIdentity({ instance_id: 'abc' }, 'mock')
}

describe('generateRuntimeId', () => {
  beforeEach(() => _resetRuntimeIdCounter())

  it('returns positive integers starting at 1', () => {
    expect(generateRuntimeId()).toBe(1)
    expect(generateRuntimeId()).toBe(2)
    expect(generateRuntimeId()).toBe(3)
  })

  it('is monotonically increasing', () => {
    const sequence: number[] = []
    for (let i = 0; i < 100; i++) sequence.push(generateRuntimeId())
    for (let i = 1; i < sequence.length; i++) {
      expect(sequence[i]).toBeGreaterThan(sequence[i - 1])
    }
  })

  it('produces unique ids', () => {
    const ids = new Set<number>()
    for (let i = 0; i < 50; i++) ids.add(generateRuntimeId())
    expect(ids.size).toBe(50)
  })
})

describe('attachRuntimeIdentity', () => {
  beforeEach(() => _resetRuntimeIdCounter())

  it('adds runtime_id to persisted identity', () => {
    const p = persisted()
    const mounted = attachRuntimeIdentity(p)
    expect(mounted.runtime_id).toBe(1)
  })

  it('preserves all persisted fields verbatim', () => {
    const p = persisted()
    const mounted = attachRuntimeIdentity(p)
    expect(mounted.instance_id).toBe(p.instance_id)
    expect(mounted.template_id).toBe(p.template_id)
    expect(mounted.origin_id).toBe(p.origin_id)
    expect(mounted.derived_chain).toEqual(p.derived_chain)
    expect(mounted.canonical_id).toBe(p.canonical_id)
  })

  it('each mount gets a fresh runtime_id', () => {
    const p = persisted()
    const m1 = attachRuntimeIdentity(p)
    const m2 = attachRuntimeIdentity(p)
    const m3 = attachRuntimeIdentity(p)
    expect(m1.runtime_id).toBe(1)
    expect(m2.runtime_id).toBe(2)
    expect(m3.runtime_id).toBe(3)
  })

  it('does NOT mutate persisted input', () => {
    const p = persisted()
    const snapshot = JSON.parse(JSON.stringify(p))
    attachRuntimeIdentity(p)
    expect(p).toEqual(snapshot)
    // runtime_id absent у persisted
    expect((p as Record<string, unknown>).runtime_id).toBeUndefined()
  })
})

describe('stripRuntimeIdentity', () => {
  beforeEach(() => _resetRuntimeIdCounter())

  it('removes runtime_id', () => {
    const p = persisted()
    const mounted = attachRuntimeIdentity(p)
    const stripped = stripRuntimeIdentity(mounted)
    expect((stripped as Record<string, unknown>).runtime_id).toBeUndefined()
  })

  it('preserves all persisted fields', () => {
    const p = persisted()
    const mounted = attachRuntimeIdentity(p)
    const stripped = stripRuntimeIdentity(mounted)
    expect(stripped).toEqual(p)
  })

  it('round-trip: strip(attach(x)) deep-equals x', () => {
    const p = persisted()
    const mounted = attachRuntimeIdentity(p)
    const roundtrip = stripRuntimeIdentity(mounted)
    expect(roundtrip).toEqual(p)
  })
})

describe('boundary separation: normalize → attach → strip', () => {
  beforeEach(() => _resetRuntimeIdCounter())

  it('pure normalize never sees runtime_id', () => {
    const normalized = normalizeIdentity({ instance_id: 'abc' }, 'mock')
    expect((normalized as Record<string, unknown>).runtime_id).toBeUndefined()
  })

  it('only attachRuntimeIdentity adds runtime_id', () => {
    const normalized = normalizeIdentity({ instance_id: 'abc' }, 'mock')
    const mounted: MountedEOIdentity = attachRuntimeIdentity(normalized)
    expect(mounted.runtime_id).toBeGreaterThan(0)
  })

  it('shadow parity helper: strip(mounted) === persisted normalize result', () => {
    const raw = { instance_id: 'abc' }
    const persistedShape = normalizeIdentity(raw, 'mock')
    const mounted = attachRuntimeIdentity(persistedShape)
    expect(stripRuntimeIdentity(mounted)).toEqual(persistedShape)
  })
})
