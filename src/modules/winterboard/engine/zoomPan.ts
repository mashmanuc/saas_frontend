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

/**
 * Обчислити zoom, щоб вписати ШИРИНУ аркуша у ширину контейнера.
 *
 * На вузьких (мобільних) екранах фіксований 1920px-аркуш ширший за viewport →
 * контент обрізається праворуч. Фіт по ширині вписує аркуш точно у ширину
 * контейнера, а вертикаль лишається під скрол. Без padding — щоб аркуш
 * заповнив ширину впритул (scaledPageWidth === containerWidth → offset X = 0,
 * без горизонтального overflow). Не snap-имо (точний фіт, не «зручний» рівень).
 *
 * @param pageWidth - Page width in canvas units (напр. 1920)
 * @param containerWidth - Container width in pixels
 * @returns Zoom level, що вписує ширину аркуша (clamped у [ZOOM_MIN, ZOOM_MAX])
 */
export function fitToWidth(pageWidth: number, containerWidth: number): number {
  if (pageWidth <= 0 || containerWidth <= 0) return 1
  const zoom = containerWidth / pageWidth
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom))
}

// ─── Responsive Phase 2 A4: Snap-to-fit + Bounce-back + Double-tap ──────────

/** Snap threshold: if zoom is within ±5% of a snap level, snap to it */
const SNAP_TOLERANCE = 0.05

/**
 * Calculate snap zoom after pinch-zoom ends.
 * Snaps to nearest "comfortable" level: fit-width, fit-page, 100%, or 200%.
 * Only snaps if within SNAP_TOLERANCE of a snap target.
 *
 * @returns snapped zoom or currentZoom if no snap applies
 */
export function calculateSnapZoom(
  currentZoom: number,
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return currentZoom
  if (pageWidth <= 0 || pageHeight <= 0) return currentZoom

  const fitWidth = containerWidth / pageWidth
  const fitPage = Math.min(containerWidth / pageWidth, containerHeight / pageHeight)

  // Snap targets: fit-page, fit-width, 100%, 200%
  const snapTargets = [fitPage, fitWidth, 1.0, 2.0].filter(
    (t) => t >= ZOOM_MIN && t <= ZOOM_MAX,
  )

  for (const target of snapTargets) {
    if (Math.abs(currentZoom - target) <= SNAP_TOLERANCE * target) {
      return target
    }
  }

  return currentZoom
}

/**
 * Calculate bounce-back offset when pan goes out of bounds.
 * Returns the corrected scroll position, or null if no bounce needed.
 *
 * @returns { x, y } corrected scroll, or null if within bounds
 */
export function calculateBounceBack(
  scrollX: number,
  scrollY: number,
  zoom: number,
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
): { x: number; y: number } | null {
  const scaledW = pageWidth * zoom
  const scaledH = pageHeight * zoom

  // Max scroll = scaled page size - container (can't scroll past edge)
  // Min scroll = 0 (or negative if page is smaller than container → center)
  let targetX = scrollX
  let targetY = scrollY
  let bounced = false

  if (scaledW <= containerWidth) {
    // Page fits horizontally → no horizontal scroll allowed
    if (scrollX !== 0) {
      targetX = 0
      bounced = true
    }
  } else {
    const maxScrollX = scaledW - containerWidth
    if (scrollX < 0) {
      targetX = 0
      bounced = true
    } else if (scrollX > maxScrollX) {
      targetX = maxScrollX
      bounced = true
    }
  }

  if (scaledH <= containerHeight) {
    if (scrollY !== 0) {
      targetY = 0
      bounced = true
    }
  } else {
    const maxScrollY = scaledH - containerHeight
    if (scrollY < 0) {
      targetY = 0
      bounced = true
    } else if (scrollY > maxScrollY) {
      targetY = maxScrollY
      bounced = true
    }
  }

  return bounced ? { x: targetX, y: targetY } : null
}

/**
 * Double-tap zoom cycle: fit-page → 100% → 200% → fit-page.
 *
 * @returns next zoom level in the cycle
 */
export function doubleTapZoomCycle(
  currentZoom: number,
  containerWidth: number,
  containerHeight: number,
  pageWidth: number,
  pageHeight: number,
): number {
  if (containerWidth <= 0 || containerHeight <= 0) return 1
  if (pageWidth <= 0 || pageHeight <= 0) return 1

  const fitPage = Math.min(containerWidth / pageWidth, containerHeight / pageHeight)

  // Cycle: fitPage → 1.0 → 2.0 → fitPage
  const levels = [fitPage, 1.0, 2.0]

  // Find current position in cycle (with tolerance)
  for (let i = 0; i < levels.length; i++) {
    if (Math.abs(currentZoom - levels[i]) < 0.05) {
      // Go to next level (wrap around)
      return levels[(i + 1) % levels.length]
    }
  }

  // If not at any level, go to fit-page
  return fitPage
}

/**
 * Animate a value from start to end using requestAnimationFrame.
 * Respects prefers-reduced-motion.
 *
 * @returns cancel function
 */
export function animateValue(
  from: number,
  to: number,
  durationMs: number,
  onUpdate: (value: number) => void,
  onComplete?: () => void,
): () => void {
  // Respect reduced motion
  if (typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    onUpdate(to)
    onComplete?.()
    return () => {}
  }

  const start = performance.now()
  let rafId = 0

  function tick(now: number) {
    const elapsed = now - start
    const progress = Math.min(1, elapsed / durationMs)
    // Ease-out cubic
    const eased = 1 - Math.pow(1 - progress, 3)
    const value = from + (to - from) * eased

    onUpdate(value)

    if (progress < 1) {
      rafId = requestAnimationFrame(tick)
    } else {
      onComplete?.()
    }
  }

  rafId = requestAnimationFrame(tick)

  return () => {
    if (rafId) cancelAnimationFrame(rafId)
  }
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
