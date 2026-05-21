/**
 * NMT3D — types for parametric 3D stereometry widget.
 *
 * Asset type: 'nmt3d'
 * MIME: 'application/x-nmt3d'
 *
 * 21 templates from nmt-3d-bundle: cube, prism, pyramid, cylinder, cone, sphere + combos.
 * Two modes:
 *   'adapt' — 3D orbit + drag handles (parametric; shape stays natural)
 *   'draw'  — shape frozen, pen layer for writing over it
 *
 * Persistent state: templateKey + mode + params + opts.
 * Camera angles, drawn strokes — ephemeral (reset on reopen).
 */

import type { WBAsset } from './winterboard'

export interface Nmt3dData {
  version: 1
  /** Key of the NMT3D template (e.g. 'cube', 'prism4', 'cone') */
  templateKey: string
  /** 'adapt' = parametric + orbit; 'draw' = frozen + pen layer */
  mode: 'adapt' | 'draw'
  /** Current parameter values (a, b, h, …). Persisted so shape is restored on reopen. */
  params?: Record<string, number>
  /** Current aux construction toggles. Persisted. */
  opts?: Record<string, boolean>
}

export interface Nmt3dDragPayload {
  templateKey: string
}

export interface Nmt3dAsset extends WBAsset {
  type: 'nmt3d'
  data: Nmt3dData
}
