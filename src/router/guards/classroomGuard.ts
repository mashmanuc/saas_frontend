// F2: Classroom Route Guard
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { classroomApi } from '@/modules/classroom/api/classroom'
import { useRoomStore } from '@/modules/classroom/stores/roomStore'

/**
 * v0.92.2: Classroom Route Guard - deterministic join (1 max)
 * Invariant: token ONLY in sessionStorage, NEVER in URL
 * 
 * Flow:
 * 1. Check sessionStorage for token
 * 2. If no token -> ONE POST /join/, save to sessionStorage
 * 3. If 401/403 -> redirect to dashboard (no spam)
 */
export async function classroomGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const sessionId = to.params.sessionId as string
  const roomStore = useRoomStore()

  // v0.92.2: Check sessionStorage ONLY (no URL token)
  let token = sessionStorage.getItem(`devLauncherClassroomToken:${sessionId}`)

  if (!token) {
    // No token in sessionStorage -> fetch from backend (ONE time)
    try {
      const response = await classroomApi.getJwt(sessionId)
      token = response.token

      // Store in sessionStorage for future navigations
      sessionStorage.setItem(`devLauncherClassroomToken:${sessionId}`, token)

      // Store session data
      roomStore.setSessionData(response.session, response.permissions)
    } catch (error: any) {
      const status = error?.response?.status
      console.error('[classroomGuard] Failed to get classroom JWT:', error)
      
      // v0.92.2: No retry, no spam - just redirect
      return next({
        name: 'dashboard',
        query: { error: status === 403 ? 'classroom_forbidden' : 'classroom_access_denied' },
      })
    }
  }

  // Token exists in sessionStorage - proceed
  next()
}

export default classroomGuard
