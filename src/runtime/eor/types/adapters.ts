/**
 * Adapter family — decomposed contract for Educational Objects.
 *
 * SSOT §9. Decomposition replaces god-interface RuntimeAdapter from v0.1.
 * Each adapter has single responsibility. Headless / export-only / AI-generated
 * EOs may skip unneeded adapters (only Runtime + Persistence are mandatory).
 *
 * STATUS: P1.a — interface declarations only. NO implementations. NO base classes.
 */

import type { AdapterHostContext } from './adapter-host'
import type { EOpEnvelope } from './op-envelope'
import type { RenderDescriptor, RenderMode } from './surface'
import type { InspectorBridge } from './inspector-bridge'

/**
 * Base data shape constraint — every EO's persisted data has these fields.
 */
export interface EODataBase {
  readonly version: number
  readonly type: string
  // Additional EO-specific fields у subtype
}

/**
 * RuntimeAdapter — engine lifecycle only (mount / applyOp / setInteractive / unmount).
 *
 * NO persistence, NO render descriptor, NO inspector — those live у sibling adapters.
 */
export interface RuntimeAdapter<TData extends EODataBase, TEngine> {
  /**
   * Create engine instance. Runs vendor `ensureBundle()`, instantiates engine,
   * subscribes to engine events (routed via host.bus.emit), returns engine
   * reference.
   *
   * INVARIANT (LIFE-INV-1): host.initialData is never null.
   * INVARIANT (LIFE-INV-5): mount is async; runtime shows placeholder during INITIALIZING.
   */
  mount(host: AdapterHostContext<TData>): Promise<TEngine>

  /**
   * Apply incoming op to engine. Routes by op_type to engine.setState()/setParam()/etc.
   *
   * INVARIANT (LIFE-INV-2): MUST be idempotent (same op_id applied twice = no-op).
   * INVARIANT (REPL-INV-1): MUST be deterministic given same op sequence.
   * INVARIANT (REPL-INV-2): MUST NOT emit ops while host.replayMode === true.
   * INVARIANT (REPL-INV-5): MUST honor side-effect isolation у replay mode.
   */
  applyOp(op: EOpEnvelope, engine: TEngine): void

  /**
   * Toggle interactive state. False = pen tool active, chrome hidden,
   * pointer-events off. True = normal editing.
   */
  setInteractive(engine: TEngine, interactive: boolean): void

  /**
   * Cleanup engine. MUST flush pending transport buffers (LIFE-INV-3).
   */
  unmount(engine: TEngine): Promise<void>
}

/**
 * PersistenceAdapter — data lifecycle (default / serialize / migrate / normalize).
 *
 * Mandatory for ALL EODs (even headless ones — need to load/save data).
 */
export interface PersistenceAdapter<TData extends EODataBase> {
  /**
   * Default data when EO created from scratch (e.g., user drops on canvas).
   */
  buildDefaultData(args?: Record<string, unknown>): TData

  /**
   * Engine → snapshot data (pure, deterministic).
   *
   * INVARIANT (PERS-INV-1): output MUST be JSON-stringifiable.
   * INVARIANT (LIFE-INV-4): MUST be pure (no side effects).
   */
  serialize(engine: unknown): TData

  /**
   * Validate and normalize loaded data. Called at mount-time on initial data.
   * Returns sanitized data.
   *
   * Example: ensure required fields exist, clamp out-of-range values.
   */
  hydrateInitialData(data: TData): TData

  /**
   * Schema migration per PERS-INV-3. Adapter-owned (per Q8 resolution).
   *
   * Called when loaded data.version differs from current EOD version.
   * MUST handle each version step (1 → 2 → 3, etc.).
   */
  migrate(data: unknown, fromVersion: number, toVersion: number): TData

  /**
   * Snapshot hygiene per PERS-INV-4 — normalize URLs to public-read paths,
   * strip session-scoped tokens, etc.
   *
   * Called before saving to KnowledgeLessonSnapshot.
   */
  normalizeForSnapshot(data: TData): TData
}

/**
 * RenderAdapter — produces descriptor; does NOT directly render.
 *
 * Integration layer (Vue+Konva, React, etc.) consumes RenderDescriptor and
 * creates actual render node. This adapter is framework-agnostic.
 */
export interface RenderAdapter<TEngine> {
  /**
   * Returns descriptor describing what surface this EO needs and where.
   *
   * Mode determines context (edit / replay / preview / export). Adapter
   * may return different descriptors per mode (e.g., simpler shape для export).
   */
  getRenderDescriptor(engine: TEngine, mode: RenderMode): RenderDescriptor
}

/**
 * InspectorAdapter — optional, only if EOD declares 'Inspector' capability.
 *
 * Headless / static / server-rendered EOs do NOT need this. Decomposition
 * makes it explicit that Inspector is opt-in feature, not mandatory.
 */
export interface InspectorAdapter<TEngine, TBridgeState = unknown> {
  /**
   * Build reactive bridge for sidebar Inspector component.
   *
   * Returned bridge MUST satisfy BR-INV-1..4 (reactive, action methods
   * route through engine API, survives show/hide, auto-released on unmount).
   */
  buildBridge(engine: TEngine): InspectorBridge<TBridgeState>
}
