// WB: useFollowMode — composable for "Follow Teacher" mode
// Ref: TASK_BOARD.md A5.1, ManifestWinterboard_v2.md LAW-16
// Uses viewport data from usePresence (A5.2) to sync scroll/zoom/page

import { ref, computed, watch, onUnmounted, type Ref, type ComputedRef } from 'vue'
import type { WBRemoteCursor } from '../types/winterboard'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG_PREFIX = '[WB:FollowMode]'
const VIEWPORT_LERP_DURATION_MS = 300  // Smooth scroll/zoom animation duration
const VIEWPORT_SYNC_INTERVAL_MS = 100  // How often to check for viewport changes

// ─── Types ──────────────────────────────────────────────────────────────────

export interface UseFollowModeOptions {
  /** Reactive map of remote cursors (from usePresence) */
  remoteCursors: ComputedRef<Map<string, WBRemoteCursor>>
  /** Current zoom level (reactive) */
  zoom: Ref<number>
  /** Current scroll position X */
  scrollX: Ref<number>
  /** Current scroll position Y */
  scrollY: Ref<number>
  /** Current page index */
  currentPageIndex: Ref<number>
  /** Page IDs array for page navigation */
  pageIds: ComputedRef<string[]>
  /** Callback to set zoom */
  setZoom: (zoom: number) => void
  /** Callback to set scroll position */
  setScroll: (x: number, y: number) => void
  /** Callback to navigate to page by index */
  goToPage: (index: number) => void
}

export interface FollowTarget {
  userId: string
  displayName: string
  color: string
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function useFollowMode(options: UseFollowModeOptions) {
  const {
    remoteCursors,
    setZoom,
    setScroll,
    goToPage,
    pageIds,
  } = options

  // ── State ──────────────────────────────────────────────────────────────

  const isFollowing = ref(false)
  const followTargetId = ref<string | null>(null)
  const followTarget = ref<FollowTarget | null>(null)
  const userInterrupted = ref(false)

  // Animation state
  let animationFrameId: number | null = null
  let syncIntervalId: ReturnType<typeof setInterval> | null = null
  let lastAppliedScrollX = 0
  let lastAppliedScrollY = 0
  let lastAppliedZoom = 1
  let targetScrollX = 0
  let targetScrollY = 0
  let targetZoom = 1
  let lerpStartTime = 0
  let lerpStartScrollX = 0
  let lerpStartScrollY = 0
  let lerpStartZoom = 1

  // ── Computed ───────────────────────────────────────────────────────────

  /** Find the teacher cursor (role === 'teacher') or first user in room */
  const teacherCursor = computed<WBRemoteCursor | null>(() => {
    const cursors = remoteCursors.value
    if (!cursors || cursors.size === 0) return null

    // Priority 1: user with role 'teacher'
    for (const cursor of cursors.values()) {
      if (cursor.role === 'teacher') return cursor
    }

    // Priority 2: the user we're explicitly following
    if (followTargetId.value) {
      return cursors.get(followTargetId.value) ?? null
    }

    // Priority 3: first user in the room (MVP fallback)
    const first = cursors.values().next()
    return first.done ? null : first.value
  })

  const followingDisplayName = computed(() => followTarget.value?.displayName ?? '')

  const canFollow = computed(() => {
    return remoteCursors.value.size > 0
  })

  // ── Follow control ─────────────────────────────────────────────────────

  function startFollowing(targetUserId?: string): void {
    const cursors = remoteCursors.value

    // Determine who to follow
    let target: WBRemoteCursor | null = null
    if (targetUserId) {
      target = cursors.get(targetUserId) ?? null
    }
    if (!target) {
      target = teacherCursor.value
    }
    if (!target) {
      console.warn(LOG_PREFIX, 'No target to follow')
      return
    }

    followTargetId.value = target.userId
    followTarget.value = {
      userId: target.userId,
      displayName: target.displayName,
      color: target.color,
    }
    isFollowing.value = true
    userInterrupted.value = false

    console.info(LOG_PREFIX, 'Following', target.displayName)

    // Apply initial viewport immediately
    applyViewportFromCursor(target, true)

    // Start sync interval
    startSyncInterval()
  }

  function stopFollowing(): void {
    isFollowing.value = false
    followTargetId.value = null
    followTarget.value = null
    userInterrupted.value = false

    stopSyncInterval()
    cancelAnimation()

    console.info(LOG_PREFIX, 'Stopped following')
  }

  /** Called when user manually scrolls/zooms — auto-stop follow */
  function onUserInteraction(): void {
    if (!isFollowing.value) return
    userInterrupted.value = true
    stopFollowing()
  }

  // ── Viewport sync ─────────────────────────────────────────────────────

  function startSyncInterval(): void {
    stopSyncInterval()
    syncIntervalId = setInterval(() => {
      if (!isFollowing.value || !followTargetId.value) return

      const cursor = remoteCursors.value.get(followTargetId.value)
      if (!cursor) {
        // Target disconnected
        stopFollowing()
        return
      }

      applyViewportFromCursor(cursor, false)
    }, VIEWPORT_SYNC_INTERVAL_MS)
  }

  function stopSyncInterval(): void {
    if (syncIntervalId !== null) {
      clearInterval(syncIntervalId)
      syncIntervalId = null
    }
  }

  function applyViewportFromCursor(cursor: WBRemoteCursor, immediate: boolean): void {
    // Navigate to same page if different
    const targetPageId = cursor.pageId
    if (targetPageId && pageIds.value.length > 0) {
      const targetPageIndex = pageIds.value.indexOf(targetPageId)
      if (targetPageIndex >= 0 && targetPageIndex !== options.currentPageIndex.value) {
        goToPage(targetPageIndex)
      }
    }

    // Apply scroll + zoom
    const newScrollX = cursor.scrollX ?? 0
    const newScrollY = cursor.scrollY ?? 0
    const newZoom = cursor.zoom ?? 1

    // Skip if no change
    if (
      Math.abs(newScrollX - lastAppliedScrollX) < 1 &&
      Math.abs(newScrollY - lastAppliedScrollY) < 1 &&
      Math.abs(newZoom - lastAppliedZoom) < 0.01
    ) {
      return
    }

    if (immediate) {
      // Apply immediately without animation
      setScroll(newScrollX, newScrollY)
      setZoom(newZoom)
      lastAppliedScrollX = newScrollX
      lastAppliedScrollY = newScrollY
      lastAppliedZoom = newZoom
    } else {
      // Smooth lerp animation
      targetScrollX = newScrollX
      targetScrollY = newScrollY
      targetZoom = newZoom
      lerpStartScrollX = lastAppliedScrollX
      lerpStartScrollY = lastAppliedScrollY
      lerpStartZoom = lastAppliedZoom
      lerpStartTime = performance.now()
      startAnimation()
    }
  }

  // ── Animation (smooth lerp) ───────────────────────────────────────────

  function startAnimation(): void {
    if (animationFrameId !== null) return
    animationFrameId = requestAnimationFrame(animateStep)
  }

  function cancelAnimation(): void {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
  }

  function animateStep(now: number): void {
    animationFrameId = null

    const elapsed = now - lerpStartTime
    const progress = Math.min(elapsed / VIEWPORT_LERP_DURATION_MS, 1)

    // Ease-out cubic for smooth deceleration
    const eased = 1 - Math.pow(1 - progress, 3)

    const currentScrollX = lerpStartScrollX + (targetScrollX - lerpStartScrollX) * eased
    const currentScrollY = lerpStartScrollY + (targetScrollY - lerpStartScrollY) * eased
    const currentZoom = lerpStartZoom + (targetZoom - lerpStartZoom) * eased

    setScroll(currentScrollX, currentScrollY)
    setZoom(currentZoom)

    lastAppliedScrollX = currentScrollX
    lastAppliedScrollY = currentScrollY
    lastAppliedZoom = currentZoom

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animateStep)
    }
  }

  // ── Watch for target disconnect ────────────────────────────────────────

  watch(
    () => remoteCursors.value.size,
    () => {
      if (!isFollowing.value || !followTargetId.value) return
      if (!remoteCursors.value.has(followTargetId.value)) {
        console.info(LOG_PREFIX, 'Follow target disconnected')
        stopFollowing()
      }
    },
  )

  // ── Cleanup ────────────────────────────────────────────────────────────

  onUnmounted(() => {
    stopFollowing()
  })

  // ── Return ─────────────────────────────────────────────────────────────

  return {
    // State
    isFollowing,
    followTarget,
    followingDisplayName,
    canFollow,
    teacherCursor,
    userInterrupted,

    // Actions
    startFollowing,
    stopFollowing,
    onUserInteraction,
  }
}
