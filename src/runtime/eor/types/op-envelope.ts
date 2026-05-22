/**
 * Op envelope — uniform shape across all transport policies.
 *
 * SSOT §4.3. All ops emitted by EO Runtime go through this envelope.
 *
 * STATUS: P1.a — type declarations only.
 */

/**
 * Op types (tagged union).
 *
 * Per TR-INV-7, `graph_param_set` renamed to `eo_param_set` (generic).
 * BE accepts both during transition (1 release).
 *
 * New EO types DO NOT add new op_type values у P1 — use existing `asset_update`
 * for snapshot-based transport, `eo_param_set` for high-freq.
 */
export type EOpType = 'asset_update' | 'eo_param_set'

/**
 * Single op envelope passed between FE transport dispatcher and BE op log.
 */
export interface EOpEnvelope {
  readonly op_type: EOpType
  readonly instance_id: string      // see EOIdentity.instance_id
  readonly payload: unknown         // policy-specific shape (see transport.ts)

  // For race-guarded policies (ThrottledParamPolicy)
  readonly base_seq?: number

  // Client timestamp — advisory only, NOT authoritative for ordering (LAW §3)
  readonly client_ts?: number
}
