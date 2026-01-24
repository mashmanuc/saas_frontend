import { beforeEach, describe, expect, it, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import type { InquiryDTO } from '@/types/inquiries'

const createInquiryMock = vi.fn()
const fetchInquiriesMock = vi.fn()
const cancelInquiryMock = vi.fn()
const acceptInquiryMock = vi.fn()
const rejectInquiryMock = vi.fn()

vi.mock('@/api/inquiries', () => ({
  createInquiry: (...args: unknown[]) => createInquiryMock(...args),
  fetchInquiries: (...args: unknown[]) => fetchInquiriesMock(...args),
  cancelInquiry: (...args: unknown[]) => cancelInquiryMock(...args),
  acceptInquiry: (...args: unknown[]) => acceptInquiryMock(...args),
  rejectInquiry: (...args: unknown[]) => rejectInquiryMock(...args)
}))

const rethrowMock = vi.fn((err: unknown) => {
  throw err
})

vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: (err: unknown) => rethrowMock(err)
}))

function createInquiry(overrides: Partial<InquiryDTO> = {}): InquiryDTO {
  return {
    id: 1,
    student: { id: '1', full_name: 'John Doe', avatar: null },
    tutor: { id: '2', full_name: 'Jane Smith', avatar: null },
    message: 'Hello',
    status: 'OPEN',
    created_at: '2024-01-01T10:00:00Z',
    ...overrides
  } as InquiryDTO
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

      const result = await store.fetchInquiries({ role: 'student', status: 'OPEN' })

      expect(fetchInquiriesMock).toHaveBeenCalledWith({ role: 'student', status: 'OPEN' })
      expect(result).toEqual([inquiry])
      expect(store.items).toEqual([inquiry])
    })
  })

  describe('cancelInquiry', () => {
    it('calls API and refetches', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry({ status: 'CANCELLED' })
      cancelInquiryMock.mockResolvedValueOnce(inquiry)
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      await store.cancelInquiry(1)

      expect(cancelInquiryMock).toHaveBeenCalledWith(1)
      expect(fetchInquiriesMock).toHaveBeenCalled()
    })
  })

  describe('acceptInquiry', () => {
    it('accepts inquiry and refetches', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry({ status: 'ACCEPTED' })
      acceptInquiryMock.mockResolvedValueOnce(inquiry)
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      await store.acceptInquiry(1)

      expect(acceptInquiryMock).toHaveBeenCalledWith(1)
      expect(fetchInquiriesMock).toHaveBeenCalled()
    })
  })

  describe('rejectInquiry', () => {
    it('rejects inquiry and refetches', async () => {
      const store = useInquiriesStore()
      const inquiry = createInquiry({ status: 'REJECTED' })
      const payload = { reason: 'BUSY' as const, comment: '' }
      rejectInquiryMock.mockResolvedValueOnce({ inquiry, message: 'Rejected' })
      fetchInquiriesMock.mockResolvedValueOnce([inquiry])

      await store.rejectInquiry(1, payload)

      expect(rejectInquiryMock).toHaveBeenCalledWith(1, payload)
      expect(fetchInquiriesMock).toHaveBeenCalled()
    })
  })

  describe('pendingCount', () => {
    it('counts inquiries with OPEN status', async () => {
      const store = useInquiriesStore()
      const items = [
        createInquiry({ id: 1, status: 'OPEN' }),
        createInquiry({ id: 2, status: 'ACCEPTED' }),
        createInquiry({ id: 3, status: 'OPEN' })
      ]
      fetchInquiriesMock.mockResolvedValueOnce(items)

      await store.fetchInquiries()

      expect(store.pendingCount).toBe(2)
    })
  })

  describe('refetch', () => {
    it('uses current status filter', async () => {
      const store = useInquiriesStore()
      store.statusFilter = 'OPEN'
      fetchInquiriesMock.mockResolvedValueOnce([])

      await store.refetch()

      expect(fetchInquiriesMock).toHaveBeenCalledWith({ status: 'OPEN' })
    })
  })
})
