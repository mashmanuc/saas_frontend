// WB: useTeacherControls — teacher-specific session controls
// Ref: TASK_BOARD_PHASES.md A3.2, C3.1 RBAC, C3.3 WS message types
// Controls: lock/unlock drawing, set active page, kick student, end session
// WS message types: session.lock, session.page, session.kick, session.end

import { ref, readonly, type Ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:TeacherControls]'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface WBSessionMessage {
  type: 'session.lock' | 'session.page' | 'session.kick' | 'session.end'
  payload: Record<string, unknown>
}

export type WSSendFn = (message: WBSessionMessage) => void

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Teacher controls for classroom WB session.
 *
 * Requires a WebSocket send function for broadcasting messages to students.
 * Falls back to REST API when WS is unavailable.
 *
 * Usage:
 * ```ts
 * const controls = useTeacherControls(sessionId, wsSend)
 * await controls.lockDrawing(true)
 * controls.setActivePage(2)
 * await controls.kickStudent('user-123')
 * await controls.endSession()
 * ```
 */
export function useTeacherControls(
  sessionId: Ref<string | null>,
  wsSend?: WSSendFn,
) {
  const isLocked = ref(false)
  const activePage = ref(0)
  const isProcessing = ref(false)
  const lastError = ref<string | null>(null)

  // ── Broadcast helper ────────────────────────────────────────────────

  function broadcast(message: WBSessionMessage): void {
    if (wsSend) {
      try {
        wsSend(message)
      } catch (err) {
        console.warn(`${LOG} WS broadcast failed, message type=${message.type}`, err)
      }
    }
  }

  // ── Lock / Unlock drawing ───────────────────────────────────────────

  /**
   * Lock or unlock student drawing.
   * 1. POST /sessions/{id}/lock/ → persist lock state
   * 2. WS broadcast: { type: 'session.lock', payload: { locked } }
   * 3. Students receive → boardStore.setReadOnly(locked)
   */
  async function lockDrawing(locked: boolean): Promise<boolean> {
    const sid = sessionId.value
    if (!sid) return false

    isProcessing.value = true
    lastError.value = null

    try {
      const result = await winterboardApi.lockSession(sid, locked)
      isLocked.value = result.locked

      broadcast({
        type: 'session.lock',
        payload: { locked: result.locked, locked_by: result.locked_by },
      })

      console.info(`${LOG} Lock ${result.locked ? 'ON' : 'OFF'}`, { sessionId: sid })
      return true
    } catch (err) {
      lastError.value = `Failed to ${locked ? 'lock' : 'unlock'} session`
      console.error(`${LOG} lockDrawing failed`, { sid, locked, err })
      return false
    } finally {
      isProcessing.value = false
    }
  }

  // ── Set active page ─────────────────────────────────────────────────

  /**
   * Broadcast active page change to students.
   * Students in follow-mode auto-navigate to this page.
   * No REST call needed — purely WS broadcast.
   */
  function setActivePage(pageIndex: number): void {
    activePage.value = pageIndex

    broadcast({
      type: 'session.page',
      payload: { pageIndex },
    })

    console.info(`${LOG} Active page set`, { pageIndex })
  }

  // ── Kick student ────────────────────────────────────────────────────

  /**
   * Remove a student from the session.
   * 1. POST /sessions/{id}/kick/{userId}/
   * 2. WS broadcast: { type: 'session.kick', payload: { userId } }
   * 3. Student receives → redirect to lesson page
   */
  async function kickStudent(userId: string): Promise<boolean> {
    const sid = sessionId.value
    if (!sid) return false

    isProcessing.value = true
    lastError.value = null

    try {
      await winterboardApi.kickStudent(sid, userId)

      broadcast({
        type: 'session.kick',
        payload: { userId },
      })

      console.info(`${LOG} Student kicked`, { sessionId: sid, userId })
      return true
    } catch (err) {
      lastError.value = 'Failed to kick student'
      console.error(`${LOG} kickStudent failed`, { sid, userId, err })
      return false
    } finally {
      isProcessing.value = false
    }
  }

  // ── End session ─────────────────────────────────────────────────────

  /**
   * End the classroom session.
   * 1. POST /sessions/{id}/end/
   * 2. WS broadcast: { type: 'session.end' }
   * 3. All students → redirect to lesson page
   * 4. Auto-export session as PDF (triggered server-side)
   */
  async function endSession(): Promise<boolean> {
    const sid = sessionId.value
    if (!sid) return false

    isProcessing.value = true
    lastError.value = null

    try {
      await winterboardApi.endSession(sid)

      broadcast({
        type: 'session.end',
        payload: { sessionId: sid },
      })

      console.info(`${LOG} Session ended`, { sessionId: sid })
      return true
    } catch (err) {
      lastError.value = 'Failed to end session'
      console.error(`${LOG} endSession failed`, { sid, err })
      return false
    } finally {
      isProcessing.value = false
    }
  }

  // ── Init from existing state ────────────────────────────────────────

  function setInitialState(locked: boolean, page: number): void {
    isLocked.value = locked
    activePage.value = page
  }

  function reset(): void {
    isLocked.value = false
    activePage.value = 0
    isProcessing.value = false
    lastError.value = null
  }

  return {
    isLocked: readonly(isLocked),
    activePage: readonly(activePage),
    isProcessing: readonly(isProcessing),
    lastError: readonly(lastError),

    lockDrawing,
    setActivePage,
    kickStudent,
    endSession,
    setInitialState,
    reset,
  }
}
