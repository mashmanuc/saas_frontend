/**
 * Unit Tests for negotiationChatStore v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useNegotiationChatStore } from '../negotiationChatStore'
import * as chatApi from '@/api/negotiationChat'
import type { NegotiationThreadDTO, ChatMessageDTO } from '@/types/inquiries'

vi.mock('@/api/negotiationChat')
vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: (err: any) => { throw err }
}))

describe('negotiationChatStore v0.69', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mockThread: NegotiationThreadDTO = {
    id: 'thread_1',
    inquiryId: 'inq_1',
    readOnly: false,
    participants: [
      { id: 'student_1', firstName: 'John', lastName: 'Doe', role: 'student' },
      { id: 'tutor_1', firstName: 'Jane', lastName: 'Smith', role: 'tutor' }
    ],
    lastMessagePreview: 'Hello'
  }

  const mockMessage: ChatMessageDTO = {
    id: 'msg_1',
    threadId: 'thread_1',
    sender: { id: 'student_1', firstName: 'John', lastName: 'Doe', role: 'student' },
    body: 'Hello, I would like to learn math',
    createdAt: '2024-01-01T10:00:00Z'
  }

  describe('ensureThread', () => {
    it('should create or get thread for inquiry', async () => {
      const store = useNegotiationChatStore()
      vi.mocked(chatApi.ensureNegotiationThread).mockResolvedValue(mockThread)

      const result = await store.ensureThread('inq_1')

      expect(chatApi.ensureNegotiationThread).toHaveBeenCalledWith('inq_1')
      expect(result).toEqual(mockThread)
      expect(store.threads).toContainEqual(mockThread)
    })

    it('should update existing thread', async () => {
      const store = useNegotiationChatStore()
      store.threads = [mockThread]
      
      const updatedThread = { ...mockThread, readOnly: true }
      vi.mocked(chatApi.ensureNegotiationThread).mockResolvedValue(updatedThread)

      await store.ensureThread('inq_1')

      expect(store.threads).toHaveLength(1)
      expect(store.threads[0].readOnly).toBe(true)
    })
  })

  describe('fetchThreads', () => {
    it('should fetch all threads', async () => {
      const store = useNegotiationChatStore()
      vi.mocked(chatApi.fetchThreads).mockResolvedValue([mockThread])

      await store.fetchThreads()

      expect(chatApi.fetchThreads).toHaveBeenCalled()
      expect(store.threads).toEqual([mockThread])
    })
  })

  describe('fetchMessages', () => {
    it('should fetch messages for thread', async () => {
      const store = useNegotiationChatStore()
      const response = {
        messages: [mockMessage],
        hasMore: false
      }
      vi.mocked(chatApi.fetchMessagesLegacy).mockResolvedValue(response)

      const result = await store.fetchMessages('thread_1')

      expect(chatApi.fetchMessagesLegacy).toHaveBeenCalledWith('thread_1', undefined)
      expect(result).toEqual(response)
      expect(store.messagesByThread['thread_1']).toEqual([mockMessage])
    })

    it('should append messages with cursor', async () => {
      const store = useNegotiationChatStore()
      store.messagesByThread = { thread_1: [mockMessage] }

      const newMessage = { ...mockMessage, id: 'msg_2', body: 'Second message' }
      const response = {
        messages: [newMessage],
        hasMore: false
      }
      vi.mocked(chatApi.fetchMessagesLegacy).mockResolvedValue(response)

      await store.fetchMessages('thread_1', 'cursor_1')

      expect(chatApi.fetchMessagesLegacy).toHaveBeenCalledWith('thread_1', 'cursor_1')
      expect(store.messagesByThread['thread_1']).toHaveLength(2)
      expect(store.messagesByThread['thread_1']).toContainEqual(newMessage)
    })
  })

  describe('sendMessage', () => {
    it('should send message with optimistic update', async () => {
      const store = useNegotiationChatStore()
      store.threads = [mockThread]
      
      vi.mocked(chatApi.sendMessage).mockResolvedValue(mockMessage)

      await store.sendMessage('thread_1', 'Hello')

      expect(chatApi.sendMessage).toHaveBeenCalledWith(
        'thread_1',
        expect.objectContaining({
          body: 'Hello',
          clientMessageId: expect.stringMatching(/^msg_/)
        })
      )
      expect(store.messagesByThread['thread_1']).toContainEqual(mockMessage)
    })

    it('should reject send if thread is read-only', async () => {
      const store = useNegotiationChatStore()
      const readOnlyThread = { ...mockThread, readOnly: true }
      store.threads = [readOnlyThread]

      await expect(store.sendMessage('thread_1', 'Hello')).rejects.toThrow('Thread is read-only')
      expect(chatApi.sendMessage).not.toHaveBeenCalled()
    })

    it('should remove optimistic message on error', async () => {
      const store = useNegotiationChatStore()
      store.threads = [mockThread]
      
      vi.mocked(chatApi.sendMessage).mockRejectedValue(new Error('Network error'))

      await expect(store.sendMessage('thread_1', 'Hello')).rejects.toThrow('Network error')
      
      expect(store.messagesByThread['thread_1']).toEqual([])
    })
  })

  describe('activeThread', () => {
    it('should compute active thread', () => {
      const store = useNegotiationChatStore()
      store.threads = [mockThread]
      store.setActiveThread('thread_1')

      expect(store.activeThread).toEqual(mockThread)
    })

    it('should return null if no active thread', () => {
      const store = useNegotiationChatStore()
      store.threads = [mockThread]

      expect(store.activeThread).toBeNull()
    })

    it('should return null if active thread not found', () => {
      const store = useNegotiationChatStore()
      store.threads = [mockThread]
      store.setActiveThread('thread_999')

      expect(store.activeThread).toBeNull()
    })
  })

  describe('setActiveThread', () => {
    it('should set active thread id', () => {
      const store = useNegotiationChatStore()
      
      store.setActiveThread('thread_1')
      
      expect(store.activeThreadId).toBe('thread_1')
    })

    it('should clear active thread', () => {
      const store = useNegotiationChatStore()
      store.setActiveThread('thread_1')
      
      store.setActiveThread(null)
      
      expect(store.activeThreadId).toBeNull()
    })
  })
})
