/**
 * Engine event catalog tests.
 */

import { describe, it, expect } from 'vitest'
import {
  CANONICAL_ENGINE_EVENTS,
  EngineEvent,
  isCanonicalEngineEvent,
} from '../engine-events'
import type { EngineEventName } from '../engine-events'

describe('EngineEvent catalog', () => {
  it('declares 5 canonical events', () => {
    expect(Object.keys(EngineEvent)).toHaveLength(5)
  })

  it('exposes engine_change', () => {
    expect(EngineEvent.ENGINE_CHANGE).toBe('engine_change')
  })

  it('exposes param_change', () => {
    expect(EngineEvent.PARAM_CHANGE).toBe('param_change')
  })

  it('exposes expand_requested', () => {
    expect(EngineEvent.EXPAND_REQUESTED).toBe('expand_requested')
  })

  it('exposes interaction_start', () => {
    expect(EngineEvent.INTERACTION_START).toBe('interaction_start')
  })

  it('exposes interaction_end', () => {
    expect(EngineEvent.INTERACTION_END).toBe('interaction_end')
  })

  it('catalog is frozen', () => {
    expect(Object.isFrozen(EngineEvent)).toBe(true)
  })

  it('mutation attempt throws', () => {
    expect(() => {
      // @ts-expect-error testing runtime guard
      EngineEvent.ENGINE_CHANGE = 'something_else'
    }).toThrow(TypeError)
  })
})

describe('CANONICAL_ENGINE_EVENTS set', () => {
  it('contains all 5 canonical names', () => {
    expect(CANONICAL_ENGINE_EVENTS.size).toBe(5)
    expect(CANONICAL_ENGINE_EVENTS.has('engine_change')).toBe(true)
    expect(CANONICAL_ENGINE_EVENTS.has('param_change')).toBe(true)
    expect(CANONICAL_ENGINE_EVENTS.has('expand_requested')).toBe(true)
    expect(CANONICAL_ENGINE_EVENTS.has('interaction_start')).toBe(true)
    expect(CANONICAL_ENGINE_EVENTS.has('interaction_end')).toBe(true)
  })

  it('does not contain non-canonical names', () => {
    expect(CANONICAL_ENGINE_EVENTS.has('helix_orbit_settled' as EngineEventName)).toBe(
      false,
    )
    expect(CANONICAL_ENGINE_EVENTS.has('whatever' as EngineEventName)).toBe(false)
  })

  it('set is frozen', () => {
    expect(Object.isFrozen(CANONICAL_ENGINE_EVENTS)).toBe(true)
  })
})

describe('isCanonicalEngineEvent', () => {
  it('returns true for canonical events', () => {
    expect(isCanonicalEngineEvent('engine_change')).toBe(true)
    expect(isCanonicalEngineEvent('param_change')).toBe(true)
    expect(isCanonicalEngineEvent('expand_requested')).toBe(true)
    expect(isCanonicalEngineEvent('interaction_start')).toBe(true)
    expect(isCanonicalEngineEvent('interaction_end')).toBe(true)
  })

  it('returns false for non-canonical names', () => {
    expect(isCanonicalEngineEvent('whatever')).toBe(false)
    expect(isCanonicalEngineEvent('helix_orbit_settled')).toBe(false)
    expect(isCanonicalEngineEvent('')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isCanonicalEngineEvent('')).toBe(false)
  })
})

describe('EngineEvent integration: used as routing keys', () => {
  it('supports computed property names у transport routing tables', () => {
    // Demonstrate usage pattern documented у engine-events.ts
    const routing: Record<string, string> = {
      [EngineEvent.ENGINE_CHANGE]: 'SnapshotPolicy',
      [EngineEvent.PARAM_CHANGE]: 'ThrottledParamPolicy',
    }
    expect(routing['engine_change']).toBe('SnapshotPolicy')
    expect(routing['param_change']).toBe('ThrottledParamPolicy')
  })
})
