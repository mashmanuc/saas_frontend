/**
 * SnapshotPolicyImpl — typed configuration envelope.
 *
 * SSOT §4.1. **NOT a policy runner** — just immutable metadata.
 *
 * Per colleague review P1.e — STRICT BOUNDARY:
 *
 *   ALLOWED:
 *     - validated configuration (debounce_ms invariants)
 *     - immutable fields (Object.freeze)
 *     - identity / equality semantics
 *
 *   FORBIDDEN:
 *     - setTimeout / setInterval / scheduling
 *     - flush queue / buffering
 *     - debounce execution
 *     - event listeners
 *     - dispatch wiring
 *
 * Execution semantics do NOT exist yet. This class only describes
 * "this EO type uses Snapshot strategy with 150ms debounce" — that's all.
 */

import type { SnapshotPolicy } from '../types/transport'

/**
 * Minimum debounce per TR-INV-2 у SSOT §4.3.
 * Sub-100ms is `ThrottledParamPolicy` territory.
 */
export const MIN_SNAPSHOT_DEBOUNCE_MS = 100

/**
 * Reasonable upper bound — debounce >10s would lose user input on session end.
 */
export const MAX_SNAPSHOT_DEBOUNCE_MS = 10_000

export class SnapshotPolicyImpl implements SnapshotPolicy {
  readonly kind: 'SnapshotPolicy' = 'SnapshotPolicy'
  readonly debounce_ms: number

  constructor(config: { debounce_ms: number }) {
    if (
      typeof config.debounce_ms !== 'number' ||
      !Number.isFinite(config.debounce_ms)
    ) {
      throw new TypeError(
        `SnapshotPolicy.debounce_ms must be a finite number, got: ${config.debounce_ms}`,
      )
    }
    if (config.debounce_ms < MIN_SNAPSHOT_DEBOUNCE_MS) {
      throw new RangeError(
        `SnapshotPolicy.debounce_ms must be >= ${MIN_SNAPSHOT_DEBOUNCE_MS}ms ` +
          `(TR-INV-2). Got: ${config.debounce_ms}. Use ThrottledParamPolicy for sub-100ms.`,
      )
    }
    if (config.debounce_ms > MAX_SNAPSHOT_DEBOUNCE_MS) {
      throw new RangeError(
        `SnapshotPolicy.debounce_ms must be <= ${MAX_SNAPSHOT_DEBOUNCE_MS}ms ` +
          `(reasonable upper bound). Got: ${config.debounce_ms}.`,
      )
    }
    this.debounce_ms = config.debounce_ms
    Object.freeze(this)
  }
}
