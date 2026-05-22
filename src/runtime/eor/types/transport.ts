/**
 * Transport Policies — declarative dispatch strategies.
 *
 * SSOT §4. Policies declare HOW engine state changes flow to op log.
 * Adapter declares, runtime dispatches.
 *
 * STATUS: P1.a — type declarations only. NO dispatch wiring.
 * Concrete policy classes у P1.e (interfaces + base skeletons).
 */

import type { EOpEnvelope } from './op-envelope'

/**
 * Policy kind — discriminator for the tagged union.
 */
export type TransportPolicyKind =
  | 'SnapshotPolicy'
  | 'ThrottledParamPolicy'
  | 'DirectCallbackPolicy'

/**
 * Base policy interface — all policies share these.
 */
export interface TransportPolicyBase {
  readonly kind: TransportPolicyKind
}

/**
 * SnapshotPolicy — default. UI buttons, toggles, params with latency tolerance.
 *
 * Mechanism: setTimeout debounce → serialize() → asset_update op.
 * No race protection — last writer wins (acceptable: human UI latency >150ms).
 */
export interface SnapshotPolicy extends TransportPolicyBase {
  readonly kind: 'SnapshotPolicy'
  readonly debounce_ms: number      // must be >= 100 per TR-INV-2
}

/**
 * ThrottledParamPolicy — high-freq drag (slider, draggable point on graph).
 *
 * Mechanism: requestAnimationFrame throttle → granular eo_param_set op.
 * Race protection REQUIRED (TR-INV-3) — server rejects stale param sets
 * via base_seq check against `race_guard` field.
 */
export interface ThrottledParamPolicy extends TransportPolicyBase {
  readonly kind: 'ThrottledParamPolicy'
  readonly rate_ms: number                  // typical 16-33
  readonly params: readonly string[]        // which engine params route here
  readonly race_guard: string               // typically 'last_snapshot_seq'
}

/**
 * DirectCallbackPolicy — synchronous emit. DEPRECATED for new EODs (TR-INV-4).
 *
 * Currently only NMT3D uses this (orbit camera latency). Migrate to
 * ThrottledParamPolicy(rate_ms=16) у P6.
 */
export interface DirectCallbackPolicy extends TransportPolicyBase {
  readonly kind: 'DirectCallbackPolicy'
}

/**
 * Union — all policy types.
 */
export type TransportPolicy =
  | SnapshotPolicy
  | ThrottledParamPolicy
  | DirectCallbackPolicy

/**
 * Event routing table — maps engine event names to policy kinds.
 *
 * MANDATORY when EOD declares >1 policy (TR-INV-6). Disambiguates which
 * policy handles which engine event.
 */
export type TransportEventRouting = Readonly<Record<string, TransportPolicyKind>>

/**
 * Transport block — declared у EducationalObjectDefinition.
 */
export interface TransportDeclaration {
  readonly policies: readonly TransportPolicy[]
  readonly routing: TransportEventRouting
}

/**
 * Transport dispatcher — function passed to adapter via AdapterHostContext.
 *
 * Adapter never writes WBBoardOperation directly (TR-INV-1). Instead:
 *   host.transportDispatcher(envelope) → runtime queues through declared policies
 */
export type TransportDispatcher = (op: EOpEnvelope) => void
