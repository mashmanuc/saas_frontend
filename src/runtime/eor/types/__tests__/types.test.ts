/**
 * P1.a type-level tests.
 *
 * These are NOT runtime tests — they verify type contracts compile correctly.
 * Per MIG-INV-8 (Dead Infrastructure), no runtime logic exists yet to test.
 *
 * Tests use vitest's `expectTypeOf` and TypeScript inline assertions.
 */

import { describe, it, expectTypeOf } from 'vitest'
import type {
  EOIdentity,
  NormalizedEOIdentity,
  Capability,
  CapabilitySet,
  EOpType,
  EOpEnvelope,
  Surface,
  RenderMode,
  RenderDescriptor,
  TransportPolicy,
  TransportPolicyKind,
  SnapshotPolicy,
  ThrottledParamPolicy,
  DirectCallbackPolicy,
  TransportDeclaration,
  TransportDispatcher,
  InspectorBridge,
  AdapterHostContext,
  AdapterEventBus,
  RuntimeAdapter,
  PersistenceAdapter,
  RenderAdapter,
  InspectorAdapter,
  EODataBase,
  EducationalObjectDefinition,
} from '../index'

describe('EOR types — identity model', () => {
  it('EOIdentity accepts only instance_id as required', () => {
    const minimal: EOIdentity = { instance_id: 'abc-123' }
    expectTypeOf(minimal).toMatchTypeOf<EOIdentity>()
  })

  it('EOIdentity allows all optional identity fields', () => {
    const full: EOIdentity = {
      instance_id: 'abc-123',
      template_id: 'helix@1',
      origin_id: 'parent-instance-id',
      derived_chain: ['ancestor-1', 'ancestor-2'],
      canonical_id: 'marketplace-canonical-id',
      runtime_id: 42,
    }
    expectTypeOf(full).toMatchTypeOf<EOIdentity>()
  })

  it('NormalizedEOIdentity requires all fields filled', () => {
    const normalized: NormalizedEOIdentity = {
      instance_id: 'abc-123',
      template_id: 'helix@1',
      origin_id: null,
      derived_chain: [],
      canonical_id: null,
      runtime_id: 1,
    }
    expectTypeOf(normalized).toMatchTypeOf<NormalizedEOIdentity>()
  })
})

describe('EOR types — capabilities', () => {
  it('Capability accepts known values', () => {
    const caps: Capability[] = [
      'Expandable',
      'Inspector',
      'HighFreqParam',
      'AnimationPersisted',
      '3DCamera',
      'ReplayPlayback',
    ]
    expectTypeOf(caps[0]).toMatchTypeOf<Capability>()
  })

  it('CapabilitySet is ReadonlySet of Capability', () => {
    const set: CapabilitySet = new Set<Capability>(['Inspector', 'ReplayPlayback'])
    expectTypeOf(set).toMatchTypeOf<CapabilitySet>()
  })
})

describe('EOR types — op envelope', () => {
  it('EOpType narrows to known op types', () => {
    const updateOp: EOpType = 'asset_update'
    const paramOp: EOpType = 'eo_param_set'
    expectTypeOf(updateOp).toMatchTypeOf<EOpType>()
    expectTypeOf(paramOp).toMatchTypeOf<EOpType>()
  })

  it('EOpEnvelope requires op_type + instance_id + payload', () => {
    const env: EOpEnvelope = {
      op_type: 'asset_update',
      instance_id: 'abc-123',
      payload: { foo: 'bar' },
    }
    expectTypeOf(env).toMatchTypeOf<EOpEnvelope>()
  })

  it('EOpEnvelope allows optional base_seq + client_ts', () => {
    const env: EOpEnvelope = {
      op_type: 'eo_param_set',
      instance_id: 'abc-123',
      payload: { name: 'slider:a', value: 0.5 },
      base_seq: 42,
      client_ts: 1234567890,
    }
    expectTypeOf(env).toMatchTypeOf<EOpEnvelope>()
  })
})

describe('EOR types — render', () => {
  it('Surface accepts semantic values (no framework leak)', () => {
    const s1: Surface = '2d-overlay'
    const s2: Surface = '3d-surface'
    const s3: Surface = 'native-canvas'
    expectTypeOf(s1).toMatchTypeOf<Surface>()
    expectTypeOf(s2).toMatchTypeOf<Surface>()
    expectTypeOf(s3).toMatchTypeOf<Surface>()
  })

  it('RenderMode covers all known modes', () => {
    const modes: RenderMode[] = ['edit', 'replay', 'preview', 'export']
    expectTypeOf(modes[0]).toMatchTypeOf<RenderMode>()
  })

  it('RenderDescriptor requires bounds + surface + zHint', () => {
    const desc: RenderDescriptor = {
      surface: '2d-overlay',
      bounds: { x: 0, y: 0, w: 100, h: 100 },
      rotation: 0,
      zHint: 'above_strokes',
    }
    expectTypeOf(desc).toMatchTypeOf<RenderDescriptor>()
  })
})

describe('EOR types — transport', () => {
  it('SnapshotPolicy has debounce_ms', () => {
    const p: SnapshotPolicy = { kind: 'SnapshotPolicy', debounce_ms: 150 }
    expectTypeOf(p).toMatchTypeOf<SnapshotPolicy>()
    expectTypeOf(p).toMatchTypeOf<TransportPolicy>()
  })

  it('ThrottledParamPolicy declares params + race_guard', () => {
    const p: ThrottledParamPolicy = {
      kind: 'ThrottledParamPolicy',
      rate_ms: 33,
      params: ['slider:a', 'slider:b'],
      race_guard: 'last_snapshot_seq',
    }
    expectTypeOf(p).toMatchTypeOf<ThrottledParamPolicy>()
    expectTypeOf(p).toMatchTypeOf<TransportPolicy>()
  })

  it('DirectCallbackPolicy carries only kind discriminator', () => {
    const p: DirectCallbackPolicy = { kind: 'DirectCallbackPolicy' }
    expectTypeOf(p).toMatchTypeOf<DirectCallbackPolicy>()
  })

  it('TransportDeclaration combines policies + routing', () => {
    const decl: TransportDeclaration = {
      policies: [{ kind: 'SnapshotPolicy', debounce_ms: 150 }],
      routing: { engine_change: 'SnapshotPolicy' },
    }
    expectTypeOf(decl).toMatchTypeOf<TransportDeclaration>()
  })

  it('TransportPolicyKind covers all 3 policy kinds', () => {
    const kinds: TransportPolicyKind[] = [
      'SnapshotPolicy',
      'ThrottledParamPolicy',
      'DirectCallbackPolicy',
    ]
    expectTypeOf(kinds[0]).toMatchTypeOf<TransportPolicyKind>()
  })

  it('TransportDispatcher is a function consuming EOpEnvelope', () => {
    const dispatcher: TransportDispatcher = (_op: EOpEnvelope) => {
      /* no-op */
    }
    expectTypeOf(dispatcher).toMatchTypeOf<TransportDispatcher>()
  })
})

describe('EOR types — adapter family', () => {
  interface MockData extends EODataBase {
    version: 1
    type: 'mock'
    counter: number
  }

  it('EODataBase requires version + type', () => {
    const data: EODataBase = { version: 1, type: 'mock' }
    expectTypeOf(data).toMatchTypeOf<EODataBase>()
  })

  it('RuntimeAdapter has 4 methods', () => {
    expectTypeOf<RuntimeAdapter<MockData, unknown>>().toHaveProperty('mount')
    expectTypeOf<RuntimeAdapter<MockData, unknown>>().toHaveProperty('applyOp')
    expectTypeOf<RuntimeAdapter<MockData, unknown>>().toHaveProperty('setInteractive')
    expectTypeOf<RuntimeAdapter<MockData, unknown>>().toHaveProperty('unmount')
  })

  it('PersistenceAdapter has 5 methods', () => {
    expectTypeOf<PersistenceAdapter<MockData>>().toHaveProperty('buildDefaultData')
    expectTypeOf<PersistenceAdapter<MockData>>().toHaveProperty('serialize')
    expectTypeOf<PersistenceAdapter<MockData>>().toHaveProperty('hydrateInitialData')
    expectTypeOf<PersistenceAdapter<MockData>>().toHaveProperty('migrate')
    expectTypeOf<PersistenceAdapter<MockData>>().toHaveProperty('normalizeForSnapshot')
  })

  it('RenderAdapter has single method getRenderDescriptor', () => {
    expectTypeOf<RenderAdapter<unknown>>().toHaveProperty('getRenderDescriptor')
  })

  it('InspectorAdapter has buildBridge method', () => {
    expectTypeOf<InspectorAdapter<unknown>>().toHaveProperty('buildBridge')
  })

  it('AdapterHostContext provides everything adapter needs', () => {
    expectTypeOf<AdapterHostContext>().toHaveProperty('stageRef')
    expectTypeOf<AdapterHostContext>().toHaveProperty('initialData')
    expectTypeOf<AdapterHostContext>().toHaveProperty('identity')
    expectTypeOf<AdapterHostContext>().toHaveProperty('replayMode')
    expectTypeOf<AdapterHostContext>().toHaveProperty('transportDispatcher')
    expectTypeOf<AdapterHostContext>().toHaveProperty('bus')
  })

  it('AdapterEventBus has emit + on', () => {
    expectTypeOf<AdapterEventBus>().toHaveProperty('emit')
    expectTypeOf<AdapterEventBus>().toHaveProperty('on')
  })
})

describe('EOR types — Inspector Bridge', () => {
  interface MockBridgeState {
    enabled: boolean
    label: string
  }

  it('InspectorBridge has local + toggle + setOption', () => {
    expectTypeOf<InspectorBridge<MockBridgeState>>().toHaveProperty('local')
    expectTypeOf<InspectorBridge<MockBridgeState>>().toHaveProperty('toggle')
    expectTypeOf<InspectorBridge<MockBridgeState>>().toHaveProperty('setOption')
  })
})

describe('EOR types — EducationalObjectDefinition', () => {
  interface MockData extends EODataBase {
    version: 1
    type: 'mock'
  }

  it('EOD requires identity + capabilities + 3 adapters + transport (Inspector optional)', () => {
    expectTypeOf<EducationalObjectDefinition<MockData, unknown>>().toHaveProperty('type')
    expectTypeOf<EducationalObjectDefinition<MockData, unknown>>().toHaveProperty('version')
    expectTypeOf<EducationalObjectDefinition<MockData, unknown>>().toHaveProperty('capabilities')
    expectTypeOf<EducationalObjectDefinition<MockData, unknown>>().toHaveProperty('runtime')
    expectTypeOf<EducationalObjectDefinition<MockData, unknown>>().toHaveProperty('persistence')
    expectTypeOf<EducationalObjectDefinition<MockData, unknown>>().toHaveProperty('render')
    expectTypeOf<EducationalObjectDefinition<MockData, unknown>>().toHaveProperty('transport')
    // inspector is optional — verified via TypeScript's `?`
  })
})
