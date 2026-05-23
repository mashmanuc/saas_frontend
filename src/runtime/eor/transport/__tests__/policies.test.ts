/**
 * Transport policy tests — typed configuration envelopes.
 *
 * Per colleague review P1.e — tests verify:
 *   1. Unknown policy kind rejected
 *   2. Invalid debounce/rate rejected
 *   3. Policy immutable (Object.isFrozen)
 *   4. Serialize policy stable
 *   5. Equality semantics
 *   6. ZERO execution path (no timers, no dispatch)
 */

import { describe, it, expect } from 'vitest'
import {
  SnapshotPolicyImpl,
  MIN_SNAPSHOT_DEBOUNCE_MS,
  MAX_SNAPSHOT_DEBOUNCE_MS,
} from '../SnapshotPolicyImpl'
import {
  ThrottledParamPolicyImpl,
  MIN_THROTTLE_RATE_MS,
  MAX_THROTTLE_RATE_MS,
} from '../ThrottledParamPolicyImpl'
import { DirectCallbackPolicyImpl } from '../DirectCallbackPolicyImpl'
import { dispatcherStub } from '../TransportDispatcherStub'
import {
  assertKnownPolicyKind,
  serializePolicy,
  policyEquals,
} from '../policy-utils'

// ─── SnapshotPolicy ──────────────────────────────────────────────────────

describe('SnapshotPolicyImpl — construction', () => {
  it('accepts valid debounce_ms', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 150 })
    expect(p.kind).toBe('SnapshotPolicy')
    expect(p.debounce_ms).toBe(150)
  })

  it('rejects debounce_ms below TR-INV-2 minimum', () => {
    expect(() => new SnapshotPolicyImpl({ debounce_ms: 50 })).toThrow(
      RangeError,
    )
    expect(() => new SnapshotPolicyImpl({ debounce_ms: 99 })).toThrow(RangeError)
  })

  it('accepts exactly MIN_SNAPSHOT_DEBOUNCE_MS', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: MIN_SNAPSHOT_DEBOUNCE_MS })
    expect(p.debounce_ms).toBe(MIN_SNAPSHOT_DEBOUNCE_MS)
  })

  it('rejects debounce_ms above maximum', () => {
    expect(
      () => new SnapshotPolicyImpl({ debounce_ms: MAX_SNAPSHOT_DEBOUNCE_MS + 1 }),
    ).toThrow(RangeError)
  })

  it('rejects non-number debounce_ms', () => {
    // @ts-expect-error testing runtime guard
    expect(() => new SnapshotPolicyImpl({ debounce_ms: '150' })).toThrow(
      TypeError,
    )
    expect(() => new SnapshotPolicyImpl({ debounce_ms: NaN })).toThrow(
      TypeError,
    )
    expect(() => new SnapshotPolicyImpl({ debounce_ms: Infinity })).toThrow(
      TypeError,
    )
  })
})

describe('SnapshotPolicyImpl — immutability', () => {
  it('instance is frozen', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 150 })
    expect(Object.isFrozen(p)).toBe(true)
  })

  it('mutation attempt throws у strict mode', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 150 })
    expect(() => {
      // @ts-expect-error testing runtime guard
      p.debounce_ms = 999
    }).toThrow(TypeError)
  })

  it('kind cannot be reassigned', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 150 })
    expect(() => {
      // @ts-expect-error testing runtime guard
      p.kind = 'ThrottledParamPolicy'
    }).toThrow(TypeError)
  })
})

// ─── ThrottledParamPolicy ────────────────────────────────────────────────

describe('ThrottledParamPolicyImpl — construction', () => {
  const validConfig = {
    rate_ms: 33,
    params: ['slider:a', 'slider:b'],
    race_guard: 'last_snapshot_seq',
  }

  it('accepts valid config', () => {
    const p = new ThrottledParamPolicyImpl(validConfig)
    expect(p.kind).toBe('ThrottledParamPolicy')
    expect(p.rate_ms).toBe(33)
    expect(p.params).toEqual(['slider:a', 'slider:b'])
    expect(p.race_guard).toBe('last_snapshot_seq')
  })

  it('rejects rate_ms below minimum', () => {
    expect(
      () =>
        new ThrottledParamPolicyImpl({
          ...validConfig,
          rate_ms: MIN_THROTTLE_RATE_MS - 1,
        }),
    ).toThrow(RangeError)
  })

  it('rejects rate_ms above maximum (use SnapshotPolicy instead)', () => {
    expect(
      () =>
        new ThrottledParamPolicyImpl({
          ...validConfig,
          rate_ms: MAX_THROTTLE_RATE_MS + 1,
        }),
    ).toThrow(RangeError)
  })

  it('rejects non-number rate_ms', () => {
    expect(
      () =>
        new ThrottledParamPolicyImpl({
          ...validConfig,
          // @ts-expect-error testing runtime guard
          rate_ms: '33',
        }),
    ).toThrow(TypeError)
  })

  it('rejects empty params array', () => {
    expect(
      () => new ThrottledParamPolicyImpl({ ...validConfig, params: [] }),
    ).toThrow(TypeError)
  })

  it('rejects empty string у params', () => {
    expect(
      () =>
        new ThrottledParamPolicyImpl({
          ...validConfig,
          params: ['slider:a', ''],
        }),
    ).toThrow(TypeError)
  })

  it('rejects non-array params', () => {
    expect(
      () =>
        new ThrottledParamPolicyImpl({
          ...validConfig,
          // @ts-expect-error testing runtime guard
          params: 'slider:a',
        }),
    ).toThrow(TypeError)
  })

  it('rejects empty race_guard (TR-INV-3)', () => {
    expect(
      () => new ThrottledParamPolicyImpl({ ...validConfig, race_guard: '' }),
    ).toThrow(TypeError)
  })
})

describe('ThrottledParamPolicyImpl — immutability', () => {
  const validConfig = {
    rate_ms: 33,
    params: ['slider:a'],
    race_guard: 'last_snapshot_seq',
  }

  it('instance is frozen', () => {
    const p = new ThrottledParamPolicyImpl(validConfig)
    expect(Object.isFrozen(p)).toBe(true)
  })

  it('params array is frozen', () => {
    const p = new ThrottledParamPolicyImpl(validConfig)
    expect(Object.isFrozen(p.params)).toBe(true)
  })

  it('input params array mutation does not affect policy', () => {
    const inputParams = ['slider:a', 'slider:b']
    const p = new ThrottledParamPolicyImpl({
      ...validConfig,
      params: inputParams,
    })
    inputParams.push('slider:c')
    expect(p.params).toEqual(['slider:a', 'slider:b'])
  })

  it('policy params mutation throws', () => {
    const p = new ThrottledParamPolicyImpl(validConfig)
    expect(() => {
      ;(p.params as string[]).push('attempted')
    }).toThrow(TypeError)
  })
})

// ─── DirectCallbackPolicy ────────────────────────────────────────────────

describe('DirectCallbackPolicyImpl', () => {
  it('constructs and has correct kind', () => {
    const p = new DirectCallbackPolicyImpl()
    expect(p.kind).toBe('DirectCallbackPolicy')
  })

  it('instance is frozen', () => {
    const p = new DirectCallbackPolicyImpl()
    expect(Object.isFrozen(p)).toBe(true)
  })

  it('mutation attempt throws', () => {
    const p = new DirectCallbackPolicyImpl()
    expect(() => {
      // @ts-expect-error testing runtime guard
      p.kind = 'SnapshotPolicy'
    }).toThrow(TypeError)
  })
})

// ─── Dispatcher stub ─────────────────────────────────────────────────────

describe('TransportDispatcherStub', () => {
  it('throws when invoked (Dead Infrastructure guard)', () => {
    expect(() =>
      dispatcherStub({
        op_type: 'asset_update',
        instance_id: 'abc',
        payload: {},
      }),
    ).toThrow(/Dead.?Infrastructure/i)
  })

  it('error message includes op_type and instance_id для diagnostics', () => {
    try {
      dispatcherStub({
        op_type: 'eo_param_set',
        instance_id: 'helix-001',
        payload: { name: 'slider:a', value: 0.5 },
      })
      throw new Error('Expected dispatcherStub to throw')
    } catch (err) {
      expect((err as Error).message).toContain('eo_param_set')
      expect((err as Error).message).toContain('helix-001')
    }
  })
})

// ─── Policy utilities ────────────────────────────────────────────────────

describe('assertKnownPolicyKind', () => {
  it('accepts SnapshotPolicy', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 150 })
    expect(() => assertKnownPolicyKind(p)).not.toThrow()
  })

  it('accepts ThrottledParamPolicy', () => {
    const p = new ThrottledParamPolicyImpl({
      rate_ms: 33,
      params: ['x'],
      race_guard: 'last_snapshot_seq',
    })
    expect(() => assertKnownPolicyKind(p)).not.toThrow()
  })

  it('accepts DirectCallbackPolicy', () => {
    const p = new DirectCallbackPolicyImpl()
    expect(() => assertKnownPolicyKind(p)).not.toThrow()
  })

  it('rejects unknown kind', () => {
    expect(() =>
      assertKnownPolicyKind({ kind: 'MysteryPolicy' as never }),
    ).toThrow(/Unknown policy kind/)
  })

  it('rejects non-string kind', () => {
    expect(() => assertKnownPolicyKind({ kind: 42 as never })).toThrow(
      TypeError,
    )
    expect(() => assertKnownPolicyKind({})).toThrow(TypeError)
  })
})

describe('serializePolicy — stability', () => {
  it('serializes SnapshotPolicy to stable JSON', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 150 })
    const s = serializePolicy(p)
    expect(s).toBe('{"kind":"SnapshotPolicy","debounce_ms":150}')
  })

  it('serializes ThrottledParamPolicy with sorted params (stable order)', () => {
    const p1 = new ThrottledParamPolicyImpl({
      rate_ms: 33,
      params: ['z', 'a', 'm'],
      race_guard: 'last_snapshot_seq',
    })
    const p2 = new ThrottledParamPolicyImpl({
      rate_ms: 33,
      params: ['m', 'a', 'z'],
      race_guard: 'last_snapshot_seq',
    })
    expect(serializePolicy(p1)).toBe(serializePolicy(p2))
  })

  it('serializes DirectCallbackPolicy', () => {
    const p = new DirectCallbackPolicyImpl()
    expect(serializePolicy(p)).toBe('{"kind":"DirectCallbackPolicy"}')
  })

  it('multiple serializations of same policy are identical', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 200 })
    const s1 = serializePolicy(p)
    const s2 = serializePolicy(p)
    expect(s1).toBe(s2)
  })
})

describe('policyEquals', () => {
  it('reflexive: p equals itself', () => {
    const p = new SnapshotPolicyImpl({ debounce_ms: 150 })
    expect(policyEquals(p, p)).toBe(true)
  })

  it('symmetric: equal regardless of order', () => {
    const a = new SnapshotPolicyImpl({ debounce_ms: 150 })
    const b = new SnapshotPolicyImpl({ debounce_ms: 150 })
    expect(policyEquals(a, b)).toBe(policyEquals(b, a))
    expect(policyEquals(a, b)).toBe(true)
  })

  it('different config → not equal', () => {
    const a = new SnapshotPolicyImpl({ debounce_ms: 150 })
    const b = new SnapshotPolicyImpl({ debounce_ms: 200 })
    expect(policyEquals(a, b)).toBe(false)
  })

  it('different kinds → not equal', () => {
    const a = new SnapshotPolicyImpl({ debounce_ms: 150 })
    const b = new DirectCallbackPolicyImpl()
    expect(policyEquals(a, b)).toBe(false)
  })

  it('ThrottledParamPolicy with same config order-independent params', () => {
    const a = new ThrottledParamPolicyImpl({
      rate_ms: 33,
      params: ['a', 'b'],
      race_guard: 'x',
    })
    const b = new ThrottledParamPolicyImpl({
      rate_ms: 33,
      params: ['b', 'a'],
      race_guard: 'x',
    })
    expect(policyEquals(a, b)).toBe(true)
  })
})
