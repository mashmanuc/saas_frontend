/**
 * F29-STEALTH: Render Queue
 * Single point of entry for all Konva draw() calls
 * Uses requestAnimationFrame for batched rendering
 */

import Konva from 'konva'
import { recordRafFlush, isSaveWindowActive } from '../perf/saveWindowMetrics'

// Queue state
let pendingRender = false
let rafId: number | null = null
let stage: Konva.Stage | null = null

// Metrics
let lastRenderTime = 0
let renderCount = 0
let skippedCount = 0

// Callbacks waiting for next render
const callbacks: Array<() => void> = []

/**
 * Initialize render queue with stage reference
 */
export function initRenderQueue(stageRef: Konva.Stage): void {
  stage = stageRef
}

/**
 * Request a render on next animation frame
 * Multiple calls before the frame are coalesced into one render
 */
export function requestRender(callback?: () => void): void {
  if (callback) {
    callbacks.push(callback)
  }

  // F29-STEALTH: If save window active, drop render requests to avoid extra draws
  if (isSaveWindowActive()) {
    if (callbacks.length > 0) {
      console.debug('[renderQueue] Dropping render due to active save window', {
        droppedCallbacks: callbacks.length,
      })
    } else {
      console.debug('[renderQueue] Dropping render due to active save window (no callbacks)')
    }
    callbacks.length = 0
    pendingRender = false
    return
  }

  if (pendingRender) {
    skippedCount++
    console.debug('[renderQueue] Render already pending, skipping request', {
      skippedCount,
    })
    return
  }

  pendingRender = true

  rafId = requestAnimationFrame(() => {
    const startTime = performance.now()
    
    // F29-STEALTH: Record rAF flush for input latency metrics
    recordRafFlush()

    // Execute all pending callbacks
    while (callbacks.length > 0) {
      const cb = callbacks.shift()
      try {
        cb?.()
      } catch (e) {
        console.error('[renderQueue] Callback error:', e)
      }
    }

    // Perform single batched draw
    if (stage) {
      console.debug('[renderQueue] Flushing batchDraw', {
        callbackCountBeforeFlush: callbacks.length,
      })
      stage.batchDraw()
    }

    lastRenderTime = performance.now() - startTime
    renderCount++
    pendingRender = false
    rafId = null
  })
}

/**
 * Cancel pending render (e.g., on unmount)
 */
export function cancelPendingRender(): void {
  if (rafId !== null) {
    cancelAnimationFrame(rafId)
    rafId = null
  }
  pendingRender = false
  callbacks.length = 0
}

/**
 * Force immediate render (use sparingly)
 */
export function forceRender(): void {
  cancelPendingRender()
  
  if (stage) {
    const startTime = performance.now()
    stage.batchDraw()
    lastRenderTime = performance.now() - startTime
    renderCount++
  }
}

/**
 * Get render metrics for HUD
 */
export function getRenderMetrics(): {
  lastRenderTime: number
  renderCount: number
  skippedCount: number
  hasPending: boolean
} {
  return {
    lastRenderTime,
    renderCount,
    skippedCount,
    hasPending: pendingRender,
  }
}

/**
 * Reset metrics (for testing)
 */
export function resetRenderMetrics(): void {
  lastRenderTime = 0
  renderCount = 0
  skippedCount = 0
}

/**
 * Clean up (call on unmount)
 */
export function destroyRenderQueue(): void {
  cancelPendingRender()
  stage = null
  resetRenderMetrics()
}

/**
 * Check if render is pending
 */
export function isRenderPending(): boolean {
  return pendingRender
}
