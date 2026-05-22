/**
 * Semantic surfaces — framework-agnostic render target abstraction.
 *
 * SSOT §9.4. Render target declared as semantic intent, NOT framework
 * (no `konva_node` / `webgl_canvas` — those leak presentation concern).
 *
 * Integration layer (Vue+Konva, React+three.js, etc.) translates semantic
 * surface to actual render node.
 *
 * STATUS: P1.a — type declarations only.
 */

/**
 * Semantic surface — what kind of rendering target the EO needs.
 *
 * - `2d-overlay`: HTML overlay positioned above Konva canvas
 *   (e.g., TrigCircle, Helix card chrome).
 * - `3d-surface`: 3D scene (orbit camera, perspective projection)
 *   — integration layer chooses three.js / Babylon / etc.
 * - `native-canvas`: raw canvas access (low-level drawing, no framework)
 *   — reserved for future raw-canvas widgets.
 */
export type Surface = '2d-overlay' | '3d-surface' | 'native-canvas'

/**
 * Render mode — context for adapter to produce different descriptors.
 *
 * - `edit`: live editing у tutor's session
 * - `replay`: read-only playback (animations disabled, etc.)
 * - `preview`: thumbnail / lesson catalog preview
 * - `export`: PDF/PPTX generation (no interactivity)
 */
export type RenderMode = 'edit' | 'replay' | 'preview' | 'export'

/**
 * Render descriptor — what the EO needs to render.
 *
 * Returned by `RenderAdapter.getRenderDescriptor()`. Integration layer
 * reads `surface` + `bounds` and creates the actual render node.
 */
export interface RenderDescriptor {
  readonly surface: Surface
  readonly bounds: {
    readonly x: number
    readonly y: number
    readonly w: number
    readonly h: number
  }
  readonly rotation: number          // radians or degrees, integration-defined
  readonly zHint: 'below_strokes' | 'above_strokes'
}
