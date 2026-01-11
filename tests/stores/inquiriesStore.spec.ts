import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import type { InquiryDTO } from '@/types/inquiries'

const createInquiryMock = vi.fn()
const fetchInquiriesMock = vi.fn()
const cancelInquiryMock = vi.fn()
const acceptInquiryMock = vi.fn()
const declineInquiryMock = vi.fn()

vi.mock('@/api/inquiries', () => ({
  createInquiry: (...args: unknown[]) => createInquiryMock(...args),
  fetchInquiries: (...args: unknown[]) => fetchInquiriesMock(...args),
  cancelInquiry: (...args: unknown[]) => cancelInquiryMock(...args),
  acceptInquiry: (...args: unknown[]) => acceptInquiryMock(...args),
  declineInquiry: (...args: unknown[]) => declineInquiryMock(...args)
}))

const rethrowMock = vi.fn((err: unknown) => {
  throw err
})

vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: (err: unknown) => rethrowMock(err)
}))

function createInquiry(overrides: Partial<InquiryDTO> = {}): InquiryDTO {
  return {
    id: 'inq_1',
    student: { id: 'student_1', firstName: 'John', lastName: 'Doe', role: 'student' },
    tutor: { id: 'tutor_1', firstName: 'Jane', lastName: 'Smith', role: 'tutor' },
    message: 'Hello',
    status: 'sent',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:00:00Z',
    ...overrides
  }
}

describe('inquiriesStore (legacy tests updated for v0.69)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    fetchInquiriesMock.mockResolvedValue([])
    rethrowMock.mockImplementation((err: unknown) => {
      throw err
    })
  })

  describe('createInquiry', () => {
    it('calls API with idempotency payload and refetches', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry()
      createInquiryMock.mockResolvedValueOnce(inquiry)
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      const result = await store.createInquiry('tutor_1', 'Hi')

      expect(createInquiryMock).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorId: 'tutor_1',
          message: 'Hi',
          clientRequestId: expect.stringMatching(/^req_/)
        })
      )
      expect(result).toEqual(inquiry)
      expect(fetchInquiriesMock).toHaveBeenCalled()
    })

    it('rethrows domain errors via helper', async () => {
      const store = useInquiriesStore()
      const error = new Error('domain')
      createInquiryMock.mockRejectedValueOnce(error)

      await expect(store.createInquiry('tutor_1', 'Hello')).rejects.toThrow('domain')
    })
  })

  describe('fetchInquiries', () => {
    it('loads inquiries with filters', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry()
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      const result = await store.fetchInquiries({ role: 'student', status: 'sent' })

      expect(fetchInquiriesMock).toHaveBeenCalledWith({ role: 'student', status: 'sent' })
      expect(result).toEqual([inquiry])
      expect(store.items).toEqual([inquiry])
    })
  })

  describe('cancelInquiry', () => {
    it('calls API and refetches', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry({ status: 'cancelled' })
      cancelInquiryMock.mockResolvedValueOnce(inquiry)
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      await store.cancelInquiry('inq_1')

      expect(cancelInquiryMock).toHaveBeenCalledWith(
        'inq_1',
        expect.objectContaining({ clientRequestId: expect.any(String) })
      )
      expect(fetchInquiriesMock).toHaveBeenCalled()
    })
  })

  describe('acceptInquiry', () => {
    it('accepts inquiry and refetches', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry({ status: 'accepted' })
      acceptInquiryMock.mockResolvedValueOnce(inquiry)
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      await store.acceptInquiry('inq_1')

      expect(acceptInquiryMock).toHaveBeenCalledWith(
        'inq_1',
        expect.objectContaining({ clientRequestId: expect.any(String) })
      )
      expect(fetchInquiriesMock).toHaveBeenCalled()
    })
  })

  describe('declineInquiry', () => {
    it('declines inquiry and refetches', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry({ status: 'declined' })
      declineInquiryMock.mockResolvedValueOnce(inquiry)
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      await store.declineInquiry('inq_1')

      expect(declineInquiryMock).toHaveBeenCalledWith(
        'inq_1',
        expect.objectContaining({ clientRequestId: expect.any(String) })
      )
      expect(fetchInquiriesMock).toHaveBeenCalled()
    })
  })

  describe('pendingCount', () => {
    it('counts inquiries with sent status', async () => {
      const store = useInquiriesStore()
      const items = [
        createInquiry({ id: '1', status: 'sent' }),
        createInquiry({ id: '2', status: 'accepted' }),
        createInquiry({ id: '3', status: 'sent' })
      ]
      fetchInquiriesMock.mockResolvedValueOnce(items)

      await store.fetchInquiries()

      expect(store.pendingCount).toBe(2)
    })
  })

  describe('refetch', () => {
    it('uses current status filter', async () => {
      const store = useInquiriesStore()
      store.statusFilter = 'sent'
      fetchInquiriesMock.mockResolvedValueOnce([])

      await store.refetch()

      expect(fetchInquiriesMock).toHaveBeenCalledWith({ status: 'sent' })
    })
  })
})
