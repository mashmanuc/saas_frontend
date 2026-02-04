/**
 * Unit Tests for inquiriesStore v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInquiriesStore } from '../inquiriesStore'
import * as inquiriesApi from '@/api/inquiries'
import type { InquiryDTO, UserSummary } from '@/types/inquiries'

vi.mock('@/api/inquiries')
vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: (err: any) => { throw err }
}))

const makeUserSummary = (overrides: Partial<UserSummary> = {}): UserSummary => ({
  id: 'u1',
  firstName: 'Test',
  lastName: 'User',
  role: 'student',
  avatar: null,
  ...overrides
})

describe('inquiriesStore v0.69', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mockInquiry: InquiryDTO = {
    id: 'test-inquiry-uuid-1',
    student: makeUserSummary({ id: '1', firstName: 'John', lastName: 'Doe', role: 'student' }),
    tutor: makeUserSummary({ id: '2', firstName: 'Jane', lastName: 'Smith', role: 'tutor' }),
    message: 'Hello, I would like to learn math',
    status: 'OPEN',
    created_at: '2024-01-01T10:00:00Z'
  }

  describe('fetchInquiries', () => {
    it('should fetch inquiries with filters', async () => {
      const store = useInquiriesStore()
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([mockInquiry])

      await store.fetchInquiries({ role: 'student', status: 'OPEN' })

      expect(inquiriesApi.fetchInquiries).toHaveBeenCalledWith({ role: 'student', status: 'OPEN' })
      expect(store.items).toEqual([mockInquiry])
      expect(store.isLoading).toBe(false)
    })

    it('should handle fetch errors', async () => {
      const store = useInquiriesStore()
      const error = new Error('Network error')
      vi.mocked(inquiriesApi.fetchInquiries).mockRejectedValue(error)

      await expect(store.fetchInquiries()).rejects.toThrow('Network error')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('createInquiry', () => {
    it('should create inquiry with idempotency', async () => {
      const store = useInquiriesStore()
      vi.mocked(inquiriesApi.createInquiry).mockResolvedValue(mockInquiry)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([mockInquiry])

      const result = await store.createInquiry('tutor_1', 'Hello')

      expect(inquiriesApi.createInquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorId: 'tutor_1',
          message: 'Hello',
          clientRequestId: expect.stringMatching(/^req_/)
        })
      )
      expect(result).toEqual(mockInquiry)
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })

    it('should prevent duplicate requests', async () => {
      const store = useInquiriesStore()
      
      // Mock to simulate slow request
      vi.mocked(inquiriesApi.createInquiry).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockInquiry), 100))
      )

      const promise1 = store.createInquiry('tutor_1', 'Hello')
      
      // Should not throw because different clientRequestId
      const promise2 = store.createInquiry('tutor_1', 'Hello')

      await Promise.all([promise1, promise2])
      expect(inquiriesApi.createInquiry).toHaveBeenCalledTimes(2)
    })
  })

  describe('cancelInquiry', () => {
    it('should cancel inquiry and refetch', async () => {
      const store = useInquiriesStore()
      const cancelledInquiry = { ...mockInquiry, status: 'CANCELLED' as const }
      const response = { inquiry: cancelledInquiry, message: 'Cancelled' }
      
      vi.mocked(inquiriesApi.cancelInquiry).mockResolvedValue(response)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([cancelledInquiry])

      await store.cancelInquiry('test-uuid-1')

      expect(inquiriesApi.cancelInquiry).toHaveBeenCalledWith('test-uuid-1')
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('acceptInquiry', () => {
    it('should accept inquiry and refetch', async () => {
      const store = useInquiriesStore()
      const acceptedInquiry = { ...mockInquiry, status: 'ACCEPTED' as const }
      const response = {
        inquiry: acceptedInquiry,
        relation: { id: 'test-relation-uuid-1', chat_unlocked: true, contact_unlocked: true },
        thread_id: 1,
        contacts: { email: 'student@example.com', phone: '', telegram: '' },
        was_already_unlocked: false,
        message: 'Accepted'
      }
      
      vi.mocked(inquiriesApi.acceptInquiry).mockResolvedValue(response)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([acceptedInquiry])

      await store.acceptInquiry('test-uuid-1')

      expect(inquiriesApi.acceptInquiry).toHaveBeenCalledWith('test-uuid-1')
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('rejectInquiry', () => {
    it('should reject inquiry and refetch', async () => {
      const store = useInquiriesStore()
      const rejectedInquiry = { ...mockInquiry, status: 'REJECTED' as const }
      const payload = { reason: 'BUSY' as const, comment: '' }
      const response = { inquiry: rejectedInquiry, message: 'Rejected' }
      
      vi.mocked(inquiriesApi.rejectInquiry).mockResolvedValue(response)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([rejectedInquiry])

      await store.rejectInquiry('test-uuid-1', payload)

      expect(inquiriesApi.rejectInquiry).toHaveBeenCalledWith('test-uuid-1', payload)
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('pendingCount', () => {
    it('should compute pending count correctly', async () => {
      const store = useInquiriesStore()
      const inquiries = [
        { ...mockInquiry, id: 'uuid-1', status: 'OPEN' as const },
        { ...mockInquiry, id: 'uuid-2', status: 'OPEN' as const },
        { ...mockInquiry, id: 'uuid-3', status: 'ACCEPTED' as const }
      ]
      
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue(inquiries)
      await store.fetchInquiries()

      expect(store.pendingCount).toBe(2)
    })
  })

  describe('refetch', () => {
    it('should refetch with status filter', async () => {
      const store = useInquiriesStore()
      store.statusFilter = 'OPEN'
      
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([mockInquiry])

      await store.refetch()

      expect(inquiriesApi.fetchInquiries).toHaveBeenCalledWith({ status: 'OPEN' })
    })

    it('should refetch without filter', async () => {
      const store = useInquiriesStore()
      store.statusFilter = null
      
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([mockInquiry])

      await store.refetch()

      expect(inquiriesApi.fetchInquiries).toHaveBeenCalledWith({})
    })
  })
})
