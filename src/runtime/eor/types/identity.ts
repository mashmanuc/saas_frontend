/**
 * Educational Object Identity Model — type definitions.
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md §2
 *
 * Per ID-MIG-INV-1..6 — all fields except `instance_id` are OPTIONAL у P1.
 * Existing assets без identity fields MUST auto-normalize at read-time.
 *
 * STATUS: P1.a — type declarations only. NO runtime code. NO singleton wiring.
 */

/**
 * Identity fields for an Educational Object instance.
 *
 * Field semantics (SSOT §2.1):
 * - `instance_id` — required, unique per occurrence (UUID v4)
 * - `template_id` — optional, format `<type>@<version>` (e.g., 'helix@1')
 * - `origin_id` — optional, instance_id of EO this was derived from (clone/fork)
 * - `derived_chain` — append-only lineage list
 * - `canonical_id` — cross-session stable id (marketplace, generated, AI)
 * - `runtime_id` — local-only handle (NOT persisted; regenerated per mount)
 */
export interface EOIdentity {
  // Required
  readonly instance_id: string

  // Optional — auto-normalized at read-time per ID-MIG-INV-2
  readonly template_id?: string
  readonly origin_id?: string | null
  readonly derived_chain?: readonly string[]
  readonly canonical_id?: string | null

  // Ephemeral — never persisted (EPH-INV / ID-MIG-INV-5)
  readonly runtime_id?: number
}

/**
 * Normalized identity — all optional fields filled with sensible defaults.
 *
 * Produced by `normalizeIdentity()` (P1.c). All consumers MUST read through
 * normalization to handle legacy assets without identity fields.
 */
export interface NormalizedEOIdentity {
  readonly instance_id: string
  readonly template_id: string                // e.g., 'trig_circle@1'
  readonly origin_id: string | null
  readonly derived_chain: readonly string[]
  readonly canonical_id: string | null
  readonly runtime_id: number
}
