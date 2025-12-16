/**
 * F29-STEALTH: Snapshot Overlay
 * Creates an ImageBitmap overlay to hide canvas during save
 * Prevents any visual flicker by showing a static snapshot
 */

import Konva from 'konva'
import { isRenderGuardActive } from './guards'

// Overlay state
let overlayCanvas: HTMLCanvasElement | null = null
let overlayCtx: CanvasRenderingContext2D | null = null
let currentBitmap: ImageBitmap | null = null
let isOverlayVisible = false
let fadeAnimationId: number | null = null

// Performance metrics
let lastCopyDuration = 0

/**
 * Initialize overlay canvas (call once on mount)
 */
export function initSnapshotOverlay(container: HTMLElement): HTMLCanvasElement {
  if (overlayCanvas) {
    return overlayCanvas
  }

  overlayCanvas = document.createElement('canvas')
  overlayCanvas.className = 'stealth-overlay'
  // F29-STEALTH: CSS for overlay - must be above canvas
  overlayCanvas.style.cssText = `
    position: absolute;
    inset: 0;
    pointer-events: none;
    contain: content;
    isolation: isolate;
    z-index: 2;
    will-change: opacity;
    opacity: 0;
  `
  
  overlayCtx = overlayCanvas.getContext('2d', {
    alpha: false,
    desynchronized: true, // Reduce latency
  })

  container.appendChild(overlayCanvas)
  return overlayCanvas
}

/**
 * Create snapshot from stage and show overlay
 * Returns copy duration in ms
 */
export async function showSnapshotOverlay(stage: Konva.Stage | null): Promise<number> {
  if (!stage || !overlayCanvas || !overlayCtx) {
    return 0
  }

  const startTime = performance.now()
  console.debug('[snapshotOverlay] Capturing stage canvas', {
    isGuardActive: isRenderGuardActive(),
  })

  try {
    // Get stage dimensions
    const width = stage.width()
    const height = stage.height()
    const pixelRatio = stage.getAttr('pixelRatio') || 1

    // Resize overlay canvas if needed
    if (overlayCanvas.width !== width * pixelRatio || overlayCanvas.height !== height * pixelRatio) {
      overlayCanvas.width = width * pixelRatio
      overlayCanvas.height = height * pixelRatio
      overlayCanvas.style.width = `${width}px`
      overlayCanvas.style.height = `${height}px`
    }

    // Get stage canvas and create bitmap
    const stageCanvas = stage.toCanvas({
      pixelRatio,
    })

    // Use transferToImageBitmap if available for zero-copy
    if ('transferToImageBitmap' in stageCanvas && typeof (stageCanvas as unknown as { transferToImageBitmap: () => ImageBitmap }).transferToImageBitmap === 'function') {
      currentBitmap?.close()
      currentBitmap = (stageCanvas as unknown as { transferToImageBitmap: () => ImageBitmap }).transferToImageBitmap()
    } else {
      // Fallback: create ImageBitmap from canvas
      currentBitmap?.close()
      currentBitmap = await createImageBitmap(stageCanvas)
    }

    // Draw bitmap to overlay
    overlayCtx.drawImage(currentBitmap, 0, 0)

    // Show overlay
    overlayCanvas.style.opacity = '1'
    isOverlayVisible = true

    lastCopyDuration = performance.now() - startTime
    return lastCopyDuration

  } catch (error) {
    console.warn('[snapshotOverlay] Failed to create snapshot:', error)
    return 0
  }
}

/**
 * Hide overlay with fade animation
 */
export function hideSnapshotOverlay(fadeDurationMs = 150): void {
  if (!overlayCanvas || !isOverlayVisible) {
    return
  }

  // Cancel any existing animation
  if (fadeAnimationId !== null) {
    cancelAnimationFrame(fadeAnimationId)
  }

  const startTime = performance.now()
  const startOpacity = 1

  function animate() {
    const elapsed = performance.now() - startTime
    const progress = Math.min(1, elapsed / fadeDurationMs)
    const opacity = startOpacity * (1 - progress)

    if (overlayCanvas) {
      overlayCanvas.style.opacity = String(opacity)
    }

    if (progress < 1) {
      fadeAnimationId = requestAnimationFrame(animate)
    } else {
      // Animation complete
      isOverlayVisible = false
      fadeAnimationId = null
      
      // Clean up bitmap
      currentBitmap?.close()
      currentBitmap = null
    }
  }

  fadeAnimationId = requestAnimationFrame(animate)
}

/**
 * Immediately hide overlay (no animation)
 */
export function hideSnapshotOverlayImmediate(): void {
  if (fadeAnimationId !== null) {
    cancelAnimationFrame(fadeAnimationId)
    fadeAnimationId = null
  }

  if (overlayCanvas) {
    overlayCanvas.style.opacity = '0'
  }

  isOverlayVisible = false
  currentBitmap?.close()
  currentBitmap = null
}

/**
 * Clean up overlay (call on unmount)
 */
export function destroySnapshotOverlay(): void {
  hideSnapshotOverlayImmediate()
  
  if (overlayCanvas?.parentNode) {
    overlayCanvas.parentNode.removeChild(overlayCanvas)
  }
  
  overlayCanvas = null
  overlayCtx = null
}

/**
 * Get last copy duration (for HUD/metrics)
 */
export function getLastCopyDuration(): number {
  return lastCopyDuration
}

/**
 * Check if overlay is currently visible
 */
export function isSnapshotOverlayVisible(): boolean {
  return isOverlayVisible
}
