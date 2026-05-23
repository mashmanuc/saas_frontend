/**
 * cloneIdentity tests — derivation semantics.
 *
 * Verifies:
 *   - new instance_id (caller-provided)
 *   - origin_id = source.instance_id
 *   - derived_chain = [...source.derived_chain, source.instance_id] (frozen)
 *   - canonical_id preserved (marketplace lineage)
 *   - source unchanged (pure)
 */

import { describe, it, expect } from 'vitest'
import { cloneIdentity } from '../clone'
import { normalizeIdentity } from '../normalize'
import type { NormalizedEOIdentity } from '../../types/identity'

function persisted(
  overrides: Partial<NormalizedEOIdentity> = {},
): NormalizedEOIdentity {
  return normalizeIdentity({ instance_id: 'src-001', ...overrides }, 'mock')
}

describe('cloneIdentity — basic clone', () => {
  it('returns new instance_id (caller-provided)', () => {
    const source = persisted()
    const clone = cloneIdentity(source, 'clone-001')
    expect(clone.instance_id).toBe('clone-001')
  })

  it('sets origin_id = source.instance_id', () => {
    const source = persisted()
    const clone = cloneIdentity(source, 'clone-001')
    expect(clone.origin_id).toBe(source.instance_id)
  })

  it('appends source.instance_id to derived_chain', () => {
    const source = persisted({ derived_chain: ['ancestor-A', 'ancestor-B'] })
    const clone = cloneIdentity(source, 'clone-001')
    expect(clone.derived_chain).toEqual([
      'ancestor-A',
      'ancestor-B',
      source.instance_id,
    ])
  })

  it('preserves template_id (clone is same EO type)', () => {
    const source = persisted({ template_id: 'helix@2' })
    const clone = cloneIdentity(source, 'clone-001')
    expect(clone.template_id).toBe('helix@2')
  })

  it('preserves canonical_id (marketplace lineage)', () => {
    const source = persisted({ canonical_id: 'marketplace-helix-v2' })
    const clone = cloneIdentity(source, 'clone-001')
    expect(clone.canonical_id).toBe('marketplace-helix-v2')
  })

  it('preserves null canonical_id', () => {
    const source = persisted({ canonical_id: null })
    const clone = cloneIdentity(source, 'clone-001')
    expect(clone.canonical_id).toBeNull()
  })
})

describe('cloneIdentity — lineage chain', () => {
  it('clone-of-clone has 2-element chain', () => {
    const original = persisted()
    const child = cloneIdentity(original, 'child-id')
    const grandchild = cloneIdentity(child, 'grandchild-id')
    expect(grandchild.derived_chain).toEqual([original.instance_id, 'child-id'])
    expect(grandchild.origin_id).toBe('child-id')
  })

  it('lineage append is order-preserving', () => {
    const root = persisted({ derived_chain: [] })
    const a = cloneIdentity(root, 'A')
    const b = cloneIdentity(a, 'B')
    const c = cloneIdentity(b, 'C')
    expect(c.derived_chain).toEqual([root.instance_id, 'A', 'B'])
  })
})

describe('cloneIdentity — immutability', () => {
  it('cloned derived_chain is frozen', () => {
    const source = persisted({ derived_chain: ['a'] })
    const clone = cloneIdentity(source, 'clone-001')
    expect(Object.isFrozen(clone.derived_chain)).toBe(true)
  })

  it('mutation of cloned chain throws', () => {
    const source = persisted({ derived_chain: ['a'] })
    const clone = cloneIdentity(source, 'clone-001')
    expect(() => {
      ;(clone.derived_chain as string[]).push('attempted')
    }).toThrow(TypeError)
  })

  it('source unchanged after clone', () => {
    const source = persisted({ derived_chain: ['a'] })
    const before = JSON.parse(JSON.stringify(source))
    cloneIdentity(source, 'clone-001')
    expect(source).toEqual(before)
  })
})
