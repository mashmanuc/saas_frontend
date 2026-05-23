/**
 * Module-level flags facade tests.
 *
 * Verifies:
 *   - defaultFlags instance loaded at module import
 *   - module-level functions delegate to defaultFlags
 *   - defaults are OFF (P1 dead infrastructure)
 *   - parseTypeList handles edge cases
 */

import { describe, it, expect } from 'vitest'
import {
  defaultFlags,
  isEORuntimeEnabled,
  isTypeEnabled,
  isShadowEnabled,
  parseTypeList,
} from '../flags'
import { EORFlags } from '../EORFlags'

describe('parseTypeList', () => {
  it('returns empty Set for undefined', () => {
    expect(parseTypeList(undefined)).toEqual(new Set())
  })

  it('returns empty Set for empty string', () => {
    expect(parseTypeList('')).toEqual(new Set())
  })

  it('parses single value', () => {
    expect(parseTypeList('trig_solver')).toEqual(new Set(['trig_solver']))
  })

  it('parses comma-separated list', () => {
    expect(parseTypeList('trig_solver,helix')).toEqual(
      new Set(['trig_solver', 'helix']),
    )
  })

  it('trims whitespace', () => {
    expect(parseTypeList('  trig_solver , helix  ')).toEqual(
      new Set(['trig_solver', 'helix']),
    )
  })

  it('drops empty items', () => {
    expect(parseTypeList('trig_solver,,helix,')).toEqual(
      new Set(['trig_solver', 'helix']),
    )
  })
})

describe('defaultFlags instance', () => {
  it('is an EORFlags instance', () => {
    expect(defaultFlags).toBeInstanceOf(EORFlags)
  })

  it('defaults to disabled (P1 dead infrastructure)', () => {
    // VITE_EO_RUNTIME_ENABLED unset у test env → false
    expect(defaultFlags.isEORuntimeEnabled()).toBe(false)
  })

  it('defaults to no types enabled', () => {
    expect(defaultFlags.isTypeEnabled('trig_solver')).toBe(false)
    expect(defaultFlags.isTypeEnabled('helix')).toBe(false)
  })

  it('defaults to no shadow types', () => {
    expect(defaultFlags.isShadowEnabled('trig_solver')).toBe(false)
  })
})

describe('module-level functions delegate to defaultFlags', () => {
  it('isEORuntimeEnabled matches defaultFlags', () => {
    expect(isEORuntimeEnabled()).toBe(defaultFlags.isEORuntimeEnabled())
  })

  it('isTypeEnabled matches defaultFlags', () => {
    expect(isTypeEnabled('trig_solver')).toBe(
      defaultFlags.isTypeEnabled('trig_solver'),
    )
  })

  it('isShadowEnabled matches defaultFlags', () => {
    expect(isShadowEnabled('trig_solver')).toBe(
      defaultFlags.isShadowEnabled('trig_solver'),
    )
  })

  it('consistent across multiple calls (purity)', () => {
    for (let i = 0; i < 5; i++) {
      expect(isEORuntimeEnabled()).toBe(false)
      expect(isTypeEnabled('any_type')).toBe(false)
      expect(isShadowEnabled('any_type')).toBe(false)
    }
  })
})
