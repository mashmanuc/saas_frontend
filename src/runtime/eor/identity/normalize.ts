/**
 * normalizeIdentity — pure deterministic canonicalization of EO identity.
 *
 * SSOT §2.5 (Identity Migration Safety) — ID-MIG-INV-1..6.
 *
 * **CRITICAL CONSTRAINTS** (per colleague review P1.c):
 *
 *   ALLOWED:
 *     template_id ??= `${type}@1`
 *     origin_id ??= null
 *     derived_chain ??= []
 *     canonical_id ??= null
 *
 *   FORBIDDEN:
 *     - heuristics ("guessing" template from name patterns)
 *     - cross-object lookup (asking DB / registry / other EOs)
 *     - stateful normalization (any module-level mutable state)
 *     - DB-derived assumptions
 *     - runtime_id generation (lives у `runtime.ts` instead)
 *
 * INVARIANTS:
 *   1. Pure: same input → same output. No side effects.
 *   2. Deterministic: no randomness, no clock reads, no I/O.
 *   3. Idempotent: normalizeIdentity(normalizeIdentity(x)) === normalizeIdentity(x).
 *   4. Persisted-only: result contains NO runtime_id (that's MountedEOIdentity).
 */

import type {
  EOIdentity,
  NormalizedEOIdentity,
} from '../types/identity'

/**
 * Canonicalize identity fields. Pure function — no I/O, no state, no
 * runtime_id generation.
 *
 * @param raw - raw identity from board_state.assets[]. Only `instance_id` required.
 * @param typeFallback - EO type discriminator (e.g., 'helix') used to build
 *                       default `template_id` when missing. From `asset.type`.
 * @returns NormalizedEOIdentity with all persisted fields filled by `??` defaults.
 */
export function normalizeIdentity(
  raw: EOIdentity,
  typeFallback: string,
): NormalizedEOIdentity {
  return {
    instance_id: raw.instance_id,
    template_id: raw.template_id ?? `${typeFallback}@1`,
    origin_id: raw.origin_id ?? null,
    // Freeze derived_chain — per colleague: lineage MUST be immutable.
    derived_chain: Object.freeze(
      raw.derived_chain ? Array.from(raw.derived_chain) : [],
    ),
    canonical_id: raw.canonical_id ?? null,
  }
}
