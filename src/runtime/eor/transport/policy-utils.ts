/**
 * Policy utilities — pure helpers for equality and serialization.
 *
 * SSOT §4. Used by:
 *   - registry caching (future)
 *   - shadow validator parity comparison (P1.f)
 *   - debugging / logging
 *
 * All functions are PURE — no side effects, no mutation, deterministic.
 *
 * Per colleague review P1.e: serialize must be STABLE (same policy →
 * same serialized string, regardless of object identity or property
 * ordering).
 */

import type {
  TransportPolicy,
  TransportPolicyKind,
  SnapshotPolicy,
  ThrottledParamPolicy,
  DirectCallbackPolicy,
} from '../types/transport'

const KNOWN_POLICY_KINDS: ReadonlySet<TransportPolicyKind> = new Set([
  'SnapshotPolicy',
  'ThrottledParamPolicy',
  'DirectCallbackPolicy',
])

/**
 * Validate that a value has a recognized policy `kind` discriminator.
 *
 * Throws on unknown kind. Future-safety: rejects accidentally-imported
 * external "policies" з incompatible shape.
 */
export function assertKnownPolicyKind(
  policy: { kind?: unknown },
): asserts policy is TransportPolicy {
  if (typeof policy.kind !== 'string') {
    throw new TypeError(
      `Policy.kind must be a string. Got: ${JSON.stringify(policy.kind)}`,
    )
  }
  if (!KNOWN_POLICY_KINDS.has(policy.kind as TransportPolicyKind)) {
    throw new TypeError(
      `Unknown policy kind: '${policy.kind}'. ` +
        `Known kinds: ${Array.from(KNOWN_POLICY_KINDS).join(', ')}.`,
    )
  }
}

/**
 * Serialize policy to stable canonical string.
 *
 * Stability invariant: `serializePolicy(p1) === serializePolicy(p2)` iff
 * `p1` and `p2` are policy-equal.
 *
 * Used for future shadow parity (P1.f) — comparing emitted-op transport
 * configuration between legacy and EOR-Runtime paths.
 */
export function serializePolicy(policy: TransportPolicy): string {
  assertKnownPolicyKind(policy)
  switch (policy.kind) {
    case 'SnapshotPolicy': {
      const p = policy as SnapshotPolicy
      return JSON.stringify({
        kind: 'SnapshotPolicy',
        debounce_ms: p.debounce_ms,
      })
    }
    case 'ThrottledParamPolicy': {
      const p = policy as ThrottledParamPolicy
      // Sort params for stable output regardless of input order
      const params = [...p.params].sort()
      return JSON.stringify({
        kind: 'ThrottledParamPolicy',
        rate_ms: p.rate_ms,
        params,
        race_guard: p.race_guard,
      })
    }
    case 'DirectCallbackPolicy': {
      const _p = policy as DirectCallbackPolicy
      void _p
      return JSON.stringify({ kind: 'DirectCallbackPolicy' })
    }
  }
}

/**
 * Equality check — two policies are equal iff their serialized form matches.
 *
 * Reflexive, symmetric, transitive (delegates to JSON string equality).
 */
export function policyEquals(
  a: TransportPolicy,
  b: TransportPolicy,
): boolean {
  return serializePolicy(a) === serializePolicy(b)
}
