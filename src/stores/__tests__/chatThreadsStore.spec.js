import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatThreadsStore } from '../chatThreadsStore'
import apiClient from '@/utils/apiClient'

vi.mock('@/utils/apiClient')
vi.mock('@/utils/notify', () => ({
  notifyError: vi.fn()
}))

describe('chatThreadsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('ensureThread', () => {
    it('should create new thread and cache it', async () => {
      const store = useChatThreadsStore()
      const mockThreadId = '550e8400-e29b-41d4-a716-446655440000'
      
      apiClient.post.mockResolvedValueOnce({
        thread_id: mockThreadId,
        kind: 'contact',
        relation_id: 42,
        student_id: 123,
        is_writable: true
      })

      const threadId = await store.ensureThread(123, 42)

      expect(threadId).toBe(mockThreadId)
      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/chat/threads/negotiation/', {
        relation_id: 42
      })
      expect(store.threadsByStudent.get(123)).toEqual({
        threadId: mockThreadId,
        kind: 'contact',
        lastSync: expect.any(String)
      })
    })

    it('should return cached thread if valid', async () => {
      const store = useChatThreadsStore()
      const mockThreadId = '550e8400-e29b-41d4-a716-446655440000'
      
      // Set up cache
      store.threadsByStudent.set(123, {
        threadId: mockThreadId,
        kind: 'contact',
        lastSync: new Date().toISOString()
      })

      // Mock verification call
      apiClient.get.mockResolvedValueOnce({ messages: [] })

      const threadId = await store.ensureThread(123, 42)

      expect(threadId).toBe(mockThreadId)
      expect(apiClient.get).toHaveBeenCalledWith(`/api/v1/chat/threads/${mockThreadId}/messages/`)
      expect(apiClient.post).not.toHaveBeenCalled()
    })

    it('should recreate thread if cache is stale', async () => {
      const store = useChatThreadsStore()
      const oldThreadId = '550e8400-e29b-41d4-a716-446655440000'
      const newThreadId = '660e8400-e29b-41d4-a716-446655440001'
      
      // Set up stale cache
      store.threadsByStudent.set(123, {
        threadId: oldThreadId,
        kind: 'contact',
        lastSync: new Date().toISOString()
      })

      // Mock verification failure and new thread creation
      apiClient.get.mockRejectedValueOnce(new Error('Thread not found'))
      apiClient.post.mockResolvedValueOnce({
        thread_id: newThreadId,
        kind: 'contact',
        relation_id: 42,
        student_id: 123,
        is_writable: true
      })

      const threadId = await store.ensureThread(123, 42)

      expect(threadId).toBe(newThreadId)
      expect(store.threadsByStudent.get(123).threadId).toBe(newThreadId)
    })

    it('should throw error if thread creation fails', async () => {
      const store = useChatThreadsStore()
      
      apiClient.post.mockRejectedValueOnce({
        response: {
          data: {
            error: {
              message: 'Contact access required'
            }
          }
        }
      })

      await expect(store.ensureThread(123, 42)).rejects.toThrow()
      expect(store.error).toBe('Contact access required')
    })
  })

  describe('fetchUnreadSummary', () => {
    it('should fetch and cache unread summary', async () => {
      const store = useChatThreadsStore()
      const mockSummary = {
        threads: [
          {
            thread_id: '550e8400-e29b-41d4-a716-446655440000',
            kind: 'contact',
            other_user_id: 123,
            other_user_name: 'John Doe',
            last_message_preview: 'Hello!',
            last_message_at: '2026-02-04T00:00:00Z',
            unread_count: 3
          }
        ],
        total: 3
      }

      apiClient.get.mockResolvedValueOnce(mockSummary)

      await store.fetchUnreadSummary()

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/chat/unread-summary/')
      expect(store.unreadSummary).toEqual(mockSummary)
      expect(store.threadsByStudent.get(123)).toEqual({
        threadId: '550e8400-e29b-41d4-a716-446655440000',
        kind: 'contact',
        lastSync: expect.any(String)
      })
    })

    it('should handle empty unread summary', async () => {
      const store = useChatThreadsStore()
      
      apiClient.get.mockResolvedValueOnce({ threads: [], total: 0 })

      await store.fetchUnreadSummary()

      expect(store.unreadSummary.total).toBe(0)
      expect(store.unreadSummary.threads).toEqual([])
    })

    it('should not throw on fetch error', async () => {
      const store = useChatThreadsStore()
      
      apiClient.get.mockRejectedValueOnce(new Error('Network error'))

      await expect(store.fetchUnreadSummary()).resolves.toBeUndefined()
    })
  })

  describe('markThreadRead', () => {
    it('should mark thread as read and update local state', async () => {
      const store = useChatThreadsStore()
      const threadId = '550e8400-e29b-41d4-a716-446655440000'
      
      store.unreadSummary = {
        threads: [
          {
            thread_id: threadId,
            other_user_id: 123,
            unread_count: 3
          },
          {
            thread_id: '660e8400-e29b-41d4-a716-446655440001',
            other_user_id: 456,
            unread_count: 2
          }
        ],
        total: 5
      }

      apiClient.post.mockResolvedValueOnce({})

      await store.markThreadRead(threadId)

      expect(apiClient.post).toHaveBeenCalledWith(
        `/api/v1/chat/threads/${threadId}/mark-read/`,
        {}
      )
      expect(store.unreadSummary.threads).toHaveLength(1)
      expect(store.unreadSummary.total).toBe(2)
    })
  })

  describe('getters', () => {
    it('getThreadIdByStudent should return cached threadId', () => {
      const store = useChatThreadsStore()
      const threadId = '550e8400-e29b-41d4-a716-446655440000'
      
      store.threadsByStudent.set(123, {
        threadId,
        kind: 'contact',
        lastSync: new Date().toISOString()
      })

      expect(store.getThreadIdByStudent(123)).toBe(threadId)
      expect(store.getThreadIdByStudent(456)).toBeNull()
    })

    it('getUnreadCount should return unread count for student', () => {
      const store = useChatThreadsStore()
      
      store.unreadSummary = {
        threads: [
          { other_user_id: 123, unread_count: 5 },
          { other_user_id: 456, unread_count: 2 }
        ],
        total: 7
      }

      expect(store.getUnreadCount(123)).toBe(5)
      expect(store.getUnreadCount(456)).toBe(2)
      expect(store.getUnreadCount(789)).toBe(0)
    })

    it('totalUnread should return total unread count', () => {
      const store = useChatThreadsStore()
      
      store.unreadSummary = {
        threads: [],
        total: 42
      }

      expect(store.totalUnread).toBe(42)
    })
  })

  describe('clearCache', () => {
    it('should clear all cached data', () => {
      const store = useChatThreadsStore()
      
      store.threadsByStudent.set(123, { threadId: 'abc', kind: 'contact' })
      store.unreadSummary = { threads: [{ unread_count: 5 }], total: 5 }
      store.error = 'Some error'

      store.clearCache()

      expect(store.threadsByStudent.size).toBe(0)
      expect(store.unreadSummary).toEqual({ threads: [], total: 0 })
      expect(store.error).toBeNull()
    })
  })

  describe('removeThread', () => {
    it('should remove thread from cache and unread summary', () => {
      const store = useChatThreadsStore()
      
      store.threadsByStudent.set(123, { threadId: 'abc', kind: 'contact' })
      store.unreadSummary = {
        threads: [
          { other_user_id: 123, unread_count: 3 },
          { other_user_id: 456, unread_count: 2 }
        ],
        total: 5
      }

      store.removeThread(123)

      expect(store.threadsByStudent.has(123)).toBe(false)
      expect(store.unreadSummary.threads).toHaveLength(1)
      expect(store.unreadSummary.total).toBe(2)
    })
  })
})
