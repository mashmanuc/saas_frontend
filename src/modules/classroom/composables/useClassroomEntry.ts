// F1: Classroom Entry composable
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { classroomApi } from '../api/classroom'
import { useRoomStore } from '../stores/roomStore'

export function useClassroomEntry() {
  const router = useRouter()
  const roomStore = useRoomStore()

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  /**
   * Get JWT token and navigate to classroom
   */
  async function getJwtAndNavigate(sessionId: string): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await classroomApi.getJwt(sessionId)

      // Store session data in store
      roomStore.setSessionData(response.session, response.permissions)

      // Navigate to classroom with token
      router.push({
        name: 'classroom',
        params: { sessionId },
        query: { token: response.token },
      })
    } catch (err) {
      console.error('[useClassroomEntry] Failed to get JWT:', err)
      error.value = err instanceof Error ? err.message : 'Failed to join classroom'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Check if user can join the session
   */
  function canJoinSession(
    status: string,
    scheduledStart?: string
  ): { canJoin: boolean; reason?: string } {
    // Can join if active or waiting
    if (status === 'active' || status === 'waiting') {
      return { canJoin: true }
    }

    // Can join scheduled session within 15 minutes of start
    if (status === 'scheduled' && scheduledStart) {
      const startTime = new Date(scheduledStart).getTime()
      const now = Date.now()
      const fifteenMinutes = 15 * 60 * 1000

      if (startTime - now <= fifteenMinutes) {
        return { canJoin: true }
      }

      return {
        canJoin: false,
        reason: 'Session has not started yet',
      }
    }

    // Cannot join completed or terminated sessions
    if (status === 'completed') {
      return { canJoin: false, reason: 'Session has ended' }
    }

    if (status === 'terminated') {
      return { canJoin: false, reason: 'Session was cancelled' }
    }

    return { canJoin: false, reason: 'Cannot join session' }
  }

  return {
    isLoading,
    error,
    getJwtAndNavigate,
    canJoinSession,
  }
}
