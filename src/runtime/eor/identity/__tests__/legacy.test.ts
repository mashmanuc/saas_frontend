/**
 * isLegacyIdentity tests — simple field check, no heuristics.
 */

import { describe, it, expect } from 'vitest'
import { isLegacyIdentity } from '../legacy'

describe('isLegacyIdentity', () => {
  it('returns true when template_id is missing', () => {
    expect(isLegacyIdentity({ instance_id: 'abc' })).toBe(true)
  })

  it('returns true when template_id is empty string', () => {
    expect(isLegacyIdentity({ instance_id: 'abc', template_id: '' })).toBe(true)
  })

  it('returns false when template_id is present', () => {
    expect(
      isLegacyIdentity({ instance_id: 'abc', template_id: 'helix@1' }),
    ).toBe(false)
  })

  it('returns false even with all other fields empty', () => {
    expect(
      isLegacyIdentity({ instance_id: 'abc', template_id: 'mock@1' }),
    ).toBe(false)
  })

  it('no heuristics — type alone does NOT imply legacy', () => {
    // Provide other identity fields but no template_id — still legacy.
    expect(
      isLegacyIdentity({
        instance_id: 'abc',
        origin_id: 'parent',
        derived_chain: ['x'],
        canonical_id: 'canon',
      }),
    ).toBe(true)
  })
})
