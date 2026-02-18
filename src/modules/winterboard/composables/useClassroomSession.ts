// WB: useClassroomSession — init/manage classroom WB session lifecycle
// Ref: TASK_BOARD_PHASES.md A3.1, C3.1 RBAC, C3.2 classroom-session linking
// Flow: lessonId → getClassroomSession → if 404 + teacher → createClassroomSession → sessionId + role

import { ref, readonly, type Ref } from 'vue'
import { winterboardApi } from '../api/winterboardApi'
import type {
  WBClassroomRole,
  WBClassroomPermissions,
  WBClassroomSessionResponse,
  WBConnectedUser,
} from '../api/winterboardApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const LOG = '[WB:ClassroomSession]'
const USERS_POLL_INTERVAL_MS = 10_000

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ClassroomSessionInit {
  sessionId: string
  role: WBClassroomRole
  permissions: WBClassroomPermissions
  isLocked: boolean
}

export type ClassroomSessionState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'creating'
  | 'error'
  | 'no_access'

// ─── Composable ─────────────────────────────────────────────────────────────

/**
 * Manages classroom WB session initialization and connected users.
 *
 * Usage:
 * ```ts
 * const session = useClassroomSession()
 * const init = await session.initClassroomSession(lessonId)
 * // init.sessionId, init.role, init.permissions
 * ```
 */
export function useClassroomSession() {
  const state = ref<ClassroomSessionState>('idle')
  const sessionId = ref<string | null>(null)
  const role = ref<WBClassroomRole | null>(null)
  const permissions = ref<WBClassroomPermissions | null>(null)
  const isLocked = ref(false)
  const error = ref<string | null>(null)
  const connectedUsers = ref<WBConnectedUser[]>([])

  let usersPollTimer: ReturnType<typeof setInterval> | null = null

  // ── Init session ────────────────────────────────────────────────────

  /**
   * Initialize classroom WB session for a lesson.
   *
   * 1. GET /classroom/{lessonId}/session/ → existing session
   * 2. If 404 → POST (teacher auto-creates)
   * 3. Returns session info with role + permissions
   */
  async function initClassroomSession(lessonId: string): Promise<ClassroomSessionInit | null> {
    state.value = 'loading'
    error.value = null

    try {
      // Try to get existing session
      const response = await winterboardApi.getClassroomSession(lessonId)
      return applyResponse(response)
    } catch (err) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status

      // No session exists yet
      if (status === 404) {
        return await tryCreateSession(lessonId)
      }

      // Access denied
      if (status === 403) {
        state.value = 'no_access'
        error.value = 'You do not have access to this classroom session'
        console.warn(`${LOG} Access denied`, { lessonId })
        return null
      }

      // Auth required
      if (status === 401) {
        state.value = 'error'
        error.value = 'Authentication required'
        return null
      }

      state.value = 'error'
      error.value = (err as Error)?.message || 'Failed to load classroom session'
      console.error(`${LOG} initClassroomSession failed`, { lessonId, err })
      return null
    }
  }

  async function tryCreateSession(lessonId: string): Promise<ClassroomSessionInit | null> {
    state.value = 'creating'

    try {
      const response = await winterboardApi.createClassroomSession(lessonId)
      console.info(`${LOG} Session created`, { lessonId, sessionId: response.session_id })
      return applyResponse(response)
    } catch (err) {
      const status = (err as Record<string, Record<string, number>>)?.response?.status

      if (status === 403) {
        // Student can't create — session doesn't exist yet
        state.value = 'error'
        error.value = 'Session not started yet. Waiting for teacher.'
        console.info(`${LOG} Student waiting for teacher`, { lessonId })
        return null
      }

      state.value = 'error'
      error.value = (err as Error)?.message || 'Failed to create session'
      console.error(`${LOG} createClassroomSession failed`, { lessonId, err })
      return null
    }
  }

  function applyResponse(response: WBClassroomSessionResponse): ClassroomSessionInit {
    sessionId.value = response.session_id
    role.value = response.role
    permissions.value = response.permissions
    isLocked.value = response.is_locked
    state.value = 'ready'

    console.info(`${LOG} Session ready`, {
      sessionId: response.session_id,
      role: response.role,
      isLocked: response.is_locked,
    })

    return {
      sessionId: response.session_id,
      role: response.role,
      permissions: response.permissions,
      isLocked: response.is_locked,
    }
  }

  // ── Connected users polling ─────────────────────────────────────────

  async function fetchConnectedUsers(): Promise<void> {
    const sid = sessionId.value
    if (!sid) return

    try {
      connectedUsers.value = await winterboardApi.getConnectedUsers(sid)
    } catch (err) {
      console.warn(`${LOG} fetchConnectedUsers failed`, { err })
    }
  }

  function startUserPolling(): void {
    stopUserPolling()
    fetchConnectedUsers()
    usersPollTimer = setInterval(fetchConnectedUsers, USERS_POLL_INTERVAL_MS)
  }

  function stopUserPolling(): void {
    if (usersPollTimer !== null) {
      clearInterval(usersPollTimer)
      usersPollTimer = null
    }
  }

  // ── Lock state ──────────────────────────────────────────────────────

  function setLocked(locked: boolean): void {
    isLocked.value = locked
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  function reset(): void {
    stopUserPolling()
    state.value = 'idle'
    sessionId.value = null
    role.value = null
    permissions.value = null
    isLocked.value = false
    error.value = null
    connectedUsers.value = []
  }

  return {
    state: readonly(state),
    sessionId: readonly(sessionId),
    role: readonly(role),
    permissions: readonly(permissions),
    isLocked: readonly(isLocked),
    error: readonly(error),
    connectedUsers: readonly(connectedUsers),

    initClassroomSession,
    fetchConnectedUsers,
    startUserPolling,
    stopUserPolling,
    setLocked,
    reset,
  }
}
