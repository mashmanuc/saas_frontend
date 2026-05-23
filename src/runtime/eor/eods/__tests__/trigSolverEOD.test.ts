/**
 * TrigSolver EOD shadow path tests.
 *
 * Goal: validate that the EOD contract is satisfiable by a real widget,
 * AND that shadow parity comparators work на actual widget data.
 *
 * No DOM. No renderer. Mock engine simulating window.TrigEquation behaviour.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { trigSolverEOD } from '../trigSolverEOD'
import type { TrigSolverEOData, TrigSolverEngineLike } from '../trigSolverEOD'
import { EORegistry } from '../../registry'
import {
  compareSerializedSnapshots,
  compareReplaySnapshots,
  compareApplyOpDelta,
  classifyParityReport,
} from '../../shadow'
import type { TrigSolverData, TrigFuncType, TrigRelation } from '@/modules/winterboard/types/trigSolver'

// ─── Mock engine ───────────────────────────────────────────────────────

/**
 * Mock TrigEquation engine. Plain JS object that satisfies
 * TrigSolverEngineLike. Used instead of real vendor `window.TrigEquation`
 * since no DOM у unit tests.
 */
function makeMockEngine(initialState: TrigSolverData): TrigSolverEngineLike {
  let state: TrigSolverData = { ...initialState }
  return {
    setType: (t: TrigFuncType) => {
      state = { ...state, type: t }
    },
    setRel: (r: TrigRelation) => {
      state = { ...state, rel: r }
    },
    setA: (v: number) => {
      state = { ...state, a: v }
    },
    setOption: (key, value) => {
      state = { ...state, [key]: value }
    },
    getState: () => ({ ...state }),
    destroy: () => {
      // no-op
    },
  }
}

// ─── EOD shape / registry ──────────────────────────────────────────────

describe('TrigSolver EOD — shape', () => {
  it('declares type and version', () => {
    expect(trigSolverEOD.type).toBe('trig_solver')
    expect(trigSolverEOD.version).toBe(1)
  })

  it('declares Inspector + ReplayPlayback capabilities', () => {
    expect(trigSolverEOD.capabilities.has('Inspector')).toBe(true)
    expect(trigSolverEOD.capabilities.has('ReplayPlayback')).toBe(true)
    expect(trigSolverEOD.capabilities.has('Expandable')).toBe(false)
    expect(trigSolverEOD.capabilities.has('HighFreqParam')).toBe(false)
  })

  it('declares SnapshotPolicy transport з 150ms debounce', () => {
    expect(trigSolverEOD.transport.policies).toHaveLength(1)
    const policy = trigSolverEOD.transport.policies[0]
    expect(policy.kind).toBe('SnapshotPolicy')
  })

  it('has all 4 adapters (Runtime + Persistence + Render + Inspector)', () => {
    expect(trigSolverEOD.runtime).toBeDefined()
    expect(trigSolverEOD.persistence).toBeDefined()
    expect(trigSolverEOD.render).toBeDefined()
    expect(trigSolverEOD.inspector).toBeDefined()
  })
})

describe('TrigSolver EOD — registers у EORegistry', () => {
  it('register + get round-trip preserves capabilities', () => {
    const registry = new EORegistry()
    registry.register(trigSolverEOD)
    expect(registry.has('trig_solver')).toBe(true)
    expect(registry.hasCapability('trig_solver', 'Inspector')).toBe(true)
    expect(registry.hasCapability('trig_solver', 'ReplayPlayback')).toBe(true)
    expect(registry.hasCapability('trig_solver', 'Expandable')).toBe(false)
  })

  it('registered EOD is frozen (deepFreeze guard)', () => {
    const registry = new EORegistry()
    registry.register(trigSolverEOD)
    const retrieved = registry.get('trig_solver')!
    expect(Object.isFrozen(retrieved)).toBe(true)
  })
})

// ─── PersistenceAdapter ────────────────────────────────────────────────

describe('TrigSolver PersistenceAdapter — buildDefaultData', () => {
  it('default type=sin', () => {
    const d = trigSolverEOD.persistence.buildDefaultData()
    expect(d.trigType).toBe('sin')
    expect(d.rel).toBe('=')
    expect(d.a).toBe(0.5)
    expect(d.version).toBe(1)
    expect(d.type).toBe('trig_solver')
  })

  it('accepts initial type arg', () => {
    const d = trigSolverEOD.persistence.buildDefaultData({ type: 'cos' })
    expect(d.trigType).toBe('cos')
  })

  it('defaults match buildDefaultTrigSolverData', () => {
    const d = trigSolverEOD.persistence.buildDefaultData()
    expect(d.snapSpecial).toBe(true)
    expect(d.showGraph).toBe(true)
    expect(d.showAllSolutions).toBe(true)
  })
})

describe('TrigSolver PersistenceAdapter — hydrateInitialData', () => {
  const baseData: TrigSolverEOData = {
    version: 1,
    type: 'trig_solver',
    trigType: 'sin',
    rel: '=',
    a: 0.5,
    snapSpecial: true,
    showGraph: true,
    showAllSolutions: true,
  }

  it('valid data passes through unchanged', () => {
    const result = trigSolverEOD.persistence.hydrateInitialData(baseData)
    expect(result).toBe(baseData)
  })

  it('clamps sin/cos `a` to [-1, 1]', () => {
    const oob = trigSolverEOD.persistence.hydrateInitialData({ ...baseData, a: 5 })
    expect(oob.a).toBe(1)
    const negOob = trigSolverEOD.persistence.hydrateInitialData({ ...baseData, a: -10 })
    expect(negOob.a).toBe(-1)
  })

  it('replaces NaN з default 0.5', () => {
    const r = trigSolverEOD.persistence.hydrateInitialData({ ...baseData, a: NaN })
    expect(r.a).toBe(0.5)
  })

  it('does NOT clamp tan/cot a (unlimited range)', () => {
    const r = trigSolverEOD.persistence.hydrateInitialData({
      ...baseData,
      trigType: 'tan',
      a: 5,
    })
    expect(r.a).toBe(5)
  })
})

describe('TrigSolver PersistenceAdapter — serialize / round-trip', () => {
  it('serialize captures engine state', () => {
    const engine = makeMockEngine({
      version: 1,
      type: 'cos',
      rel: '>',
      a: 0.7,
      snapSpecial: false,
      showGraph: true,
      showAllSolutions: false,
    })
    const data = trigSolverEOD.persistence.serialize(engine)
    expect(data.trigType).toBe('cos')
    expect(data.rel).toBe('>')
    expect(data.a).toBe(0.7)
    expect(data.snapSpecial).toBe(false)
  })

  it('round-trip: build → engine → serialize → build same shape', () => {
    const original = trigSolverEOD.persistence.buildDefaultData({ type: 'sin' })
    const engineState = {
      version: 1 as const,
      type: original.trigType,
      rel: original.rel,
      a: original.a,
      snapSpecial: original.snapSpecial,
      showGraph: original.showGraph,
      showAllSolutions: original.showAllSolutions,
    }
    const engine = makeMockEngine(engineState)
    const serialized = trigSolverEOD.persistence.serialize(engine)
    expect(serialized).toEqual(original)
  })
})

describe('TrigSolver PersistenceAdapter — migrate', () => {
  it('identity migration for same version', () => {
    const data = trigSolverEOD.persistence.buildDefaultData()
    const result = trigSolverEOD.persistence.migrate(data, 1, 1)
    expect(result).toEqual(data)
  })

  it('unknown migration falls back to default', () => {
    const result = trigSolverEOD.persistence.migrate({ junk: 'data' }, 0, 1)
    expect(result.type).toBe('trig_solver')
    expect(result.trigType).toBe('sin')
  })
})

describe('TrigSolver PersistenceAdapter — normalizeForSnapshot', () => {
  it('identity (no URL hygiene needed)', () => {
    const data = trigSolverEOD.persistence.buildDefaultData()
    expect(trigSolverEOD.persistence.normalizeForSnapshot(data)).toBe(data)
  })
})

// ─── RuntimeAdapter ────────────────────────────────────────────────────

describe('TrigSolver RuntimeAdapter — applyOp', () => {
  let engine: TrigSolverEngineLike

  beforeEach(() => {
    engine = makeMockEngine({
      version: 1,
      type: 'sin',
      rel: '=',
      a: 0.5,
      snapSpecial: true,
      showGraph: true,
      showAllSolutions: true,
    })
  })

  it('asset_update with new type calls engine.setType', () => {
    trigSolverEOD.runtime.applyOp(
      {
        op_type: 'asset_update',
        instance_id: 'a1',
        payload: { data: { type: 'cos' } },
      },
      engine,
    )
    expect(engine.getState().type).toBe('cos')
  })

  it('asset_update with new `a` calls engine.setA', () => {
    trigSolverEOD.runtime.applyOp(
      {
        op_type: 'asset_update',
        instance_id: 'a1',
        payload: { data: { a: 0.9 } },
      },
      engine,
    )
    expect(engine.getState().a).toBe(0.9)
  })

  it('multiple field updates у single op', () => {
    trigSolverEOD.runtime.applyOp(
      {
        op_type: 'asset_update',
        instance_id: 'a1',
        payload: { data: { type: 'tan', rel: '<', a: 0.3 } },
      },
      engine,
    )
    const s = engine.getState()
    expect(s.type).toBe('tan')
    expect(s.rel).toBe('<')
    expect(s.a).toBe(0.3)
  })

  it('unchanged fields not re-applied (diff-based routing)', () => {
    let setTypeCalled = 0
    engine.setType = (t) => {
      setTypeCalled++
      ;(engine as any)._state = { ...engine.getState(), type: t }
    }
    trigSolverEOD.runtime.applyOp(
      {
        op_type: 'asset_update',
        instance_id: 'a1',
        payload: { data: { type: 'sin', a: 0.9 } },  // type unchanged
      },
      engine,
    )
    expect(setTypeCalled).toBe(0)  // type 'sin' matches current → no call
  })

  it('toggles options via setOption', () => {
    trigSolverEOD.runtime.applyOp(
      {
        op_type: 'asset_update',
        instance_id: 'a1',
        payload: { data: { showGraph: false } },
      },
      engine,
    )
    expect(engine.getState().showGraph).toBe(false)
  })

  it('ignores non-asset_update ops', () => {
    const before = engine.getState()
    trigSolverEOD.runtime.applyOp(
      {
        op_type: 'eo_param_set',
        instance_id: 'a1',
        payload: { name: 'something', value: 99 },
      },
      engine,
    )
    expect(engine.getState()).toEqual(before)
  })
})

describe('TrigSolver RuntimeAdapter — unmount', () => {
  it('calls engine.destroy', () => {
    let destroyed = false
    const engine = makeMockEngine({
      version: 1, type: 'sin', rel: '=', a: 0.5,
      snapSpecial: true, showGraph: true, showAllSolutions: true,
    })
    engine.destroy = () => { destroyed = true }
    void trigSolverEOD.runtime.unmount(engine)
    expect(destroyed).toBe(true)
  })
})

// ─── RenderAdapter ─────────────────────────────────────────────────────

describe('TrigSolver RenderAdapter', () => {
  it('returns 2d-overlay descriptor з default dimensions', () => {
    const engine = makeMockEngine({
      version: 1, type: 'sin', rel: '=', a: 0.5,
      snapSpecial: true, showGraph: true, showAllSolutions: true,
    })
    const d = trigSolverEOD.render.getRenderDescriptor(engine, 'edit')
    expect(d.surface).toBe('2d-overlay')
    expect(d.zHint).toBe('above_strokes')
    expect(d.bounds.w).toBe(700)
    expect(d.bounds.h).toBe(480)
  })
})

// ─── InspectorAdapter ──────────────────────────────────────────────────

describe('TrigSolver InspectorAdapter', () => {
  it('buildBridge exposes engine state via local', () => {
    const engine = makeMockEngine({
      version: 1, type: 'cos', rel: '>', a: 0.7,
      snapSpecial: false, showGraph: true, showAllSolutions: true,
    })
    const bridge = trigSolverEOD.inspector!.buildBridge(engine)
    expect(bridge.local.type).toBe('cos')
    expect(bridge.local.rel).toBe('>')
    expect(bridge.local.a).toBe(0.7)
  })

  it('bridge.setOption routes to engine methods', () => {
    const engine = makeMockEngine({
      version: 1, type: 'sin', rel: '=', a: 0.5,
      snapSpecial: true, showGraph: true, showAllSolutions: true,
    })
    const bridge = trigSolverEOD.inspector!.buildBridge(engine)
    bridge.setOption('a', 0.9)
    expect(engine.getState().a).toBe(0.9)
  })
})

// ─── Shadow parity validation (EOD vs legacy) ──────────────────────────

describe('TrigSolver shadow parity — serialize', () => {
  it('EOD-serialized state matches legacy-shaped board_state data', () => {
    // Legacy stores TrigSolverData directly under asset.data
    const legacy = {
      data: {
        version: 1,
        type: 'sin',
        rel: '=',
        a: 0.5,
        snapSpecial: true,
        showGraph: true,
        showAllSolutions: true,
      },
    }
    // EOD wraps with type discriminator у data
    const engine = makeMockEngine(legacy.data as TrigSolverData)
    const eodData = trigSolverEOD.persistence.serialize(engine)
    // Strip EOD-specific outer envelope для parity comparison
    const eodFlat = {
      data: {
        version: eodData.version,
        type: eodData.trigType,  // back to original field name
        rel: eodData.rel,
        a: eodData.a,
        snapSpecial: eodData.snapSpecial,
        showGraph: eodData.showGraph,
        showAllSolutions: eodData.showAllSolutions,
      },
    }
    const report = compareSerializedSnapshots(legacy, eodFlat)
    expect(report.verdict).toBe('match')
  })
})

describe('TrigSolver shadow parity — replay', () => {
  it('replay snapshot з ephemeral noise → match', () => {
    const legacyAfterOps = {
      pages: [{
        assets: [{
          instance_id: 'ts-001',
          runtime_id: 1,
          type: 'trig_solver',
          data: {
            version: 1, type: 'cos', rel: '>', a: 0.7,
            snapSpecial: false, showGraph: true, showAllSolutions: true,
          },
        }],
      }],
    }
    const eodAfterOps = {
      pages: [{
        assets: [{
          instance_id: 'ts-001',
          runtime_id: 99,  // ephemeral, ignored by replay parity
          type: 'trig_solver',
          data: {
            version: 1, type: 'cos', rel: '>', a: 0.7,
            snapSpecial: false, showGraph: true, showAllSolutions: true,
          },
        }],
      }],
    }
    expect(compareReplaySnapshots(legacyAfterOps, eodAfterOps).verdict).toBe('match')
  })
})

describe('TrigSolver shadow parity — applyOp delta', () => {
  it('legacy + EOD apply same op → matching deltas', () => {
    const beforeState = {
      version: 1, type: 'sin', rel: '=', a: 0.5,
      snapSpecial: true, showGraph: true, showAllSolutions: true,
    } as TrigSolverData

    // Legacy: directly mutates data (simulated)
    const legacyAfter = { ...beforeState, a: 0.7 }

    // EOD: applyOp on mock engine, then serialize
    const engine = makeMockEngine(beforeState)
    trigSolverEOD.runtime.applyOp(
      {
        op_type: 'asset_update',
        instance_id: 'ts-001',
        payload: { data: { a: 0.7 } },
      },
      engine,
    )
    const eodAfter = engine.getState()

    const r = compareApplyOpDelta(
      beforeState,
      legacyAfter,
      beforeState,
      eodAfter,
      { op_type: 'asset_update', instance_id: 'ts-001' },
    )
    expect(r.verdict).toBe('match')
  })

  it('catch mismatch when EOD adds extra field legacy did not', () => {
    const before = {
      version: 1, type: 'sin' as const, rel: '=' as const, a: 0.5,
      snapSpecial: true, showGraph: true, showAllSolutions: true,
    }
    const legacyAfter = before  // no-op
    const eodAfter = { ...before, extraField: 'unexpected' }  // EOD added field

    const r = compareApplyOpDelta(
      before, legacyAfter, before, eodAfter,
      { op_type: 'asset_update', instance_id: 'ts-001' },
    )
    expect(r.verdict).toBe('mismatch')
  })
})

describe('TrigSolver shadow parity — classification on real divergence', () => {
  it('classifies value mismatch correctly', () => {
    const legacy = {
      data: { type: 'sin', a: 0.5 },
    }
    const eod = {
      data: { type: 'sin', a: 0.7 },
    }
    const report = compareSerializedSnapshots(legacy, eod)
    const summary = classifyParityReport(report)
    expect(summary.countByCategory.value_mismatch).toBe(1)
  })
})
