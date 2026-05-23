/**
 * DirectCallbackPolicyImpl — typed configuration envelope.
 *
 * @deprecated  ⚠️ DEPRECATED per TR-INV-4 у SSOT §4.1.
 * @dangerous   No race protection, synchronous emit — can race with
 *              other ops у adapter pipeline.
 * @non-deterministic-risk
 *              Direct synchronous callbacks during recording may interfere
 *              with replay determinism (REPL-INV-1) if engine internal
 *              event timing varies across runs.
 *
 * **DO NOT USE FOR NEW EODs.** Existing usage (NMT3D `ws.onParamsChanged`,
 * see git log commits referencing nmt3d-direct-callback) migrates to
 * `ThrottledParamPolicy(rate_ms=16)` у Phase P6.
 *
 * Kept у the type system solely для:
 *   - documenting historical decision у SSOT
 *   - shadow validator compatibility (P1.f) when comparing legacy ops
 *
 * Per colleague review P1.e — even у `@deprecated` form, this class
 * stays metadata-only (zero execution path). It does NOT actually emit
 * any callbacks. Real callback wiring lives elsewhere (and is being
 * migrated away).
 */

import type { DirectCallbackPolicy } from '../types/transport'

/**
 * @deprecated  Use ThrottledParamPolicy(rate_ms=16) instead.
 * @dangerous   Race-sensitive, replay-sensitive, sync-sensitive.
 */
export class DirectCallbackPolicyImpl implements DirectCallbackPolicy {
  readonly kind: 'DirectCallbackPolicy' = 'DirectCallbackPolicy'

  constructor() {
    Object.freeze(this)
  }
}
