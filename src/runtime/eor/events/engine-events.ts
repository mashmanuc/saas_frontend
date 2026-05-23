/**
 * Canonical engine event catalog.
 *
 * Per user mandate (targeted correction sprint PP-6):
 *
 *   "right now event names are ad-hoc. Need minimal canonical vocabulary."
 *
 *   STRICT:
 *     - Do NOT build event bus framework
 *     - Do NOT build orchestration layer
 *     - ONLY define stable naming contract
 *
 * ─── THE CATALOG ───────────────────────────────────────────────────────
 *
 *   engine_change       — general state mutation
 *                         (most common; default policy = SnapshotPolicy)
 *
 *   param_change        — specific named parameter change
 *                         (ThrottledParamPolicy candidate;
 *                          carry `{ name: string, value: unknown }` payload)
 *
 *   expand_requested    — UI signal — user clicked expand button
 *                         (caught by runtime, NOT engine state change)
 *
 *   interaction_start   — user began interacting (drag, slider grab)
 *                         (host may toggle pen-tool gates у response)
 *
 *   interaction_end     — user ended interaction
 *                         (host may resume autosave / snapshot)
 *
 * ─── USAGE ─────────────────────────────────────────────────────────────
 *
 *   import { EngineEvent } from '@/runtime/eor/events/engine-events'
 *
 *   // Adapter emits canonical name:
 *   host.bus.emit(EngineEvent.ENGINE_CHANGE, payload)
 *
 *   // Transport routing references same names:
 *   routing: {
 *     [EngineEvent.ENGINE_CHANGE]: 'SnapshotPolicy',
 *     [EngineEvent.PARAM_CHANGE]:  'ThrottledParamPolicy',
 *   }
 *
 * Adapters MUST use these constants instead of bare strings. Telemetry /
 * dashboards / debugging tools can rely on stable vocabulary.
 *
 * NEW EVENTS require SSOT amendment + addition to this catalog.
 * Adapter-specific events (e.g., 'helix_orbit_settled') are NOT permitted —
 * funnel into one of the canonical events with descriptive payload instead.
 *
 * STATUS: P2-correction PP-6. Type-only — dead unless explicitly imported.
 */

/**
 * Canonical engine event names. Frozen const object — adapters import
 * constants by name rather than typing bare strings.
 */
export const EngineEvent = Object.freeze({
  /**
   * General engine state mutation. Most common event.
   * Default policy mapping: SnapshotPolicy.
   */
  ENGINE_CHANGE: 'engine_change',

  /**
   * Specific parameter change з name + value payload. Suitable for
   * high-frequency input (sliders, drag handles).
   * Default policy mapping: ThrottledParamPolicy (if HighFreqParam capability)
   *                         OR SnapshotPolicy otherwise.
   */
  PARAM_CHANGE: 'param_change',

  /**
   * User clicked expand button. UI signal up to runtime — runtime decides
   * how to handle (fullscreen modal, inline expansion, etc.).
   * Not an engine state change — does NOT trigger transport policies.
   */
  EXPAND_REQUESTED: 'expand_requested',

  /**
   * User began interactive gesture (drag, slider grab, pointer down on
   * draggable element). Host may pause autosave or toggle pen-tool gates.
   * Not an engine state change.
   */
  INTERACTION_START: 'interaction_start',

  /**
   * User ended interactive gesture. Host may resume autosave / flush
   * pending snapshot.
   * Not an engine state change.
   */
  INTERACTION_END: 'interaction_end',
} as const)

/**
 * Type-level catalog — string union of all canonical event names.
 *
 * Adapter MAY type its event subscriptions via this union for compile-time
 * safety:
 *
 *   bus.on(eventName as EngineEventName, handler)
 */
export type EngineEventName = (typeof EngineEvent)[keyof typeof EngineEvent]

/**
 * Set of canonical event names for runtime lookup / validation.
 *
 * Use case: validate that an adapter is emitting only canonical events
 * (linter / dev assertion). Frozen for safety.
 */
export const CANONICAL_ENGINE_EVENTS: ReadonlySet<EngineEventName> = Object.freeze(
  new Set<EngineEventName>([
    EngineEvent.ENGINE_CHANGE,
    EngineEvent.PARAM_CHANGE,
    EngineEvent.EXPAND_REQUESTED,
    EngineEvent.INTERACTION_START,
    EngineEvent.INTERACTION_END,
  ]),
)

/**
 * Type guard: returns true if `name` is a canonical engine event name.
 *
 * Useful у linters / dev warnings — adapter authors can assert що their
 * emit names match the catalog.
 *
 *   if (!isCanonicalEngineEvent(name)) {
 *     console.warn(`Non-canonical event '${name}'. Use EngineEvent.* constants.`)
 *   }
 */
export function isCanonicalEngineEvent(name: string): name is EngineEventName {
  return CANONICAL_ENGINE_EVENTS.has(name as EngineEventName)
}
