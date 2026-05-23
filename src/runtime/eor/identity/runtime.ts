/**
 * Runtime identity attachment — generates ephemeral runtime_id at mount-time.
 *
 * **STRICT BOUNDARY** (per colleague review P1.c):
 *
 *   This module is the ONLY place runtime_id is generated. Persisted
 *   normalization (normalize.ts) MUST NOT call this — keeps normalize()
 *   pure and idempotent.
 *
 *   runtime_id semantics (SSOT §11.1 ephemeral / ID-MIG-INV-5):
 *     - regenerated on each mount
 *     - NEVER persisted to board_state / WBSession.state / S3
 *     - mount-scoped lifetime
 *     - used by adapter's internal cache, event routing tag
 *
 * INVARIANT: stripping MountedEOIdentity → NormalizedEOIdentity is a
 * trivial spread that drops runtime_id (see `stripRuntime` helper).
 */

import type {
  NormalizedEOIdentity,
  MountedEOIdentity,
} from '../types/identity'

/**
 * Module-scoped monotonic counter. Per-page-load.
 *
 * NOT persisted, NOT shared across tabs. Each tab/window gets its own
 * sequence starting from 1. This is fine — runtime_id is purely a local
 * handle used by adapter internals, never compared cross-process.
 */
let _runtimeIdCounter = 0

/**
 * Generate next ephemeral runtime_id. Monotonic per page-load.
 *
 * Exported separately for tests and for callers that need a runtime_id
 * outside of attachRuntimeIdentity() (rare).
 */
export function generateRuntimeId(): number {
  return ++_runtimeIdCounter
}

/**
 * **TESTING ONLY** — reset counter to 0. Production code MUST NOT call this.
 * Exposed so test suites can have deterministic runtime_id sequences.
 */
export function _resetRuntimeIdCounter(): void {
  _runtimeIdCounter = 0
}

/**
 * Attach a fresh runtime_id to a normalized (persisted) identity.
 *
 * Called by EO Runtime when mounting an EO. The returned MountedEOIdentity
 * is passed to RuntimeAdapter.mount() via AdapterHostContext.
 */
export function attachRuntimeIdentity(
  persisted: NormalizedEOIdentity,
): MountedEOIdentity {
  return {
    ...persisted,
    runtime_id: generateRuntimeId(),
  }
}

/**
 * Strip runtime_id from a mounted identity.
 *
 * Useful for shadow parity (P1.f) and for serialization paths that need
 * to round-trip MountedEOIdentity → NormalizedEOIdentity (persisted shape).
 */
export function stripRuntimeIdentity(
  mounted: MountedEOIdentity,
): NormalizedEOIdentity {
  // Destructure to drop runtime_id; rest is persisted shape.
  // Cast through unknown to satisfy strict types without exposing internals.
  const { runtime_id: _runtime_id, ...persisted } = mounted
  void _runtime_id
  return persisted
}
