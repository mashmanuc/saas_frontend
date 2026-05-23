/**
 * EOR Identity — public API barrel.
 *
 * P1.c: pure functions only. NO runtime singleton, NO global state
 * (except the runtime_id counter — module-scoped, per-page-load).
 *
 * Strict boundary between:
 *   - normalize.ts   = pure persisted canonicalization
 *   - clone.ts       = derivation (lineage append)
 *   - legacy.ts      = legacy detection (simple field check)
 *   - runtime.ts     = ephemeral runtime_id attach (mount-time ONLY)
 */

export { normalizeIdentity } from './normalize'
export { cloneIdentity } from './clone'
export { isLegacyIdentity } from './legacy'
export {
  generateRuntimeId,
  attachRuntimeIdentity,
  stripRuntimeIdentity,
  _resetRuntimeIdCounter,
} from './runtime'
