/**
 * stableStringify tests — deterministic JSON encoding.
 */

import { describe, it, expect } from 'vitest'
import { stableStringify } from '../stable-stringify'

describe('stableStringify — primitives', () => {
  it('null', () => {
    expect(stableStringify(null)).toBe('null')
  })

  it('undefined → null (matches JSON.stringify omitting)', () => {
    expect(stableStringify(undefined)).toBe('null')
  })

  it('boolean', () => {
    expect(stableStringify(true)).toBe('true')
    expect(stableStringify(false)).toBe('false')
  })

  it('numbers', () => {
    expect(stableStringify(0)).toBe('0')
    expect(stableStringify(-42)).toBe('-42')
    expect(stableStringify(3.14)).toBe('3.14')
  })

  it('strings (with escaping)', () => {
    expect(stableStringify('hello')).toBe('"hello"')
    expect(stableStringify('with "quotes"')).toBe('"with \\"quotes\\""')
  })
})

describe('stableStringify — arrays (order preserved)', () => {
  it('empty array', () => {
    expect(stableStringify([])).toBe('[]')
  })

  it('primitives', () => {
    expect(stableStringify([1, 2, 3])).toBe('[1,2,3]')
  })

  it('preserves order (arrays are semantic)', () => {
    expect(stableStringify(['z', 'a', 'm'])).toBe('["z","a","m"]')
  })
})

describe('stableStringify — objects (keys sorted)', () => {
  it('empty object', () => {
    expect(stableStringify({})).toBe('{}')
  })

  it('sorts keys alphabetically', () => {
    expect(stableStringify({ z: 1, a: 2, m: 3 })).toBe('{"a":2,"m":3,"z":1}')
  })

  it('same content different insertion order → same output', () => {
    const a = { x: 1, y: 2, z: 3 }
    const b = { z: 3, y: 2, x: 1 }
    expect(stableStringify(a)).toBe(stableStringify(b))
  })

  it('nested objects sorted recursively', () => {
    const input = {
      outer: { z: 1, a: 2 },
      another: { y: 5, b: 6 },
    }
    expect(stableStringify(input)).toBe(
      '{"another":{"b":6,"y":5},"outer":{"a":2,"z":1}}',
    )
  })
})

describe('stableStringify — board_state-like shapes', () => {
  it('mock asset', () => {
    const asset = {
      id: 'abc',
      type: 'trig_circle',
      x: 100,
      y: 50,
      data: { theta: 0.5, showSin: true },
    }
    expect(stableStringify(asset)).toBe(
      '{"data":{"showSin":true,"theta":0.5},"id":"abc","type":"trig_circle","x":100,"y":50}',
    )
  })

  it('produces same string regardless of property order', () => {
    const a = {
      pages: [{ id: 'p1', assets: [{ id: 'a1', type: 'helix' }] }],
      version: 1,
    }
    const b = {
      version: 1,
      pages: [{ assets: [{ type: 'helix', id: 'a1' }], id: 'p1' }],
    }
    expect(stableStringify(a)).toBe(stableStringify(b))
  })
})
