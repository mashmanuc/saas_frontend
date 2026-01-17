// F2: Classroom Route Guard
import type { NavigationGuardNext, RouteLocationNormalized } from 'vue-router'
import { classroomApi } from '@/modules/classroom/api/classroom'
import { useRoomStore } from '@/modules/classroom/stores/roomStore'

/**
 * Route guard for classroom routes.
 * Ensures user has valid JWT token before entering classroom.
 */
export async function classroomGuard(
  to: RouteLocationNormalized,
  from: RouteLocationNormalized,
  next: NavigationGuardNext
): Promise<void> {
  const sessionId = to.params.sessionId as string
  const roomStore = useRoomStore()

  // Check if token already in query
  let token = to.query.token as string | undefined

  if (!token) {
    // Check for dev launcher token in sessionStorage
    const devToken = sessionStorage.getItem(`devLauncherClassroomToken:${sessionId}`)
    
    if (devToken) {
      // Use dev launcher token
      return next({
        ...to,
        query: { ...to.query, token: devToken },
      })
    }

    try {
      // Fetch JWT from backend
      const response = await classroomApi.getJwt(sessionId)
      token = response.token

      // Store session data
      roomStore.setSessionData(response.session, response.permissions)

      // Redirect with token in query (prevents re-fetch on refresh)
      return next({
        ...to,
        query: { ...to.query, token },
      })
    } catch (error) {
      console.error('[classroomGuard] Failed to get classroom JWT:', error)
      return next({
        name: 'dashboard',
        query: { error: 'classroom_access_denied' },
      })
    }
  }

  // Validate existing token
  try {
    const isValid = roomStore.validateToken(token)

    if (!isValid) {
      // Token expired, refresh
      const response = await classroomApi.getJwt(sessionId)
      roomStore.setSessionData(response.session, response.permissions)

      return next({
        ...to,
        query: { ...to.query, token: response.token },
      })
    }
  } catch {
    return next({
      name: 'dashboard',
      query: { error: 'classroom_token_invalid' },
    })
  }

  next()
}

export default classroomGuard
