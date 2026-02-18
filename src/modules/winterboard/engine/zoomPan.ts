// WB: Zoom/Pan utilities — snap levels, zoom-to-cursor, fit-to-page
// Ref: TASK_BOARD.md A5.3, ManifestWinterboard_v2.md LAW-20

// ─── Constants ──────────────────────────────────────────────────────────────

/** Predefined zoom snap levels */
export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0] as const

/** Min/max zoom bounds */
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 5.0

/** Zoom step for Ctrl+scroll (before snapping) */
export const ZOOM_WHEEL_STEP = 0.05

/** Smooth zoom lerp duration (ms) */
export const ZOOM_LERP_DURATION_MS = 150

// ─── Snap to nearest level ──────────────────────────────────────────────────

/**
 * Snap a zoom value to the nearest predefined level.
 * Only snaps if within 5% of a level; otherwise returns raw value clamped.
 */
export function snapZoom(raw: number): number {
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, raw))

  for (const level of ZOOM_LEVELS) {
    if (Math.abs(clamped - level) < 0.03) {
      return level
    }
  }

  return Math.round(clamped * 100) / 100
}

/**
 * Get next zoom level up from current.
 */
export function zoomLevelUp(current: number): number {
  for (const level of ZOOM_LEVELS) {
    if (level > current + 0.01) return level
  }
  return ZOOM_MAX
}

/**
 * Get next zoom level down from current.
 */
export function zoomLevelDown(current: number): number {
  for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) {
    if (ZOOM_LEVELS[i] < current - 0.01) return ZOOM_LEVELS[i]
  }
  return ZOOM_MIN
}

// ─── Zoom to cursor position ────────────────────────────────────────────────

/**
 * Calculate new scroll position after zooming to keep the cursor position stable.
 *
 * @param cursorX - Cursor X in container (screen) coordinates
 * @param cursorY - Cursor Y in container (screen) coordinates
 * @param scrollX - Current scroll X
 * @param scrollY - Current scroll Y
 * @param oldZoom - Zoom before change
 * @param newZoom - Zoom after change
 * @returns New scroll position { scrollX, scrollY }
 */
export function zoomToCursor(
  cursorX: number,
  cursorY: number,
  scrollX: number,
  scrollY: number,
  oldZoom: number,
  newZoom: number,
): { scrollX: number; scrollY: number } {
  // Point in canvas coordinates under cursor before zoom
  const canvasX = (scrollX + cursorX) / oldZoom
  const canvasY = (scrollY + cursorY) / oldZoom

  // After zoom, that same canvas point should still be under cursor
  const newScrollX = canvasX * newZoom - cursorX
  const newScrollY = canvasY * newZoom - cursorY

  return {
    scrollX: Math.max(0, newScrollX),
    scrollY: Math.max(0, newScrollY),
  }
}

// ─── Fit to page ────────────────────────────────────────────────────────────

/**
 * Calculate zoom level to fit the entire page within the container.
 *
 * @param pageWidth - Page width in canvas units
 * @param pageHeight - Page height in canvas units
 * @param containerWidth - Container width in pixels
 * @param containerHeight - Container height in pixels
 * @param padding - Padding in pixels around the page (default: 40)
 * @returns Zoom level that fits the page
 */
export function fitToPage(
  pageWidth: number,
  pageHeight: number,
  containerWidth: number,
  containerHeight: number,
  padding = 40,
): number {
  const availW = Math.max(1, containerWidth - padding * 2)
  const availH = Math.max(1, containerHeight - padding * 2)

  const scaleX = availW / pageWidth
  const scaleY = availH / pageHeight

  const zoom = Math.min(scaleX, scaleY)
  return snapZoom(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom)))
}

// ─── Pinch distance ─────────────────────────────────────────────────────────

/**
 * Calculate distance between two touch points.
 */
export function pinchDistance(touch1: Touch, touch2: Touch): number {
  const dx = touch1.clientX - touch2.clientX
  const dy = touch1.clientY - touch2.clientY
  return Math.sqrt(dx * dx + dy * dy)
}

/**
 * Calculate center point between two touches.
 */
export function pinchCenter(touch1: Touch, touch2: Touch): { x: number; y: number } {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  }
}
