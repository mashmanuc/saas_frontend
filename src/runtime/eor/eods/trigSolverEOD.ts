/**
 * TrigSolver EOD — first concrete EducationalObjectDefinition.
 *
 * STATUS: P2 — minimal shadow path. NOT wired до production renderer.
 *
 * Goal (per user mandate post infrastructure freeze):
 *   Validate REAL widget migration ergonomics. Identify pain points.
 *   Practical migration > infrastructure purity.
 *
 * §15.6 boundary respected:
 *   - This file is NEW under frontend/src/runtime/eor/eods/
 *   - Imports from existing modules are READ-ONLY (types + defaults builder)
 *   - NO modification of TrigSolverRenderer.vue / TrigSolverInspector.vue /
 *     trigSolverUiState.ts
 *
 * Migration approach:
 *   This EOD WRAPS existing TrigSolver code. Original renderer / inspector
 *   continue functioning. EOD is a parallel description that shadow validator
 *   uses to compare behaviour. Eventually (P2.5+ when shadow parity proven)
 *   renderer can be re-pointed to consume RenderAdapter, but NOT yet.
 *
 * ─── REAL MIGRATION PAIN POINTS DISCOVERED ─────────────────────────────
 *
 *  PP-1: RuntimeAdapter.mount(host) requires HTMLElement у host.stageRef.
 *        TrigSolver vendor engine (window.TrigEquation) is created with
 *        DOM container. У unit tests there's no DOM → mount() can only
 *        be exercised via integration tests, not isolated unit tests.
 *        Workaround у P2: provide a "headless" mock mount path для tests.
 *
 *  PP-2: Engine type. TrigEquation is JS vendor — no TS definitions.
 *        Adapter declares `TEngine = unknown` which loses type safety.
 *        Future: ship engine .d.ts alongside vendor bundle, OR wrap
 *        engine у typed facade.
 *
 *  PP-3: applyOp routing. TrigEquation has setType / setRel / setA — no
 *        single setState method. Adapter's applyOp must dispatch based
 *        on which field changed у the snapshot payload (asset_update
 *        carries full data). Adapter ends up doing diff(currentData, newData)
 *        then calling methods. Это NOT what contract assumed.
 *        Solution thought: introduce optional engine.setState fallback;
 *        if absent, adapter computes per-field diff and routes per field.
 *
 *  PP-4: InspectorBridge ownership clash. Existing TrigSolver pattern:
 *        renderer creates bridge у onMount, calls registerTrigSolver(id, bridge),
 *        global module-level trigSolverUiState holds reference. Inspector
 *        reads from trigSolverUiState.bridge.
 *        EOD InspectorAdapter.buildBridge(engine) → bridge — assumes
 *        adapter owns bridge lifecycle. Conflict: who creates it?
 *        Resolution: у shadow mode, EOD's buildBridge returns a NEW bridge
 *        instance just for parity comparison; production bridge stays
 *        renderer-owned. Authority transfer phase (P2.5+) decides ownership.
 *
 *  PP-5: Snapshot is JUST the data field (`TrigSolverData`). But asset
 *        envelope has wider shape (id, type, x, y, w, h, etc. via WBAsset).
 *        Adapter scope: data only, or full asset? RuntimeAdapter docs say
 *        "data". But shadow comparator у real shadow mode receives FULL
 *        board_state — needs filtering. Glue layer concern (P1.5.d).
 *
 *  PP-6: No deprecated 'engine_change' event у vendor TrigEquation.
 *        Engine emits via own callback shape. Adapter must subscribe to
 *        vendor's API и translate to host.bus.emit('engine_change', payload).
 *        Every EOD needs translation code. SSOT §9 doesn't specify event
 *        names beyond 'engine_change' as example. Need explicit catalog
 *        of canonical bus events у future SSOT amendment.
 *
 * ─── End of pain points (more may surface in test/usage) ──────────────
 */

import type {
  EducationalObjectDefinition,
  RuntimeAdapter,
  PersistenceAdapter,
  RenderAdapter,
  InspectorAdapter,
  EODataBase,
} from '../types'
import { SnapshotPolicyImpl } from '../transport'
import { applyDataDiff } from '../utils/applyDataDiff'
import type { FieldSetterMap } from '../utils/applyDataDiff'
import { EngineEvent } from '../events'

// READ-ONLY import from existing TrigSolver module (types + defaults).
// §15.6: no modification, just type/data reuse.
import type {
  TrigSolverData,
  TrigFuncType,
  TrigRelation,
} from '@/modules/winterboard/types/trigSolver'
import { buildDefaultTrigSolverData } from '@/modules/winterboard/constants/trigSolverDefaults'

// ─── TrigSolver-specific types для EOD context ──────────────────────────

/**
 * EOD data extends EODataBase with TrigSolver fields. We re-declare here
 * to satisfy `extends EODataBase` constraint while preserving original shape.
 *
 * Identical to TrigSolverData but у EODataBase-conformant form (type field
 * is more specific — 'trig_solver' literal).
 */
export interface TrigSolverEOData extends EODataBase {
  readonly version: 1
  readonly type: 'trig_solver'
  readonly trigType: TrigFuncType
  readonly rel: TrigRelation
  readonly a: number
  readonly snapSpecial: boolean
  readonly showGraph: boolean
  readonly showAllSolutions: boolean
}

/**
 * Map existing TrigSolverData → EOD data shape.
 *
 * PP note: existing `TrigSolverData.type` collides з `EODataBase.type`
 * (both are discriminator strings, but TrigSolverData.type = 'sin'|'cos'|...
 * while EODataBase.type = 'trig_solver'). Mapped to `trigType` here to
 * disambiguate. Production would need to either rename original field OR
 * adapter does field-level translation (we do the latter).
 */
function fromTrigSolverData(d: TrigSolverData): TrigSolverEOData {
  return {
    version: 1,
    type: 'trig_solver',
    trigType: d.type,
    rel: d.rel,
    a: d.a,
    snapSpecial: d.snapSpecial,
    showGraph: d.showGraph,
    showAllSolutions: d.showAllSolutions,
  }
}

function toTrigSolverData(d: TrigSolverEOData): TrigSolverData {
  return {
    version: 1,
    type: d.trigType,
    rel: d.rel,
    a: d.a,
    snapSpecial: d.snapSpecial,
    showGraph: d.showGraph,
    showAllSolutions: d.showAllSolutions,
  }
}

/**
 * Engine type. TrigEquation is JS vendor — no .d.ts. Adapter must work
 * against `unknown` shape с runtime guards. See PP-2.
 *
 * Minimal mockable interface для unit tests; real engine has more methods.
 */
export interface TrigSolverEngineLike {
  setType(t: TrigFuncType): void
  setRel(r: TrigRelation): void
  setA(v: number): void
  setOption(key: 'snapSpecial' | 'showGraph' | 'showAllSolutions', value: boolean): void
  getState(): TrigSolverData
  destroy(): void
}

/**
 * Bridge state shape matches existing TrigSolverLocalState — only needed
 * для InspectorAdapter return type.
 */
interface TrigSolverBridgeState {
  type: TrigFuncType
  rel: TrigRelation
  a: number
  snapSpecial: boolean
  showGraph: boolean
  showAllSolutions: boolean
}

// ─── PP-3 setter map for applyDataDiff ────────────────────────────────
// Declared ONCE here. Helper routes per-field diffs to these setters.
// Compare з old ad-hoc applyOp implementation у git history — this is
// the canonical replacement pattern.

const TRIG_SOLVER_SETTERS: FieldSetterMap<TrigSolverEngineLike, TrigSolverData> = {
  type: (e, v) => e.setType(v),
  rel: (e, v) => e.setRel(v),
  a: (e, v) => e.setA(v),
  snapSpecial: (e, v) => e.setOption('snapSpecial', v),
  showGraph: (e, v) => e.setOption('showGraph', v),
  showAllSolutions: (e, v) => e.setOption('showAllSolutions', v),
}

// ─── PersistenceAdapter ────────────────────────────────────────────────

const persistence: PersistenceAdapter<TrigSolverEOData> = {
  buildDefaultData(args?: Record<string, unknown>): TrigSolverEOData {
    const initialType = (args?.type as TrigFuncType) ?? 'sin'
    return fromTrigSolverData(buildDefaultTrigSolverData(initialType))
  },

  serialize(engine: unknown): TrigSolverEOData {
    // PP-2: engine is unknown. Need runtime guard or cast.
    const e = engine as TrigSolverEngineLike
    return fromTrigSolverData(e.getState())
  },

  hydrateInitialData(data: TrigSolverEOData): TrigSolverEOData {
    // Validate ranges. sin/cos: clamp a to [-1, 1].
    let a = data.a
    if (!Number.isFinite(a)) a = 0.5
    if ((data.trigType === 'sin' || data.trigType === 'cos') && Math.abs(a) > 1) {
      a = Math.max(-1, Math.min(1, a))
    }
    if (a === data.a) return data
    return Object.freeze({ ...data, a })
  },

  migrate(data: unknown, fromVersion: number, toVersion: number): TrigSolverEOData {
    // Single version (1) — identity migration. Future bumps would add cases.
    if (fromVersion === toVersion) return data as TrigSolverEOData
    // Unknown migration path → conservative default, log у future telemetry
    const fallback = buildDefaultTrigSolverData('sin')
    return fromTrigSolverData(fallback)
  },

  normalizeForSnapshot(data: TrigSolverEOData): TrigSolverEOData {
    // TrigSolver has no asset URLs / session-scoped tokens. Identity.
    return data
  },
}

// ─── RuntimeAdapter ────────────────────────────────────────────────────

const runtime: RuntimeAdapter<TrigSolverEOData, TrigSolverEngineLike> = {
  async mount(host) {
    // PP-1: real vendor mount requires DOM + bundle load. У shadow tests
    // this adapter is exercised via mock engine, not real vendor.
    // Production wiring (post P2.5) will replace with real ensureBundle().
    throw new Error(
      'TrigSolver EOD mount() — shadow-only stub. Real mount lives у ' +
        'TrigSolverRenderer.vue until authority transfer (P2.5+).',
    )
  },

  applyOp(op, engine) {
    // PP-3 RESOLVED: use canonical applyDataDiff helper instead of
    // hand-rolled if/else cascade. Adapter declares setter map once
    // (below) and helper routes per-field diffs from incoming payload.
    if (op.op_type !== 'asset_update') return
    const payload = op.payload as { data?: Partial<TrigSolverData> } | undefined
    const newData = payload?.data
    if (!newData) return
    applyDataDiff(engine, engine.getState(), newData, TRIG_SOLVER_SETTERS)
  },

  setInteractive(_engine, _interactive) {
    // TrigSolver vendor has no setInteractive — interactivity is CSS-driven
    // by host (pointer-events:none у parent). Adapter no-op.
    // PP-7 (new): contract assumes engine handles interactivity but many
    // vendor engines (TrigEquation, vendor calculus) delegate to host CSS.
  },

  async unmount(engine) {
    engine.destroy()
  },
}

// ─── RenderAdapter ─────────────────────────────────────────────────────

const render: RenderAdapter<TrigSolverEngineLike> = {
  getRenderDescriptor(_engine, _mode) {
    return {
      surface: '2d-overlay',
      bounds: { x: 0, y: 0, w: 700, h: 480 }, // default dimensions
      rotation: 0,
      zHint: 'above_strokes',
    }
  },
}

// ─── InspectorAdapter ──────────────────────────────────────────────────

const inspector: InspectorAdapter<TrigSolverEngineLike, TrigSolverBridgeState> = {
  buildBridge(engine) {
    // PP-4: This bridge is shadow-scoped. Production bridge remains
    // renderer-owned via registerTrigSolver() у trigSolverUiState.ts.
    // Once authority transfers, this bridge replaces it.
    const state = engine.getState()
    const local: TrigSolverBridgeState = {
      type: state.type,
      rel: state.rel,
      a: state.a,
      snapSpecial: state.snapSpecial,
      showGraph: state.showGraph,
      showAllSolutions: state.showAllSolutions,
    }
    return {
      local: local as TrigSolverBridgeState & { readonly __reactive: unique symbol },
      toggle(key) {
        if (
          key === 'snapSpecial' ||
          key === 'showGraph' ||
          key === 'showAllSolutions'
        ) {
          engine.setOption(key, !local[key])
        }
      },
      setOption(key, value) {
        if (key === 'type') engine.setType(value as TrigFuncType)
        else if (key === 'rel') engine.setRel(value as TrigRelation)
        else if (key === 'a') engine.setA(value as number)
        else if (
          key === 'snapSpecial' ||
          key === 'showGraph' ||
          key === 'showAllSolutions'
        ) {
          engine.setOption(key, value as boolean)
        }
      },
    }
  },
}

// ─── Top-level EOD ─────────────────────────────────────────────────────

export const trigSolverEOD: EducationalObjectDefinition<
  TrigSolverEOData,
  TrigSolverEngineLike
> = {
  type: 'trig_solver',
  version: 1,
  capabilities: new Set(['Inspector', 'ReplayPlayback']),
  runtime,
  persistence,
  render,
  inspector,
  transport: {
    policies: [new SnapshotPolicyImpl({ debounce_ms: 150 })],
    // PP-6 RESOLVED: use canonical EngineEvent constants instead of bare strings.
    routing: {
      [EngineEvent.ENGINE_CHANGE]: 'SnapshotPolicy',
    },
  },
}
