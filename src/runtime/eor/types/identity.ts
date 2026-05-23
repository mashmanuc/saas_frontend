/**
 * Educational Object Identity Model — type definitions.
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md §2
 *
 * Per ID-MIG-INV-1..6 — all fields except `instance_id` are OPTIONAL у P1.
 * Existing assets без identity fields MUST auto-normalize at read-time.
 *
 * STATUS: P1.a + P1.c refactor — type declarations only. NO runtime code.
 *
 * **Boundary separation (refined у P1.c per colleague feedback):**
 *
 *   EOIdentity              = raw input from persisted board_state.assets[]
 *                             All fields optional except instance_id.
 *
 *   NormalizedEOIdentity    = pure deterministic canonicalization
 *                             (PERSISTED shape only — NO runtime_id).
 *                             Produced by normalizeIdentity().
 *
 *   MountedEOIdentity       = runtime-attached shape with runtime_id.
 *                             Produced by attachRuntimeIdentity() at mount-time.
 *                             Ephemeral — NEVER persisted.
 *
 * This separation prevents:
 *   - normalize(normalize(x)) idempotency violations (runtime_id randomness)
 *   - shadow parity failures from runtime-state leaking into persisted shape
 *   - test flakiness from non-deterministic normalize
 */

/**
 * EOIdentity — raw input identity (from persisted board_state).
 *
 * Per ID-MIG-INV-1..2: only `instance_id` required; all others optional
 * and auto-normalized at read-time. No `runtime_id` here — it's a
 * runtime-layer concept (see MountedEOIdentity).
 */
export interface EOIdentity {
  readonly instance_id: string

  // Optional — auto-normalized at read-time per ID-MIG-INV-2
  readonly template_id?: string
  readonly origin_id?: string | null
  readonly derived_chain?: readonly string[]
  readonly canonical_id?: string | null
}

/**
 * NormalizedEOIdentity — pure persisted shape after canonicalization.
 *
 * Produced by `normalizeIdentity()` (P1.c). All persisted optional fields
 * filled with sensible defaults via simple `??` rules.
 *
 * INVARIANT (P1.c): normalize is pure deterministic — no `runtime_id`,
 * no randomness, no cross-object lookup, no DB assumptions.
 *
 * INVARIANT: `normalize(normalize(x))` === `normalize(x)` (idempotent).
 */
export interface NormalizedEOIdentity {
  readonly instance_id: string
  readonly template_id: string                // e.g., 'trig_circle@1'
  readonly origin_id: string | null
  readonly derived_chain: readonly string[]
  readonly canonical_id: string | null
}

/**
 * MountedEOIdentity — runtime-attached identity with ephemeral runtime_id.
 *
 * Produced by `attachRuntimeIdentity()` at mount-time (P1.c). The
 * `runtime_id` is regenerated on each mount; NEVER persisted.
 *
 * INVARIANT (EPH-INV / ID-MIG-INV-5): runtime_id is ephemeral. Stripping
 * MountedEOIdentity → NormalizedEOIdentity is trivial (remove runtime_id).
 */
export interface MountedEOIdentity extends NormalizedEOIdentity {
  readonly runtime_id: number
}
