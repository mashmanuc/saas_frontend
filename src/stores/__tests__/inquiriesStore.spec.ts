/**
 * Unit Tests for inquiriesStore v0.69
 * Based on FRONTEND_IMPLEMENTATION_PLAN_v069.md
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInquiriesStore } from '../inquiriesStore'
import * as inquiriesApi from '@/api/inquiries'
import type { InquiryDTO } from '@/types/inquiries'

vi.mock('@/api/inquiries')
vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: (err: any) => { throw err }
}))

describe('inquiriesStore v0.69', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  const mockInquiry = {
    id: 1,
    student: { id: '1', full_name: 'John Doe', avatar: null },
    tutor: { id: '2', full_name: 'Jane Smith', avatar: null },
    message: 'Hello, I would like to learn math',
    status: 'OPEN' as const,
    created_at: '2024-01-01T10:00:00Z',
    relation: 1,
    initiator_role: 'student' as const
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

      await store.cancelInquiry(1)

      expect(inquiriesApi.cancelInquiry).toHaveBeenCalledWith(1)
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('acceptInquiry', () => {
    it('should accept inquiry and refetch', async () => {
      const store = useInquiriesStore()
      const acceptedInquiry = { ...mockInquiry, status: 'ACCEPTED' as const }
      const response = {
        inquiry: acceptedInquiry,
        relation: { id: 1, chat_unlocked: true, contact_unlocked: true },
        thread_id: 1,
        contacts: { email: 'student@example.com', phone: '', telegram: '' },
        was_already_unlocked: false,
        message: 'Accepted'
      }
      
      vi.mocked(inquiriesApi.acceptInquiry).mockResolvedValue(response)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([acceptedInquiry])

      await store.acceptInquiry(1)

      expect(inquiriesApi.acceptInquiry).toHaveBeenCalledWith(1)
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

      await store.rejectInquiry(1, payload)

      expect(inquiriesApi.rejectInquiry).toHaveBeenCalledWith(1, payload)
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('pendingCount', () => {
    it('should compute pending count correctly', async () => {
      const store = useInquiriesStore()
      const inquiries = [
        { ...mockInquiry, id: 1, status: 'OPEN' as const },
        { ...mockInquiry, id: 2, status: 'OPEN' as const },
        { ...mockInquiry, id: 3, status: 'ACCEPTED' as const }
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
