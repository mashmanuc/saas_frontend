/**
 * EORFlags class tests — pure read facade.
 *
 * Verifies:
 *   - master switch behavior (disabled → all false)
 *   - type authoritative gate
 *   - shadow gate
 *   - precedence: authoritative wins over shadow
 *   - immutability (Object.isFrozen)
 *   - multiple instances independent
 */

import { describe, it, expect } from 'vitest'
import { EORFlags } from '../EORFlags'

describe('EORFlags — master switch', () => {
  it('isEORuntimeEnabled true when enabled', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(),
      shadowTypes: new Set(),
    })
    expect(flags.isEORuntimeEnabled()).toBe(true)
  })

  it('isEORuntimeEnabled false when disabled', () => {
    const flags = new EORFlags({
      enabled: false,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(['helix']),
    })
    expect(flags.isEORuntimeEnabled()).toBe(false)
  })

  it('disabled master kills isTypeEnabled', () => {
    const flags = new EORFlags({
      enabled: false,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(),
    })
    // Even with type у list, master OFF → false
    expect(flags.isTypeEnabled('trig_solver')).toBe(false)
  })

  it('disabled master kills isShadowEnabled', () => {
    const flags = new EORFlags({
      enabled: false,
      authoritativeTypes: new Set(),
      shadowTypes: new Set(['trig_solver']),
    })
    expect(flags.isShadowEnabled('trig_solver')).toBe(false)
  })
})

describe('EORFlags — type authoritative', () => {
  it('listed types enabled when master on', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(['trig_solver', 'helix']),
      shadowTypes: new Set(),
    })
    expect(flags.isTypeEnabled('trig_solver')).toBe(true)
    expect(flags.isTypeEnabled('helix')).toBe(true)
  })

  it('unlisted types disabled', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(),
    })
    expect(flags.isTypeEnabled('helix')).toBe(false)
    expect(flags.isTypeEnabled('nmt3d')).toBe(false)
    expect(flags.isTypeEnabled('')).toBe(false)
  })
})

describe('EORFlags — shadow', () => {
  it('listed shadow types enabled when master on', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(),
      shadowTypes: new Set(['trig_solver']),
    })
    expect(flags.isShadowEnabled('trig_solver')).toBe(true)
  })

  it('unlisted shadow disabled', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(),
      shadowTypes: new Set(['trig_solver']),
    })
    expect(flags.isShadowEnabled('helix')).toBe(false)
  })
})

describe('EORFlags — precedence (authoritative wins over shadow)', () => {
  it('type у both lists is authoritative, NOT shadow', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(['trig_solver']),
    })
    expect(flags.isTypeEnabled('trig_solver')).toBe(true)
    expect(flags.isShadowEnabled('trig_solver')).toBe(false)
  })

  it('different types у different lists work independently', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(['helix']),
    })
    expect(flags.isTypeEnabled('trig_solver')).toBe(true)
    expect(flags.isShadowEnabled('trig_solver')).toBe(false)
    expect(flags.isTypeEnabled('helix')).toBe(false)
    expect(flags.isShadowEnabled('helix')).toBe(true)
  })
})

describe('EORFlags — immutability', () => {
  it('instance is frozen', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(),
    })
    expect(Object.isFrozen(flags)).toBe(true)
  })

  it('mutation attempt throws', () => {
    const flags = new EORFlags({
      enabled: false,
      authoritativeTypes: new Set(),
      shadowTypes: new Set(),
    })
    expect(() => {
      // @ts-expect-error — testing runtime guard
      flags.enabled = true
    }).toThrow(TypeError)
  })
})

describe('EORFlags — multi-instance independence', () => {
  it('two instances with different configs are independent', () => {
    const enabled = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(),
    })
    const disabled = new EORFlags({
      enabled: false,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(),
    })
    expect(enabled.isTypeEnabled('trig_solver')).toBe(true)
    expect(disabled.isTypeEnabled('trig_solver')).toBe(false)
  })
})

describe('EORFlags — purity', () => {
  it('multiple calls return same result', () => {
    const flags = new EORFlags({
      enabled: true,
      authoritativeTypes: new Set(['trig_solver']),
      shadowTypes: new Set(),
    })
    for (let i = 0; i < 10; i++) {
      expect(flags.isTypeEnabled('trig_solver')).toBe(true)
      expect(flags.isTypeEnabled('helix')).toBe(false)
    }
  })
})
