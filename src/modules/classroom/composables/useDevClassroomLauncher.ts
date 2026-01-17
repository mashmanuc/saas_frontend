import { ref } from 'vue'
import { apiClient } from '@/utils/apiClient'

interface DevSession {
  id: string
  created_at: string
  is_archived: boolean
  is_dev: boolean
  origin: string
}

interface CreateSessionResponse {
  id: string
  uuid: string
  workspace_id: string
  created_at: string
}

interface JoinResponse {
  token: string
  session: any
  participant: any
  permissions: any
  board_state: any
}

export function useDevClassroomLauncher() {
  const sessions = ref<DevSession[]>([])
  const isLoading = ref(false)
  const isCreating = ref(false)
  const isJoining = ref<string | null>(null)
  const isArchiving = ref<string | null>(null)
  const error = ref<string | null>(null)

  async function fetchSessions() {
    isLoading.value = true
    error.value = null

    try {
      const response = await apiClient.get<DevSession[]>('/api/v1/dev/classroom/sessions/', {
        params: { limit: 10 }
      }) as unknown as DevSession[]
      sessions.value = response || []
    } catch (err: any) {
      error.value = err.response?.data?.detail || 'Failed to fetch sessions'
      console.error('[DevClassroomLauncher] fetchSessions error:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function createAndJoinSession(): Promise<string | null> {
    isCreating.value = true
    error.value = null

    try {
      // Create dev session (apiClient auto-unwraps response.data)
      const createResponse = await apiClient.post<CreateSessionResponse>(
        '/api/v1/dev/classroom/sessions/'
      ) as unknown as CreateSessionResponse
      
      if (!createResponse || !createResponse.uuid) {
        throw new Error('Invalid response from server')
      }
      
      const sessionId = createResponse.uuid

      // Join session to get token
      const joinResponse = await apiClient.post<JoinResponse>(
        `/api/v1/classroom/sessions/${sessionId}/join/`
      ) as unknown as JoinResponse

      // Store token in sessionStorage
      const token = joinResponse.token
      sessionStorage.setItem(`devLauncherClassroomToken:${sessionId}`, token)

      // Refresh sessions list
      await fetchSessions()

      return sessionId
    } catch (err: any) {
      error.value = err.response?.data?.detail || 'Failed to create session'
      console.error('[DevClassroomLauncher] createAndJoinSession error:', err)
      return null
    } finally {
      isCreating.value = false
    }
  }

  async function joinSession(sessionId: string): Promise<boolean> {
    isJoining.value = sessionId
    error.value = null

    try {
      const joinResponse = await apiClient.post<JoinResponse>(
        `/api/v1/classroom/sessions/${sessionId}/join/`
      ) as unknown as JoinResponse

      // Store token in sessionStorage
      const token = joinResponse.token
      sessionStorage.setItem(`devLauncherClassroomToken:${sessionId}`, token)

      return true
    } catch (err: any) {
      error.value = err.response?.data?.detail || 'Failed to join session'
      console.error('[DevClassroomLauncher] joinSession error:', err)
      return false
    } finally {
      isJoining.value = null
    }
  }

  async function archiveSession(sessionId: string): Promise<boolean> {
    isArchiving.value = sessionId
    error.value = null

    try {
      await apiClient.patch(`/api/v1/dev/classroom/sessions/${sessionId}/archive/`)
      return true
    } catch (err: any) {
      error.value = err.response?.data?.detail || 'Failed to archive session'
      console.error('[DevClassroomLauncher] archiveSession error:', err)
      return false
    } finally {
      isArchiving.value = null
    }
  }

  return {
    sessions,
    isLoading,
    isCreating,
    isJoining,
    isArchiving,
    error,
    fetchSessions,
    createAndJoinSession,
    joinSession,
    archiveSession
  }
}
