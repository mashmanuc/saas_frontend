/**
 * Capabilities — composable feature opt-in for Educational Objects.
 *
 * SSOT §7. Capabilities are additive-only; conflict resolution per CAP-INV-4.
 *
 * STATUS: P1.a — type declarations only.
 */

/**
 * Catalog of declared capabilities. New capabilities require SSOT amendment
 * (CAP-INV-3).
 */
export type Capability =
  | 'Expandable'           // fullscreen overlay
  | 'Inspector'            // contextual sidebar
  | 'HighFreqParam'        // ThrottledParamPolicy for some params
  | 'AnimationPersisted'   // animation state persists across replay/reload
  | '3DCamera'             // orbit/zoom camera (state always ephemeral)
  | 'ReplayPlayback'       // EO participates у replay (default for stateful EOs)

/**
 * Capability set type — immutable readonly-ness enforced by runtime.
 */
export type CapabilitySet = ReadonlySet<Capability>
