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

  const mockInquiry: InquiryDTO = {
    id: 'inq_1',
    student: { id: 'student_1', firstName: 'John', lastName: 'Doe', role: 'student' },
    tutor: { id: 'tutor_1', firstName: 'Jane', lastName: 'Smith', role: 'tutor' },
    message: 'Hello, I would like to learn math',
    status: 'sent',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z'
  }

  describe('fetchInquiries', () => {
    it('should fetch inquiries with filters', async () => {
      const store = useInquiriesStore()
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([mockInquiry])

      await store.fetchInquiries({ role: 'student', status: 'sent' })

      expect(inquiriesApi.fetchInquiries).toHaveBeenCalledWith({ role: 'student', status: 'sent' })
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
      const cancelledInquiry = { ...mockInquiry, status: 'cancelled' as const }
      
      vi.mocked(inquiriesApi.cancelInquiry).mockResolvedValue(cancelledInquiry)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([cancelledInquiry])

      await store.cancelInquiry('inq_1')

      expect(inquiriesApi.cancelInquiry).toHaveBeenCalledWith(
        'inq_1',
        expect.objectContaining({ clientRequestId: expect.stringMatching(/^req_/) })
      )
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('acceptInquiry', () => {
    it('should accept inquiry and refetch', async () => {
      const store = useInquiriesStore()
      const acceptedInquiry = { ...mockInquiry, status: 'accepted' as const }
      
      vi.mocked(inquiriesApi.acceptInquiry).mockResolvedValue(acceptedInquiry)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([acceptedInquiry])

      await store.acceptInquiry('inq_1')

      expect(inquiriesApi.acceptInquiry).toHaveBeenCalledWith(
        'inq_1',
        expect.objectContaining({ clientRequestId: expect.stringMatching(/^req_/) })
      )
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('declineInquiry', () => {
    it('should decline inquiry and refetch', async () => {
      const store = useInquiriesStore()
      const declinedInquiry = { ...mockInquiry, status: 'declined' as const }
      
      vi.mocked(inquiriesApi.declineInquiry).mockResolvedValue(declinedInquiry)
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([declinedInquiry])

      await store.declineInquiry('inq_1')

      expect(inquiriesApi.declineInquiry).toHaveBeenCalledWith(
        'inq_1',
        expect.objectContaining({ clientRequestId: expect.stringMatching(/^req_/) })
      )
      expect(inquiriesApi.fetchInquiries).toHaveBeenCalled()
    })
  })

  describe('pendingCount', () => {
    it('should compute pending count correctly', async () => {
      const store = useInquiriesStore()
      const inquiries = [
        { ...mockInquiry, id: '1', status: 'sent' as const },
        { ...mockInquiry, id: '2', status: 'sent' as const },
        { ...mockInquiry, id: '3', status: 'accepted' as const }
      ]
      
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue(inquiries)
      await store.fetchInquiries()

      expect(store.pendingCount).toBe(2)
    })
  })

  describe('refetch', () => {
    it('should refetch with status filter', async () => {
      const store = useInquiriesStore()
      store.statusFilter = 'sent'
      
      vi.mocked(inquiriesApi.fetchInquiries).mockResolvedValue([mockInquiry])

      await store.refetch()

      expect(inquiriesApi.fetchInquiries).toHaveBeenCalledWith({ status: 'sent' })
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
