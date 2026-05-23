/**
 * Snapshot normalization for replay parity comparison.
 *
 * Per colleague review P1.5.a:
 *   Replay comparator must NOT compare raw snapshots — runtime_id,
 *   ephemeral UI fields, animation state can cause false mismatches.
 *
 * Pipeline:
 *   snapshot
 *     → drop ephemeral keys (recursive)
 *     → strip runtime_id (recursive)
 *     → return canonicalized tree (object keys sorted at serialize time)
 *
 * STATUS: P1.5.a — pure function, isolated. Zero runtime activation.
 *
 * SSOT: saas_docs/domains/winterboard/EDUCATIONAL_OBJECT_RUNTIME_SSOT.md §11
 *       (Ephemeral State Rules — explicit list of NEVER-persisted fields).
 */

/**
 * Default ephemeral keys — fields excluded from replay parity comparison.
 *
 * Derived from SSOT §11.1 (Ephemeral-by-rule table). These fields can
 * legitimately differ between legacy and EOD outputs without indicating
 * a real divergence у persisted state.
 *
 * NOT exhaustive — callers may extend via `extraEphemeralKeys` option
 * for widget-specific ephemeral fields (e.g., `tabFocus`, `lastHoverAt`).
 */
export const DEFAULT_EPHEMERAL_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    // Animation playback (per SSOT §11.1; opt-out via AnimationPersisted capability)
    'animating',
    'currentFrame',
    'playbackSpeed',

    // Tool mode (UI, not content)
    'drawMode',

    // Selection / hover (per-user UI state)
    'selectedAnchor',
    'hoveredHandle',
    'selectedIds',

    // Loading flags (internal sync mechanism)
    'isApplyingExternalState',
    'isLoading',

    // Identity runtime handle (per EPH-INV / ID-MIG-INV-5)
    'runtime_id',
  ]),
)

export interface NormalizeOptions {
  /**
   * Additional ephemeral keys beyond DEFAULT_EPHEMERAL_KEYS. Useful for
   * widget-specific ephemeral fields (e.g., NMT3D camera orbit angle).
   *
   * Merged with defaults — adding does NOT replace.
   */
  readonly extraEphemeralKeys?: readonly string[]

  /**
   * Override default ephemeral set entirely. Use cautiously — most
   * callers should use `extraEphemeralKeys` instead.
   */
  readonly ephemeralKeys?: ReadonlySet<string>
}

/**
 * Recursively normalize a snapshot value, dropping ephemeral keys at
 * any nesting level. Returns a new structure — input is NOT mutated.
 *
 * Pure function. Deterministic. Same input → same output.
 *
 * Note: arrays are processed elementwise but NOT reordered. Arrays у
 * board_state (pages[], strokes[], assets[]) are semantically ordered
 * — reordering would lose ordering invariants.
 */
export function normalizeForReplayParity(
  value: unknown,
  options: NormalizeOptions = {},
): unknown {
  const ephemeralKeys =
    options.ephemeralKeys ??
    (options.extraEphemeralKeys && options.extraEphemeralKeys.length > 0
      ? new Set<string>([
          ...DEFAULT_EPHEMERAL_KEYS,
          ...options.extraEphemeralKeys,
        ])
      : DEFAULT_EPHEMERAL_KEYS)

  return _walk(value, ephemeralKeys)
}

function _walk(value: unknown, ephemeralKeys: ReadonlySet<string>): unknown {
  if (value === null || value === undefined) return value
  if (typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => _walk(item, ephemeralKeys))
  }
  // Plain object — drop ephemeral keys, recurse into non-ephemeral
  const obj = value as Record<string, unknown>
  const result: Record<string, unknown> = {}
  for (const key of Object.keys(obj)) {
    if (ephemeralKeys.has(key)) continue
    result[key] = _walk(obj[key], ephemeralKeys)
  }
  return result
}
