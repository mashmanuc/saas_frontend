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
  /**
   * 3D camera state (rotation + zoom). Persisted so replay viewers see the SAME
   * orientation the recording author had — otherwise board-level pen strokes (drawn
   * on top of NMT3D in 2D screen coords) appear "shifted" / misaligned with the 3D
   * shape after replay loads it at vendor default cam (yaw:-0.5, pitch:0.28).
   *
   * Emitted on pointerup after orbit/pan/slider (one emit per interaction end —
   * RAF batcher coalesces with concurrent params/opts emits).
   */
  cam?: {
    yaw: number
    pitch: number
    scale: number
  }
}

export interface Nmt3dDragPayload {
  templateKey: string
}

export interface Nmt3dAsset extends WBAsset {
  type: 'nmt3d'
  data: Nmt3dData
}
