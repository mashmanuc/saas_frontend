/**
 * EducationalObjectDefinition (EOD) — type-level composition of adapter family.
 *
 * SSOT §9.1. One EOD per EO type (e.g., trigCircleEOD, helixEOD). Registered
 * у EORuntime registry at startup (P1.b).
 *
 * STATUS: P1.a — type declaration only. NO concrete EODs yet (those come у
 * P2+ when widgets migrate one-by-one through shadow → authoritative).
 */

import type { CapabilitySet } from './capabilities'
import type {
  RuntimeAdapter,
  PersistenceAdapter,
  RenderAdapter,
  InspectorAdapter,
  EODataBase,
} from './adapters'
import type { TransportDeclaration } from './transport'

/**
 * Top-level EO definition. Composition of:
 *  - identity (type + version)
 *  - capabilities (composable opt-in)
 *  - 4 adapters (Runtime + Persistence + Render + optional Inspector)
 *  - transport (policies + event routing)
 */
export interface EducationalObjectDefinition<
  TData extends EODataBase = EODataBase,
  TEngine = unknown,
> {
  // ── Identity ─────────────────────────────────────────────────────────
  readonly type: string                       // 'trig_circle', 'helix', etc.
  readonly version: number                    // schema version (bumped on migration)
  readonly capabilities: CapabilitySet

  // ── Composed adapters ────────────────────────────────────────────────
  readonly runtime: RuntimeAdapter<TData, TEngine>
  readonly persistence: PersistenceAdapter<TData>
  readonly render: RenderAdapter<TEngine>
  readonly inspector?: InspectorAdapter<TEngine>   // OPTIONAL (Inspector capability)

  // ── Transport ────────────────────────────────────────────────────────
  readonly transport: TransportDeclaration
}
