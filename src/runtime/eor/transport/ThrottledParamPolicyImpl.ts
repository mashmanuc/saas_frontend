/**
 * ThrottledParamPolicyImpl — typed configuration envelope.
 *
 * SSOT §4.1. **NOT a policy runner** — just immutable metadata з validation.
 *
 * Per colleague review P1.e — STRICT BOUNDARY: zero execution path.
 * No requestAnimationFrame, no throttle implementation, no race-guard
 * enforcement. Only metadata describing "this EO uses throttled strategy
 * at rate N for these params with race_guard X".
 *
 * Execution wiring lives у P2+ (when first widget migrates через shadow).
 */

import type { ThrottledParamPolicy } from '../types/transport'

/**
 * Minimum throttle rate — sub-1ms is impractical (browser tick).
 */
export const MIN_THROTTLE_RATE_MS = 1

/**
 * Reasonable upper bound — above this, use SnapshotPolicy instead.
 */
export const MAX_THROTTLE_RATE_MS = 99

export class ThrottledParamPolicyImpl implements ThrottledParamPolicy {
  readonly kind: 'ThrottledParamPolicy' = 'ThrottledParamPolicy'
  readonly rate_ms: number
  readonly params: readonly string[]
  readonly race_guard: string

  constructor(config: {
    rate_ms: number
    params: readonly string[]
    race_guard: string
  }) {
    // rate_ms validation
    if (
      typeof config.rate_ms !== 'number' ||
      !Number.isFinite(config.rate_ms)
    ) {
      throw new TypeError(
        `ThrottledParamPolicy.rate_ms must be a finite number, got: ${config.rate_ms}`,
      )
    }
    if (config.rate_ms < MIN_THROTTLE_RATE_MS) {
      throw new RangeError(
        `ThrottledParamPolicy.rate_ms must be >= ${MIN_THROTTLE_RATE_MS}ms. ` +
          `Got: ${config.rate_ms}.`,
      )
    }
    if (config.rate_ms > MAX_THROTTLE_RATE_MS) {
      throw new RangeError(
        `ThrottledParamPolicy.rate_ms must be <= ${MAX_THROTTLE_RATE_MS}ms ` +
          `(use SnapshotPolicy for larger debounce). Got: ${config.rate_ms}.`,
      )
    }

    // params validation
    if (!Array.isArray(config.params) || config.params.length === 0) {
      throw new TypeError(
        `ThrottledParamPolicy.params must be a non-empty string array. ` +
          `Got: ${JSON.stringify(config.params)}`,
      )
    }
    for (const p of config.params) {
      if (typeof p !== 'string' || p.length === 0) {
        throw new TypeError(
          `ThrottledParamPolicy.params items must be non-empty strings. ` +
            `Got: ${JSON.stringify(p)}`,
        )
      }
    }

    // race_guard validation — required per TR-INV-3
    if (
      typeof config.race_guard !== 'string' ||
      config.race_guard.length === 0
    ) {
      throw new TypeError(
        `ThrottledParamPolicy.race_guard must be a non-empty string ` +
          `(TR-INV-3). Got: ${JSON.stringify(config.race_guard)}`,
      )
    }

    this.rate_ms = config.rate_ms
    // Deep-freeze params array — lineage immutability for routing decisions
    this.params = Object.freeze([...config.params])
    this.race_guard = config.race_guard
    Object.freeze(this)
  }
}
