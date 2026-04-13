/**
 * Page boundary shadow — Konva shadow config for the white page rect.
 * Makes page edges visible against the canvas area background.
 *
 * Defined centrally so it's consistent across all views (solo, classroom, public).
 * CSS-variable --wb-page-shadow handles CSS-level shadows (e.g. thumbnails).
 * This config is for the Konva <v-rect> background node.
 */
export const PAGE_SHADOW = {
  shadowColor: '#000000',
  shadowBlur: 12,
  shadowOffset: { x: 0, y: 2 },
  shadowOpacity: 0.12,
} as const
