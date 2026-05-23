/**
 * InspectorBridgeRegistry tests — runtime-owned bridge ownership.
 *
 * Verifies:
 *   - set / get round-trip
 *   - duplicate registration hard-fail
 *   - get(unknown) returns undefined (no throw)
 *   - delete returns boolean
 *   - multi-instance independence
 *   - empty instance_id rejected
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { InspectorBridgeRegistry } from '../InspectorBridgeRegistry'
import type { InspectorBridge, Reactive } from '../../types/inspector-bridge'

interface MockBridgeState {
  enabled: boolean
  label: string
}

function makeMockBridge(state: MockBridgeState): InspectorBridge<MockBridgeState> {
  const local = state as MockBridgeState & { readonly __reactive: unique symbol }
  return {
    local: local as Reactive<MockBridgeState>,
    toggle(_key) {},
    setOption(_key, _value) {},
  }
}

describe('InspectorBridgeRegistry — construction', () => {
  it('starts empty', () => {
    const reg = new InspectorBridgeRegistry()
    expect(reg.size()).toBe(0)
  })

  it('multiple instances are independent', () => {
    const a = new InspectorBridgeRegistry()
    const b = new InspectorBridgeRegistry()
    a.set('a1', makeMockBridge({ enabled: true, label: 'A' }))
    expect(a.size()).toBe(1)
    expect(b.size()).toBe(0)
  })
})

describe('InspectorBridgeRegistry — set / get', () => {
  let reg: InspectorBridgeRegistry

  beforeEach(() => {
    reg = new InspectorBridgeRegistry()
  })

  it('set stores bridge', () => {
    const bridge = makeMockBridge({ enabled: true, label: 'A' })
    reg.set('inst-1', bridge)
    expect(reg.has('inst-1')).toBe(true)
    expect(reg.size()).toBe(1)
  })

  it('get returns the registered bridge', () => {
    const bridge = makeMockBridge({ enabled: true, label: 'A' })
    reg.set('inst-1', bridge)
    const retrieved = reg.get<MockBridgeState>('inst-1')
    expect(retrieved).toBeDefined()
    expect(retrieved?.local.label).toBe('A')
  })

  it('get returns undefined for unknown instance_id (NO throw)', () => {
    expect(() => reg.get('does-not-exist')).not.toThrow()
    expect(reg.get('does-not-exist')).toBeUndefined()
  })

  it('has returns false for unknown instance_id', () => {
    expect(reg.has('does-not-exist')).toBe(false)
  })
})

describe('InspectorBridgeRegistry — duplicate registration hard-fail', () => {
  it('second set з same instance_id throws', () => {
    const reg = new InspectorBridgeRegistry()
    reg.set('inst-1', makeMockBridge({ enabled: true, label: 'A' }))
    expect(() =>
      reg.set('inst-1', makeMockBridge({ enabled: false, label: 'B' })),
    ).toThrow(/already registered/)
  })

  it('first bridge preserved on duplicate attempt', () => {
    const reg = new InspectorBridgeRegistry()
    const original = makeMockBridge({ enabled: true, label: 'A' })
    reg.set('inst-1', original)
    try {
      reg.set('inst-1', makeMockBridge({ enabled: false, label: 'B' }))
    } catch {
      // expected
    }
    expect(reg.get<MockBridgeState>('inst-1')?.local.label).toBe('A')
  })

  it('set after delete allows re-registration (re-mount lifecycle)', () => {
    const reg = new InspectorBridgeRegistry()
    reg.set('inst-1', makeMockBridge({ enabled: true, label: 'A' }))
    reg.delete('inst-1')
    expect(() =>
      reg.set('inst-1', makeMockBridge({ enabled: false, label: 'B' })),
    ).not.toThrow()
    expect(reg.get<MockBridgeState>('inst-1')?.local.label).toBe('B')
  })
})

describe('InspectorBridgeRegistry — validation', () => {
  it('empty instance_id throws', () => {
    const reg = new InspectorBridgeRegistry()
    expect(() =>
      reg.set('', makeMockBridge({ enabled: true, label: 'A' })),
    ).toThrow(/non-empty string/)
  })
})

describe('InspectorBridgeRegistry — delete', () => {
  it('returns true when bridge removed', () => {
    const reg = new InspectorBridgeRegistry()
    reg.set('inst-1', makeMockBridge({ enabled: true, label: 'A' }))
    expect(reg.delete('inst-1')).toBe(true)
    expect(reg.has('inst-1')).toBe(false)
  })

  it('returns false when nothing to remove', () => {
    const reg = new InspectorBridgeRegistry()
    expect(reg.delete('does-not-exist')).toBe(false)
  })
})

describe('InspectorBridgeRegistry — multi-bridge isolation', () => {
  it('different instance_ids are independent', () => {
    const reg = new InspectorBridgeRegistry()
    reg.set('a', makeMockBridge({ enabled: true, label: 'AAA' }))
    reg.set('b', makeMockBridge({ enabled: false, label: 'BBB' }))
    expect(reg.get<MockBridgeState>('a')?.local.label).toBe('AAA')
    expect(reg.get<MockBridgeState>('b')?.local.label).toBe('BBB')
    expect(reg.size()).toBe(2)
  })
})

describe('InspectorBridgeRegistry — clear (test helper)', () => {
  it('removes all bridges', () => {
    const reg = new InspectorBridgeRegistry()
    reg.set('a', makeMockBridge({ enabled: true, label: 'A' }))
    reg.set('b', makeMockBridge({ enabled: true, label: 'B' }))
    reg.clear()
    expect(reg.size()).toBe(0)
  })
})
