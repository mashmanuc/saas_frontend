// Tests for useClassroomEntry composable
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'

// Mock dependencies
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}))

vi.mock('@/modules/classroom/api/classroom', () => ({
  classroomApi: {
    getJwt: vi.fn(),
  },
}))

vi.mock('@/modules/classroom/stores/roomStore', () => ({
  useRoomStore: () => ({
    setSessionData: vi.fn(),
  }),
}))

import { useClassroomEntry } from '@/modules/classroom/composables/useClassroomEntry'
import { classroomApi } from '@/modules/classroom/api/classroom'

describe('useClassroomEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('canJoinSession', () => {
    it('should return canJoin: true for active session', () => {
      const { canJoinSession } = useClassroomEntry()
      expect(canJoinSession('active').canJoin).toBe(true)
    })

    it('should return canJoin: true for waiting session', () => {
      const { canJoinSession } = useClassroomEntry()
      expect(canJoinSession('waiting').canJoin).toBe(true)
    })

    it('should return canJoin: true for scheduled session within 15 minutes', () => {
      const { canJoinSession } = useClassroomEntry()
      const scheduledStart = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min from now
      expect(canJoinSession('scheduled', scheduledStart).canJoin).toBe(true)
    })

    it('should return canJoin: false for scheduled session more than 15 minutes away', () => {
      const { canJoinSession } = useClassroomEntry()
      const scheduledStart = new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min from now
      const result = canJoinSession('scheduled', scheduledStart)
      expect(result.canJoin).toBe(false)
      expect(result.reason).toBeDefined()
    })

    it('should return canJoin: false for completed session', () => {
      const { canJoinSession } = useClassroomEntry()
      const result = canJoinSession('completed')
      expect(result.canJoin).toBe(false)
      expect(result.reason).toBe('Session has ended')
    })

    it('should return canJoin: false for terminated session', () => {
      const { canJoinSession } = useClassroomEntry()
      const result = canJoinSession('terminated')
      expect(result.canJoin).toBe(false)
      expect(result.reason).toBe('Session was cancelled')
    })
  })

  describe('getJwtAndNavigate', () => {
    it('should fetch JWT and navigate to lesson room', async () => {
      const mockResponse = {
        token: 'test-jwt-token',
        session: { uuid: 'session-123' },
        permissions: { can_draw: true },
      }
      vi.mocked(classroomApi.getJwt).mockResolvedValue(mockResponse)

      const { getJwtAndNavigate, isLoading } = useClassroomEntry()

      expect(isLoading.value).toBe(false)

      const promise = getJwtAndNavigate('session-123')
      expect(isLoading.value).toBe(true)

      await promise
      expect(isLoading.value).toBe(false)
      expect(classroomApi.getJwt).toHaveBeenCalledWith('session-123')
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(classroomApi.getJwt).mockRejectedValue(new Error('Network error'))

      const { getJwtAndNavigate, isLoading } = useClassroomEntry()

      // Should not throw, error is handled internally
      try {
        await getJwtAndNavigate('session-123')
      } catch {
        // Expected to catch or handle internally
      }

      expect(isLoading.value).toBe(false)
    })
  })
})
