// WB Responsive Phase 2 A3: Orientation lock/suggestion
// Ref: winterboard_dev/responsive/PHASE2.md A3.3
//
// - Display mode: request landscape lock
// - Tablet in portrait: show suggestion to rotate
// - Mobile: allow both orientations (no lock)

import { ref, computed, onMounted, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { DeviceMode, Orientation } from '../types/responsive'

export interface UseOrientationLockReturn {
  /** Whether orientation is currently locked */
  isLocked: Ref<boolean>
  /** Suggestion to show user ('landscape' if should rotate, null otherwise) */
  suggestion: ComputedRef<'landscape' | null>
  /** Request landscape lock (display mode) */
  requestLandscape: () => Promise<void>
  /** Unlock orientation */
  unlock: () => void
}

export function useOrientationLock(
  deviceMode: Ref<DeviceMode>,
  orientation: Ref<Orientation>,
): UseOrientationLockReturn {
  const isLocked = ref(false)

  // Show suggestion to rotate on tablet when in portrait
  const suggestion = computed<'landscape' | null>(() => {
    if (deviceMode.value === 'tablet' && orientation.value === 'portrait') {
      return 'landscape'
    }
    return null
  })

  async function requestLandscape(): Promise<void> {
    // Only attempt lock on display mode
    if (deviceMode.value !== 'display') return

    try {
      const so = screen.orientation as any
      if (so?.lock) {
        await so.lock('landscape')
        isLocked.value = true
      }
    } catch {
      // Not supported or permission denied — silently fail
      isLocked.value = false
    }
  }

  function unlock(): void {
    if (!isLocked.value) return

    try {
      const so = screen.orientation as any
      if (so?.unlock) {
        so.unlock()
      }
    } catch {
      // Not supported
    }
    isLocked.value = false
  }

  // Auto-lock on display mode mount
  onMounted(() => {
    if (deviceMode.value === 'display') {
      requestLandscape()
    }
  })

  // Unlock on unmount
  onUnmounted(() => {
    unlock()
  })

  return {
    isLocked,
    suggestion,
    requestLandscape,
    unlock,
  }
}
