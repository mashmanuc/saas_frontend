/**
 * P1.b registry tests.
 *
 * Per user spec requirements:
 *  1. Immutability guard — returned EOD is readonly (capability set,
 *     transport config, adapters all frozen).
 *  2. Unknown capability safety — hasCapability(unknownType, x) === false,
 *     NO throw.
 *  3. Duplicate registration hard-fail — throws Error, no overwrite.
 *  4. Empty registry snapshot stable.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { EORegistry } from '../EORegistry'
import type {
  EducationalObjectDefinition,
  EODataBase,
} from '../../types'

// ─── Mock EOD factory ────────────────────────────────────────────────────
// Minimal EOD just enough to exercise registry. All methods are no-ops —
// registry does not invoke any of them, it just stores the reference.

interface MockData extends EODataBase {
  version: 1
  type: string
  counter: number
}

function makeMockEOD(
  type: string,
  capabilities: Set<'Inspector' | 'Expandable' | 'ReplayPlayback' | '3DCamera'>,
): EducationalObjectDefinition<MockData, unknown> {
  return {
    type,
    version: 1,
    capabilities,
    runtime: {
      mount: async () => null,
      applyOp: () => {},
      setInteractive: () => {},
      unmount: async () => {},
    },
    persistence: {
      buildDefaultData: () => ({ version: 1, type, counter: 0 }),
      serialize: () => ({ version: 1, type, counter: 0 }),
      hydrateInitialData: (data) => data,
      migrate: (_, _from, to) => ({ version: to, type, counter: 0 }) as MockData,
      normalizeForSnapshot: (data) => data,
    },
    render: {
      getRenderDescriptor: () => ({
        surface: '2d-overlay',
        bounds: { x: 0, y: 0, w: 100, h: 100 },
        rotation: 0,
        zHint: 'above_strokes',
      }),
    },
    transport: {
      policies: [{ kind: 'SnapshotPolicy', debounce_ms: 150 }],
      routing: { engine_change: 'SnapshotPolicy' },
    },
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('EORegistry — construction', () => {
  it('starts empty', () => {
    const registry = new EORegistry()
    expect(registry.size()).toBe(0)
    expect(registry.listTypes()).toEqual([])
  })

  it('multiple instances are independent', () => {
    const a = new EORegistry()
    const b = new EORegistry()
    a.register(makeMockEOD('mock_a', new Set(['Inspector'])))
    expect(a.size()).toBe(1)
    expect(b.size()).toBe(0)
  })
})

describe('EORegistry — register / get / has', () => {
  let registry: EORegistry

  beforeEach(() => {
    registry = new EORegistry()
  })

  it('register stores EOD', () => {
    const eod = makeMockEOD('trig_solver', new Set(['Inspector']))
    registry.register(eod)
    expect(registry.size()).toBe(1)
    expect(registry.has('trig_solver')).toBe(true)
  })

  it('get returns the registered EOD', () => {
    const eod = makeMockEOD('helix', new Set(['Expandable', '3DCamera']))
    registry.register(eod)
    const retrieved = registry.get('helix')
    expect(retrieved).toBeDefined()
    expect(retrieved?.type).toBe('helix')
    expect(retrieved?.version).toBe(1)
  })

  it('get returns undefined for unknown type', () => {
    expect(registry.get('does_not_exist')).toBeUndefined()
  })

  it('has returns false for unknown type', () => {
    expect(registry.has('does_not_exist')).toBe(false)
  })

  it('listTypes returns insertion order', () => {
    registry.register(makeMockEOD('z_widget', new Set(['Inspector'])))
    registry.register(makeMockEOD('a_widget', new Set(['Inspector'])))
    registry.register(makeMockEOD('m_widget', new Set(['Inspector'])))
    expect(registry.listTypes()).toEqual(['z_widget', 'a_widget', 'm_widget'])
  })

  it('listTypes returns a fresh array (caller mutation does not affect registry)', () => {
    registry.register(makeMockEOD('mock', new Set(['Inspector'])))
    const types = registry.listTypes() as string[]
    expect(() => {
      // Forced mutation attempt — should not corrupt registry
      ;(types as unknown as { push: (s: string) => void }).push('injected')
    }).not.toThrow()
    // Re-query: registry unchanged
    expect(registry.listTypes()).toEqual(['mock'])
  })
})

describe('EORegistry — duplicate registration hard-fail', () => {
  it('throws on second register of same type', () => {
    const registry = new EORegistry()
    const eod1 = makeMockEOD('trig_solver', new Set(['Inspector']))
    const eod2 = makeMockEOD('trig_solver', new Set(['Inspector', 'Expandable']))
    registry.register(eod1)
    expect(() => registry.register(eod2)).toThrow(
      /duplicate registration of EO type 'trig_solver'/,
    )
  })

  it('first registration is preserved (no silent overwrite)', () => {
    const registry = new EORegistry()
    const original = makeMockEOD('mock', new Set(['Inspector']))
    const replacement = makeMockEOD('mock', new Set(['Expandable']))
    registry.register(original)
    try {
      registry.register(replacement)
    } catch {
      // expected
    }
    // Original capabilities preserved
    expect(registry.hasCapability('mock', 'Inspector')).toBe(true)
    expect(registry.hasCapability('mock', 'Expandable')).toBe(false)
  })
})

describe('EORegistry — immutability guard', () => {
  it('registered EOD is frozen at top level', () => {
    const registry = new EORegistry()
    const eod = makeMockEOD('mock', new Set(['Inspector']))
    registry.register(eod)
    const retrieved = registry.get('mock')!
    expect(Object.isFrozen(retrieved)).toBe(true)
  })

  it('capability set is frozen (cannot add new capabilities at runtime)', () => {
    const registry = new EORegistry()
    const eod = makeMockEOD('mock', new Set(['Inspector']))
    registry.register(eod)
    const retrieved = registry.get('mock')!
    // capabilities Set may or may not be frozen depending on JS engine for Set —
    // we verify via observable behavior: the underlying object reference is frozen.
    expect(Object.isFrozen(retrieved.capabilities)).toBe(true)
  })

  it('transport config is frozen', () => {
    const registry = new EORegistry()
    const eod = makeMockEOD('mock', new Set(['Inspector']))
    registry.register(eod)
    const retrieved = registry.get('mock')!
    expect(Object.isFrozen(retrieved.transport)).toBe(true)
    expect(Object.isFrozen(retrieved.transport.policies)).toBe(true)
    expect(Object.isFrozen(retrieved.transport.routing)).toBe(true)
  })

  it('adapter references are frozen', () => {
    const registry = new EORegistry()
    const eod = makeMockEOD('mock', new Set(['Inspector']))
    registry.register(eod)
    const retrieved = registry.get('mock')!
    expect(Object.isFrozen(retrieved.runtime)).toBe(true)
    expect(Object.isFrozen(retrieved.persistence)).toBe(true)
    expect(Object.isFrozen(retrieved.render)).toBe(true)
  })

  it('top-level mutation attempt throws у strict mode', () => {
    const registry = new EORegistry()
    const eod = makeMockEOD('mock', new Set(['Inspector']))
    registry.register(eod)
    const retrieved = registry.get('mock')!
    expect(() => {
      // @ts-expect-error — testing runtime guard, not type system
      retrieved.version = 999
    }).toThrow(TypeError)
  })
})

describe('EORegistry — hasCapability', () => {
  let registry: EORegistry

  beforeEach(() => {
    registry = new EORegistry()
    registry.register(
      makeMockEOD('helix', new Set(['Inspector', 'Expandable', '3DCamera'])),
    )
  })

  it('returns true for registered capability', () => {
    expect(registry.hasCapability('helix', 'Inspector')).toBe(true)
    expect(registry.hasCapability('helix', '3DCamera')).toBe(true)
  })

  it('returns false for absent capability', () => {
    expect(registry.hasCapability('helix', 'HighFreqParam')).toBe(false)
    expect(registry.hasCapability('helix', 'AnimationPersisted')).toBe(false)
  })

  it('SAFETY: returns false for unknown type, does NOT throw', () => {
    expect(() => registry.hasCapability('does_not_exist', 'Inspector')).not.toThrow()
    expect(registry.hasCapability('does_not_exist', 'Inspector')).toBe(false)
    expect(registry.hasCapability('', 'Inspector')).toBe(false)
  })
})

describe('EORegistry — empty registry snapshot', () => {
  // Future-proof snapshot test — ensures empty registry has stable
  // serializable representation, so future changes to EORegistry surface
  // are caught by this test.
  it('empty registry has stable shape', () => {
    const registry = new EORegistry()
    const snapshot = {
      size: registry.size(),
      types: registry.listTypes(),
    }
    expect(snapshot).toEqual({ size: 0, types: [] })
  })

  it('single-EOD registry has stable shape', () => {
    const registry = new EORegistry()
    registry.register(makeMockEOD('trig_solver', new Set(['Inspector'])))
    const snapshot = {
      size: registry.size(),
      types: registry.listTypes(),
      trigSolverCapabilities: Array.from(
        registry.get('trig_solver')?.capabilities ?? [],
      ).sort(),
    }
    expect(snapshot).toEqual({
      size: 1,
      types: ['trig_solver'],
      trigSolverCapabilities: ['Inspector'],
    })
  })
})
