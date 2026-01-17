import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDevClassroomLauncher } from '../useDevClassroomLauncher'
import { apiClient } from '@/utils/apiClient'

vi.mock('@/utils/apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn()
  }
}))

describe('useDevClassroomLauncher', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
  })

  describe('fetchSessions', () => {
    it('should fetch dev sessions successfully', async () => {
      const mockSessions = [
        {
          id: 'session-1',
          created_at: '2026-01-17T00:00:00Z',
          workspace_id: 'workspace-1',
          is_archived: false,
          is_dev: true,
          origin: 'dev_launcher'
        }
      ]

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockSessions })

      const { sessions, isLoading, error, fetchSessions } = useDevClassroomLauncher()

      await fetchSessions()

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/dev/classroom/sessions/', {
        params: { limit: 10 }
      })
      expect(sessions.value).toEqual(mockSessions)
      expect(isLoading.value).toBe(false)
      expect(error.value).toBeNull()
    })

    it('should handle fetch error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue({
        response: { data: { detail: 'Fetch failed' } }
      })

      const { sessions, error, fetchSessions } = useDevClassroomLauncher()

      await fetchSessions()

      expect(sessions.value).toEqual([])
      expect(error.value).toBe('Fetch failed')
    })
  })

  describe('createAndJoinSession', () => {
    it('should create session and store token', async () => {
      const mockCreateResponse = {
        data: {
          uuid: 'new-session-id',
          id: 'new-session-id',
          workspace_id: 'workspace-id',
          created_at: '2026-01-17T00:00:00Z'
        }
      }

      const mockJoinResponse = {
        data: {
          token: 'test-jwt-token',
          session_id: 'new-session-id'
        }
      }

      vi.mocked(apiClient.post)
        .mockResolvedValueOnce(mockCreateResponse)
        .mockResolvedValueOnce(mockJoinResponse)

      vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

      const { createAndJoinSession } = useDevClassroomLauncher()

      const sessionId = await createAndJoinSession()

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/dev/classroom/sessions/')
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/classroom/session/new-session-id/join/')
      expect(sessionId).toBe('new-session-id')
      expect(sessionStorage.getItem('devLauncherClassroomToken:new-session-id')).toBe('test-jwt-token')
    })

    it('should handle create error', async () => {
      vi.mocked(apiClient.post).mockRejectedValue({
        response: { data: { detail: 'Create failed' } }
      })

      const { error, createAndJoinSession } = useDevClassroomLauncher()

      const result = await createAndJoinSession()

      expect(result).toBeNull()
      expect(error.value).toBe('Create failed')
    })
  })

  describe('joinSession', () => {
    it('should join session and store token', async () => {
      const mockJoinResponse = {
        data: {
          token: 'join-token',
          session_id: 'existing-session'
        }
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockJoinResponse)

      const { joinSession } = useDevClassroomLauncher()

      const success = await joinSession('existing-session')

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/classroom/session/existing-session/join/')
      expect(success).toBe(true)
      expect(sessionStorage.getItem('devLauncherClassroomToken:existing-session')).toBe('join-token')
    })

    it('should handle join error', async () => {
      vi.mocked(apiClient.post).mockRejectedValue({
        response: { data: { detail: 'Join failed' } }
      })

      const { error, joinSession } = useDevClassroomLauncher()

      const success = await joinSession('session-id')

      expect(success).toBe(false)
      expect(error.value).toBe('Join failed')
    })
  })

  describe('archiveSession', () => {
    it('should archive session successfully', async () => {
      vi.mocked(apiClient.patch).mockResolvedValue({ data: {} })

      const { archiveSession } = useDevClassroomLauncher()

      const success = await archiveSession('session-to-archive')

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/dev/classroom/sessions/session-to-archive/archive/')
      expect(success).toBe(true)
    })

    it('should handle archive error', async () => {
      vi.mocked(apiClient.patch).mockRejectedValue({
        response: { data: { detail: 'Archive failed' } }
      })

      const { error, archiveSession } = useDevClassroomLauncher()

      const success = await archiveSession('session-id')

      expect(success).toBe(false)
      expect(error.value).toBe('Archive failed')
    })
  })

  describe('loading states', () => {
    it('should set isCreating during create', async () => {
      vi.mocked(apiClient.post).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: { uuid: 'test' } }), 100))
      )

      const { isCreating, createAndJoinSession } = useDevClassroomLauncher()

      const promise = createAndJoinSession()
      expect(isCreating.value).toBe(true)

      await promise
      expect(isCreating.value).toBe(false)
    })

    it('should set isJoining during join', async () => {
      vi.mocked(apiClient.post).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: { token: 'test' } }), 100))
      )

      const { isJoining, joinSession } = useDevClassroomLauncher()

      const promise = joinSession('test-session')
      expect(isJoining.value).toBe('test-session')

      await promise
      expect(isJoining.value).toBeNull()
    })

    it('should set isArchiving during archive', async () => {
      vi.mocked(apiClient.patch).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
      )

      const { isArchiving, archiveSession } = useDevClassroomLauncher()

      const promise = archiveSession('test-session')
      expect(isArchiving.value).toBe('test-session')

      await promise
      expect(isArchiving.value).toBeNull()
    })
  })
})
