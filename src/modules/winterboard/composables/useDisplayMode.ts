// WB Responsive Phase 3 A5: Display mode composable
// Ref: winterboard_dev/responsive/PHASE3.md A5
//
// Provides: fullscreen API, wake lock (native + NoSleep fallback),
// auto-hide UI after inactivity, DPR-aware canvas quality, display scale.

import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  type Ref,
  type ComputedRef,
} from 'vue'
import type { DeviceMode } from '../types/responsive'

// ─── Constants ──────────────────────────────────────────────────────────────

const AUTO_HIDE_DELAY_MS = 5000
const MAX_PIXEL_RATIO = 2

// ─── Types ──────────────────────────────────────────────────────────────────

export type CanvasQuality = 'standard' | 'high'
export type WakeLockMethod = 'native' | 'nosleep' | 'none'

export interface UseDisplayModeReturn {
  isDisplayMode: ComputedRef<boolean>
  displayScale: ComputedRef<number>
  canvasQuality: ComputedRef<CanvasQuality>
  effectiveDpr: ComputedRef<number>

  // Fullscreen
  isFullscreen: Ref<boolean>
  enterFullscreen: () => Promise<void>
  exitFullscreen: () => Promise<void>
  toggleFullscreen: () => Promise<void>

  // Wake lock
  hasWakeLock: Ref<boolean>
  wakeLockMethod: Ref<WakeLockMethod>
  requestWakeLock: () => Promise<void>
  releaseWakeLock: () => void

  // Auto-hide UI
  uiVisible: Ref<boolean>
  resetAutoHide: () => void
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useDisplayMode(deviceMode: Ref<DeviceMode>): UseDisplayModeReturn {
  // ── Core state ──────────────────────────────────────────────────────

  const isDisplayMode = computed(() => deviceMode.value === 'display')

  const displayScale = computed(() => {
    switch (deviceMode.value) {
      case 'display': return 1.5
      case 'tablet': return 1.1
      default: return 1.0
    }
  })

  const effectiveDpr = computed(() => {
    if (typeof window === 'undefined') return 1
    return Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO)
  })

  const canvasQuality = computed<CanvasQuality>(() => {
    return isDisplayMode.value ? 'high' : 'standard'
  })

  // ── Fullscreen ──────────────────────────────────────────────────────

  const isFullscreen = ref(false)

  function updateFullscreenState() {
    isFullscreen.value = !!document.fullscreenElement
  }

  async function enterFullscreen(): Promise<void> {
    try {
      await document.documentElement.requestFullscreen?.()
      isFullscreen.value = true
    } catch {
      // Not supported or denied
    }
  }

  async function exitFullscreen(): Promise<void> {
    try {
      await document.exitFullscreen?.()
      isFullscreen.value = false
    } catch {
      // Not in fullscreen
    }
  }

  async function toggleFullscreen(): Promise<void> {
    if (isFullscreen.value) {
      await exitFullscreen()
    } else {
      await enterFullscreen()
    }
  }

  // ── Wake Lock ───────────────────────────────────────────────────────

  const hasWakeLock = ref(false)
  const wakeLockMethod = ref<WakeLockMethod>('none')
  let wakeLockSentinel: any = null
  let noSleepVideo: HTMLVideoElement | null = null

  async function requestWakeLock(): Promise<void> {
    // Try native Wake Lock API first
    if ('wakeLock' in navigator) {
      try {
        wakeLockSentinel = await (navigator as any).wakeLock.request('screen')
        hasWakeLock.value = true
        wakeLockMethod.value = 'native'

        wakeLockSentinel.addEventListener('release', () => {
          hasWakeLock.value = false
          wakeLockMethod.value = 'none'
        })
        return
      } catch {
        // Fall through to NoSleep fallback
      }
    }

    // NoSleep.js fallback: play invisible video to prevent sleep
    // Safari (iPad) doesn't support Wake Lock API
    try {
      if (!noSleepVideo) {
        noSleepVideo = document.createElement('video')
        noSleepVideo.setAttribute('playsinline', '')
        noSleepVideo.setAttribute('muted', '')
        noSleepVideo.muted = true
        noSleepVideo.loop = true
        noSleepVideo.style.cssText = 'position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0;pointer-events:none;'
        // Minimal mp4 data URI (1x1 transparent pixel, 0.1s)
        noSleepVideo.src = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA'
          + 'ABtZGF0AAACrgYF//+q3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0OCByMjY0MyBhMGNkN2QxIC0gSC4yNjQvTVBFRy00'
        document.body.appendChild(noSleepVideo)
      }
      await noSleepVideo.play()
      hasWakeLock.value = true
      wakeLockMethod.value = 'nosleep'
    } catch {
      hasWakeLock.value = false
      wakeLockMethod.value = 'none'
    }
  }

  function releaseWakeLock(): void {
    if (wakeLockSentinel) {
      try { wakeLockSentinel.release() } catch { /* ignore */ }
      wakeLockSentinel = null
    }
    if (noSleepVideo) {
      noSleepVideo.pause()
      noSleepVideo.remove()
      noSleepVideo = null
    }
    hasWakeLock.value = false
    wakeLockMethod.value = 'none'
  }

  // ── Auto-hide UI ────────────────────────────────────────────────────

  const uiVisible = ref(true)
  let autoHideTimer: ReturnType<typeof setTimeout> | null = null

  function resetAutoHide(): void {
    uiVisible.value = true
    if (autoHideTimer) clearTimeout(autoHideTimer)

    if (isDisplayMode.value) {
      autoHideTimer = setTimeout(() => {
        uiVisible.value = false
      }, AUTO_HIDE_DELAY_MS)
    }
  }

  function onUserActivity(): void {
    if (isDisplayMode.value) {
      resetAutoHide()
    }
  }

  // ── Lifecycle ───────────────────────────────────────────────────────

  onMounted(() => {
    document.addEventListener('fullscreenchange', updateFullscreenState)

    if (isDisplayMode.value) {
      requestWakeLock()
      resetAutoHide()
      document.addEventListener('pointermove', onUserActivity)
      document.addEventListener('pointerdown', onUserActivity)
      document.addEventListener('keydown', onUserActivity)
    }
  })

  // Watch for device mode changes
  watch(isDisplayMode, (isDisplay) => {
    if (isDisplay) {
      requestWakeLock()
      resetAutoHide()
      document.addEventListener('pointermove', onUserActivity)
      document.addEventListener('pointerdown', onUserActivity)
      document.addEventListener('keydown', onUserActivity)
    } else {
      releaseWakeLock()
      uiVisible.value = true
      if (autoHideTimer) clearTimeout(autoHideTimer)
      document.removeEventListener('pointermove', onUserActivity)
      document.removeEventListener('pointerdown', onUserActivity)
      document.removeEventListener('keydown', onUserActivity)
    }
  })

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', updateFullscreenState)
    document.removeEventListener('pointermove', onUserActivity)
    document.removeEventListener('pointerdown', onUserActivity)
    document.removeEventListener('keydown', onUserActivity)
    releaseWakeLock()
    if (autoHideTimer) clearTimeout(autoHideTimer)
  })

  return {
    isDisplayMode,
    displayScale,
    canvasQuality,
    effectiveDpr,
    isFullscreen,
    enterFullscreen,
    exitFullscreen,
    toggleFullscreen,
    hasWakeLock,
    wakeLockMethod,
    requestWakeLock,
    releaseWakeLock,
    uiVisible,
    resetAutoHide,
  }
}

export { AUTO_HIDE_DELAY_MS, MAX_PIXEL_RATIO }
