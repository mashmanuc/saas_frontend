// WB5: Laser Pointer composable — ephemeral tool, not persisted
// Ref: TASK_BOARD_V5.md A4, C3 (backend laser_pointer WS broadcast)
//
// Teacher holds mouse → red dot visible to all students in real-time.
// Laser pointer is NOT saved — purely ephemeral.

import { ref, computed, onUnmounted } from 'vue'
import type { WBLaserPosition, WBRemoteLaser } from '../types/winterboard'

// ─── Throttle helper ─────────────────────────────────────────────────────────

export function createThrottle(fn: (...args: unknown[]) => void, ms: number): (...args: unknown[]) => void {
  let lastCall = 0
  return (...args: unknown[]) => {
    const now = Date.now()
    if (now - lastCall >= ms) {
      lastCall = now
      fn(...args)
    }
  }
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FADE_TIMEOUT = 3000 // ms — remove stale remote lasers after 3s
const FADE_CHECK_INTERVAL = 1000 // ms — check every 1s
const BROADCAST_THROTTLE_MS = 33 // ~30 broadcasts/sec

// ─── Composable ──────────────────────────────────────────────────────────────

export interface UseLaserPointerOptions {
  /** Callback to broadcast laser position via WS */
  onBroadcast?: (data: { x: number; y: number; active: boolean; page_id?: string }) => void
  /** Current page ID getter */
  getPageId?: () => string
}

export function useLaserPointer(options?: UseLaserPointerOptions) {
  // === Local laser (this user) ===
  const isActive = ref(false)
  const localPosition = ref<WBLaserPosition | null>(null)

  // Throttled WS broadcast
  const throttledBroadcast = createThrottle((...args: unknown[]) => {
    const [x, y, pageId] = args as [number, number, string]
    options?.onBroadcast?.({ x, y, active: true, page_id: pageId })
  }, BROADCAST_THROTTLE_MS)

  /**
   * Start showing laser at position.
   * Called on mousedown when tool='laser'.
   */
  function startLaser(x: number, y: number): void {
    isActive.value = true
    localPosition.value = { x, y }
    // Immediate broadcast (not throttled) for start
    const pageId = options?.getPageId?.() ?? ''
    options?.onBroadcast?.({ x, y, active: true, page_id: pageId })
  }

  /**
   * Move laser to new position.
   * Called on mousemove when laser is active.
   * Throttled to ~30/sec for WS broadcasts.
   */
  function moveLaser(x: number, y: number): void {
    if (!isActive.value) return
    localPosition.value = { x, y }
    const pageId = options?.getPageId?.() ?? ''
    throttledBroadcast(x, y, pageId)
  }

  /**
   * Stop laser.
   * Called on mouseup or when switching away from laser tool.
   */
  function stopLaser(): void {
    if (!isActive.value) return
    isActive.value = false
    localPosition.value = null
    // Immediate broadcast for stop
    options?.onBroadcast?.({ x: 0, y: 0, active: false })
  }

  // === Remote lasers (other users) ===
  const remoteLasers = ref<Map<string, WBRemoteLaser>>(new Map())

  /**
   * Update remote laser position from WS broadcast.
   * Called when receiving 'laser_pointer' message from server.
   */
  function updateRemoteLaser(data: WBRemoteLaser): void {
    if (data.active) {
      remoteLasers.value = new Map(remoteLasers.value)
      remoteLasers.value.set(data.userId, {
        ...data,
        lastUpdate: Date.now(),
      })
    } else {
      remoteLasers.value = new Map(remoteLasers.value)
      remoteLasers.value.delete(data.userId)
    }
  }

  /**
   * Remove remote laser (user disconnected).
   */
  function removeRemoteLaser(userId: string): void {
    if (!remoteLasers.value.has(userId)) return
    remoteLasers.value = new Map(remoteLasers.value)
    remoteLasers.value.delete(userId)
  }

  // === Auto-fade: remove stale remote lasers after 3s ===
  const fadeInterval = setInterval(() => {
    const now = Date.now()
    let changed = false
    for (const [userId, laser] of remoteLasers.value) {
      if (now - laser.lastUpdate > FADE_TIMEOUT) {
        remoteLasers.value.delete(userId)
        changed = true
      }
    }
    if (changed) {
      remoteLasers.value = new Map(remoteLasers.value)
    }
  }, FADE_CHECK_INTERVAL)

  onUnmounted(() => {
    clearInterval(fadeInterval)
    if (isActive.value) stopLaser()
  })

  // === Active remote lasers (for rendering) ===
  const activeRemoteLasers = computed(() =>
    Array.from(remoteLasers.value.values()),
  )

  return {
    // Local
    isActive,
    localPosition,
    startLaser,
    moveLaser,
    stopLaser,
    // Remote
    remoteLasers,
    activeRemoteLasers,
    updateRemoteLaser,
    removeRemoteLaser,
    // Exposed for testing
    FADE_TIMEOUT,
  }
}
