/**
 * Adapter Host Context — passed by EO Runtime to adapter's mount().
 *
 * SSOT §9.2. Provides adapter with everything it needs WITHOUT giving
 * it direct access to runtime internals or DB.
 *
 * STATUS: P1.a — type declarations only.
 */

import type { NormalizedEOIdentity } from './identity'
import type { TransportDispatcher } from './transport'

/**
 * Event bus — adapter emits engine events; runtime routes via transport.
 *
 * Adapter calls `bus.emit('engine_change', payload)` and runtime decides
 * which policy fires (based on routing table). Adapter does NOT call
 * transport directly.
 */
export interface AdapterEventBus {
  emit(event: string, payload?: unknown): void

  // Subscribe for adapter-internal events (e.g., 'expand_requested' from UI)
  on(event: string, handler: (payload?: unknown) => void): () => void
  // Returns unsubscribe function
}

/**
 * Adapter host context — provided at mount time.
 *
 * Adapter receives this and stores reference. It contains everything
 * adapter needs to participate у the runtime: render target, initial data,
 * identity, transport dispatcher, event bus.
 */
export interface AdapterHostContext<TData = unknown> {
  // Render target — adapter mounts engine into this element
  readonly stageRef: HTMLElement

  // Initial data — already normalized, deserialized from board_state
  readonly initialData: TData

  // Identity — already normalized per ID-MIG-INV
  readonly identity: NormalizedEOIdentity

  // Are we replaying? Adapter MUST suspend transport, disable animations,
  // gate side effects (REPL-INV-5).
  readonly replayMode: boolean

  // Transport dispatcher — adapter calls this to emit ops
  readonly transportDispatcher: TransportDispatcher

  // Event bus — adapter emits engine events; runtime routes
  readonly bus: AdapterEventBus
}
