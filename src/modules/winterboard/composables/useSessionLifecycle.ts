// WB: useSessionLifecycle — classroom session lifecycle management
// Ref: TASK_BOARD_PHASES.md A3.3, C3.2 classroom-session linking
// Handles: lesson start/end, student join/leave, teacher reconnect,
//          network disconnect, multiple tabs, browser close beacon save

import { ref, readonly, onBeforeUnmount, type Ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'
import type { WBClassroomRole } from '../api/winterboardApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:SessionLifecycle]'
const RECONNECT_DELAY_MS = 2_000
const MAX_RECONNECT_ATTEMPTS = 5
const TAB_LOCK_KEY = 'wb:classroom:active-tab'
const TAB_LOCK_TTL_MS = 10_000

// ─── Types ──────────────────────────────────────────────────────────────────

export type SessionLifecycleState =
  | 'idle'
  | 'initializing'
  | 'active'
  | 'reconnecting'
  | 'ended'
  | 'error'

export interface SessionLifecycleCallbacks {
  onSessionReady?: (sessionId: string) => void
  onSessionEnded?: () => void
  onStudentJoined?: (userId: string) => void
  onStudentLeft?: (userId: string) => void
  onKicked?: () => void
  onLockChanged?: (locked: boolean) => void
  onReconnected?: () => void
  onDisconnected?: () => void
}

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Manages the full lifecycle of a classroom WB session.
 *
 * Handles:
 * - Lesson starts → teacher opens WB → session created
 * - Students join lesson → auto-connect to WB session
 * - Teacher ends session → session archived, students disconnected
 * - Lesson ends → session auto-saved, WS disconnected
 * - Student leaves lesson → WS disconnect, cursor removed
 * - Teacher reconnects → restore session state, re-sync students
 * - Network disconnect → reconnect with state merge
 * - Multiple tabs → prevent duplicate sessions (tab lock)
 * - Browser close → beacon save
 */
export function useSessionLifecycle(
  sessionId: Ref<string | null>,
  role: Ref<WBClassroomRole | null>,
  callbacks: SessionLifecycleCallbacks = {},
) {
  const state = ref<SessionLifecycleState>('idle')
  const reconnectAttempts = ref(0)
  const isTabActive = ref(true)
  const error = ref<string | null>(null)

  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let tabHeartbeatTimer: ReturnType<typeof setInterval> | null = null
  let beaconRegistered = false

  // ── Tab lock (prevent duplicate sessions) ───────────────────────────

  function acquireTabLock(): boolean {
    const tabId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const sid = sessionId.value
    if (!sid) return true

    const key = `${TAB_LOCK_KEY}:${sid}`

    try {
      const existing = localStorage.getItem(key)
      if (existing) {
        const parsed = JSON.parse(existing)
        const age = Date.now() - parsed.ts
        if (age < TAB_LOCK_TTL_MS) {
          // Another tab is active
          console.warn(`${LOG} Another tab is active for session ${sid}`)
          return false
        }
      }

      localStorage.setItem(key, JSON.stringify({ tabId, ts: Date.now() }))
      isTabActive.value = true

      // Heartbeat to keep lock alive
      tabHeartbeatTimer = setInterval(() => {
        localStorage.setItem(key, JSON.stringify({ tabId, ts: Date.now() }))
      }, TAB_LOCK_TTL_MS / 2)

      return true
    } catch {
      // localStorage unavailable — allow
      return true
    }
  }

  function releaseTabLock(): void {
    const sid = sessionId.value
    if (!sid) return

    if (tabHeartbeatTimer) {
      clearInterval(tabHeartbeatTimer)
      tabHeartbeatTimer = null
    }

    try {
      localStorage.removeItem(`${TAB_LOCK_KEY}:${sid}`)
    } catch {
      // Ignore
    }
    isTabActive.value = false
  }

  // ── Beacon save (browser close) ─────────────────────────────────────

  function registerBeaconSave(getState: () => Record<string, unknown> | null): void {
    if (beaconRegistered) return

    const handler = () => {
      const sid = sessionId.value
      if (!sid) return

      const stateData = getState()
      if (stateData) {
        winterboardApi.beaconSave(sid, stateData)
        console.info(`${LOG} Beacon save on unload`, { sessionId: sid })
      }

      releaseTabLock()
    }

    window.addEventListener('beforeunload', handler)
    beaconRegistered = true

    // Store handler ref for cleanup
    ;(registerBeaconSave as unknown as Record<string, unknown>)._handler = handler
  }

  function unregisterBeaconSave(): void {
    const handler = (registerBeaconSave as unknown as Record<string, unknown>)._handler as EventListener | undefined
    if (handler) {
      window.removeEventListener('beforeunload', handler)
      beaconRegistered = false
    }
  }

  // ── Reconnect logic ─────────────────────────────────────────────────

  function scheduleReconnect(connectFn: () => Promise<boolean>): void {
    if (reconnectAttempts.value >= MAX_RECONNECT_ATTEMPTS) {
      state.value = 'error'
      error.value = `Reconnect failed after ${MAX_RECONNECT_ATTEMPTS} attempts`
      console.error(`${LOG} Max reconnect attempts reached`)
      callbacks.onDisconnected?.()
      return
    }

    state.value = 'reconnecting'
    reconnectAttempts.value++

    const delay = RECONNECT_DELAY_MS * Math.pow(1.5, reconnectAttempts.value - 1)
    console.info(`${LOG} Reconnect attempt ${reconnectAttempts.value}/${MAX_RECONNECT_ATTEMPTS} in ${delay}ms`)

    reconnectTimer = setTimeout(async () => {
      try {
        const success = await connectFn()
        if (success) {
          state.value = 'active'
          reconnectAttempts.value = 0
          error.value = null
          console.info(`${LOG} Reconnected successfully`)
          callbacks.onReconnected?.()
        } else {
          scheduleReconnect(connectFn)
        }
      } catch {
        scheduleReconnect(connectFn)
      }
    }, delay)
  }

  function cancelReconnect(): void {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    reconnectAttempts.value = 0
  }

  // ── Lifecycle events ────────────────────────────────────────────────

  /**
   * Called when lesson starts and teacher opens winterboard.
   * Initializes session, acquires tab lock, registers beacon save.
   */
  function onLessonStart(
    sid: string,
    connectFn: () => Promise<boolean>,
    getStateFn: () => Record<string, unknown> | null,
  ): boolean {
    state.value = 'initializing'
    error.value = null

    // Acquire tab lock
    if (!acquireTabLock()) {
      state.value = 'error'
      error.value = 'Session is already open in another tab'
      return false
    }

    // Register beacon save
    registerBeaconSave(getStateFn)

    // Mark active
    state.value = 'active'
    console.info(`${LOG} Lesson started`, { sessionId: sid, role: role.value })
    callbacks.onSessionReady?.(sid)

    return true
  }

  /**
   * Called when lesson ends (teacher or student).
   * Saves state, disconnects WS, releases tab lock.
   */
  async function onLessonEnd(saveFn?: () => Promise<void>): Promise<void> {
    cancelReconnect()

    // Save state
    if (saveFn) {
      try {
        await saveFn()
      } catch (err) {
        console.warn(`${LOG} Save on lesson end failed`, err)
      }
    }

    // Cleanup
    releaseTabLock()
    unregisterBeaconSave()
    state.value = 'ended'

    console.info(`${LOG} Lesson ended`, { sessionId: sessionId.value })
    callbacks.onSessionEnded?.()
  }

  /**
   * Called when a student joins the session.
   */
  function onStudentJoin(userId: string): void {
    console.info(`${LOG} Student joined`, { userId })
    callbacks.onStudentJoined?.(userId)
  }

  /**
   * Called when a student leaves the session.
   */
  function onStudentLeave(userId: string): void {
    console.info(`${LOG} Student left`, { userId })
    callbacks.onStudentLeft?.(userId)
  }

  /**
   * Called when this user is kicked from the session.
   */
  function onKicked(): void {
    cancelReconnect()
    releaseTabLock()
    unregisterBeaconSave()
    state.value = 'ended'
    error.value = 'You have been removed from this session'

    console.info(`${LOG} Kicked from session`, { sessionId: sessionId.value })
    callbacks.onKicked?.()
  }

  /**
   * Called when lock state changes (from WS message).
   */
  function onLockChanged(locked: boolean): void {
    console.info(`${LOG} Lock changed`, { locked })
    callbacks.onLockChanged?.(locked)
  }

  /**
   * Called when network disconnects.
   * Starts reconnect loop.
   */
  function onDisconnect(connectFn: () => Promise<boolean>): void {
    if (state.value === 'ended') return
    console.warn(`${LOG} Disconnected`, { sessionId: sessionId.value })
    scheduleReconnect(connectFn)
  }

  /**
   * Handle incoming WS session messages.
   */
  function handleSessionMessage(message: { type: string; payload?: Record<string, unknown> }): void {
    switch (message.type) {
      case 'session.lock':
        onLockChanged(!!message.payload?.locked)
        break
      case 'session.kick':
        if (message.payload?.userId === role.value) {
          onKicked()
        }
        break
      case 'session.end':
        onLessonEnd()
        break
      case 'session.page':
        // Handled by follow mode — no action here
        break
      default:
        console.warn(`${LOG} Unknown session message`, message)
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  function reset(): void {
    cancelReconnect()
    releaseTabLock()
    unregisterBeaconSave()
    state.value = 'idle'
    reconnectAttempts.value = 0
    error.value = null
  }

  onBeforeUnmount(() => {
    reset()
  })

  return {
    state: readonly(state),
    reconnectAttempts: readonly(reconnectAttempts),
    isTabActive: readonly(isTabActive),
    error: readonly(error),

    onLessonStart,
    onLessonEnd,
    onStudentJoin,
    onStudentLeave,
    onKicked,
    onLockChanged,
    onDisconnect,
    handleSessionMessage,
    reset,
  }
}
