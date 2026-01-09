import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useInquiriesStore } from '@/stores/inquiriesStore'
import type { InquiryDTO, ContactPayload } from '@/types/inquiries'
import {
  InquiryAlreadyExistsError,
  InquiryNotAllowedError,
  ContactLockedError
} from '@/utils/errors'

const createInquiryMock = vi.fn()
const listInquiriesMock = vi.fn()
const acceptInquiryMock = vi.fn()
const rejectInquiryMock = vi.fn()
const getContactMock = vi.fn()
const rethrowMock = vi.fn((err: unknown) => {
  throw err
})

vi.mock('@/api/inquiries', () => ({
  createInquiry: (...args: unknown[]) => createInquiryMock(...args),
  listInquiries: (...args: unknown[]) => listInquiriesMock(...args),
  acceptInquiry: (...args: unknown[]) => acceptInquiryMock(...args),
  rejectInquiry: (...args: unknown[]) => rejectInquiryMock(...args)
}))

vi.mock('@/api/users', () => ({
  getContact: (...args: unknown[]) => getContactMock(...args)
}))

vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: (err: unknown) => rethrowMock(err)
}))

function createMockInquiry(overrides: Partial<InquiryDTO> = {}): InquiryDTO {
  return {
    id: 'inq-1',
    relation_id: 'rel-1',
    initiator_role: 'student',
    status: 'OPEN',
    message: 'Test message',
    created_at: '2025-01-01T00:00:00Z',
    resolved_at: null,
    expires_at: null,
    ...overrides
  }
}

describe('inquiriesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    rethrowMock.mockImplementation((err: unknown) => {
      throw err
    })
  })

  describe('requestContact', () => {
    it('creates inquiry and updates local state', async () => {
      const inquiry = createMockInquiry()
      createInquiryMock.mockResolvedValueOnce(inquiry)

      const store = useInquiriesStore()
      const result = await store.requestContact('rel-1', 'Test message')

      expect(createInquiryMock).toHaveBeenCalledWith({
        relation_id: 'rel-1',
        message: 'Test message'
      })
      expect(result).toEqual(inquiry)
      expect(store.inquiriesByRelationId['rel-1']).toHaveLength(1)
      expect(store.inquiriesByRelationId['rel-1'][0]).toEqual(inquiry)
    })

    it('handles InquiryAlreadyExistsError through rethrowAsDomainError', async () => {
      const error = new InquiryAlreadyExistsError({ relation_id: 'rel-1' })
      createInquiryMock.mockRejectedValueOnce(new Error('test'))
      rethrowMock.mockImplementationOnce(() => {
        throw error
      })

      const store = useInquiriesStore()

      await expect(store.requestContact('rel-1', 'Test')).rejects.toBe(error)
      expect(store.createInquiryError).toBeTruthy()
    })

    it('sets error state on failure', async () => {
      createInquiryMock.mockRejectedValueOnce(new Error('Network error'))

      const store = useInquiriesStore()

      await expect(store.requestContact('rel-1', 'Test')).rejects.toThrow()
      expect(store.createInquiryError).toBe('Network error')
      expect(store.isCreatingInquiry).toBe(false)
    })
  })

  describe('loadInquiries', () => {
    it('loads inquiries for relation', async () => {
      const inquiries = [
        createMockInquiry({ id: 'inq-1' }),
        createMockInquiry({ id: 'inq-2' })
      ]
      listInquiriesMock.mockResolvedValueOnce(inquiries)

      const store = useInquiriesStore()
      const result = await store.loadInquiries('rel-1')

      expect(listInquiriesMock).toHaveBeenCalledWith('rel-1')
      expect(result).toEqual(inquiries)
      expect(store.inquiriesByRelationId['rel-1']).toEqual(inquiries)
    })

    it('handles errors gracefully', async () => {
      listInquiriesMock.mockRejectedValueOnce(new Error('Load failed'))

      const store = useInquiriesStore()

      await expect(store.loadInquiries('rel-1')).rejects.toThrow()
      expect(store.loadInquiriesError).toBe('Load failed')
    })
  })

  describe('acceptInquiry', () => {
    it('accepts inquiry and updates local state', async () => {
      const inquiry = createMockInquiry({ status: 'ACCEPTED', resolved_at: '2025-01-02T00:00:00Z' })
      acceptInquiryMock.mockResolvedValueOnce(inquiry)

      const store = useInquiriesStore()
      store.inquiriesByRelationId['rel-1'] = [createMockInquiry()]

      const result = await store.acceptInquiry('inq-1')

      expect(acceptInquiryMock).toHaveBeenCalledWith('inq-1')
      expect(result).toEqual(inquiry)
      expect(store.inquiriesByRelationId['rel-1'][0]).toEqual(inquiry)
    })

    it('handles errors through rethrowAsDomainError', async () => {
      acceptInquiryMock.mockRejectedValueOnce(new Error('test'))

      const store = useInquiriesStore()

      await expect(store.acceptInquiry('inq-1')).rejects.toThrow()
      expect(store.acceptInquiryError).toBeTruthy()
    })
  })

  describe('rejectInquiry', () => {
    it('rejects inquiry and updates local state', async () => {
      const inquiry = createMockInquiry({ status: 'REJECTED', resolved_at: '2025-01-02T00:00:00Z' })
      rejectInquiryMock.mockResolvedValueOnce(inquiry)

      const store = useInquiriesStore()
      store.inquiriesByRelationId['rel-1'] = [createMockInquiry()]

      const result = await store.rejectInquiry('inq-1')

      expect(rejectInquiryMock).toHaveBeenCalledWith('inq-1')
      expect(result).toEqual(inquiry)
      expect(store.inquiriesByRelationId['rel-1'][0]).toEqual(inquiry)
    })
  })

  describe('loadContact', () => {
    it('loads contact and stores in cache', async () => {
      const contact: ContactPayload = {
        email: 'test@example.com',
        phone: '+380123456789',
        telegram: '@test',
        locked_reason: null
      }
      getContactMock.mockResolvedValueOnce(contact)

      const store = useInquiriesStore()
      const result = await store.loadContact('user-1')

      expect(getContactMock).toHaveBeenCalledWith('user-1')
      expect(result).toEqual(contact)
      expect(store.contactByUserId['user-1']).toEqual(contact)
    })

    it('loads locked contact with reason', async () => {
      const contact: ContactPayload = {
        email: null,
        phone: null,
        telegram: null,
        locked_reason: 'inquiry_required'
      }
      getContactMock.mockResolvedValueOnce(contact)

      const store = useInquiriesStore()
      const result = await store.loadContact('user-1')

      expect(result.locked_reason).toBe('inquiry_required')
      expect(result.email).toBeNull()
    })

    it('handles ContactLockedError through rethrowAsDomainError', async () => {
      const error = new ContactLockedError({ locked_reason: 'forbidden' })
      getContactMock.mockRejectedValueOnce(new Error('test'))
      rethrowMock.mockImplementationOnce(() => {
        throw error
      })

      const store = useInquiriesStore()

      await expect(store.loadContact('user-1')).rejects.toBe(error)
      expect(store.loadContactError).toBeTruthy()
    })
  })

  describe('getters', () => {
    it('getInquiriesForRelation returns cached inquiries', () => {
      const store = useInquiriesStore()
      const inquiries = [createMockInquiry()]
      store.inquiriesByRelationId['rel-1'] = inquiries

      expect(store.getInquiriesForRelation('rel-1')).toEqual(inquiries)
      expect(store.getInquiriesForRelation('rel-2')).toEqual([])
    })

    it('getContactForUser returns cached contact', () => {
      const store = useInquiriesStore()
      const contact: ContactPayload = {
        email: 'test@example.com',
        phone: null,
        telegram: null,
        locked_reason: null
      }
      store.contactByUserId['user-1'] = contact

      expect(store.getContactForUser('user-1')).toEqual(contact)
      expect(store.getContactForUser('user-2')).toBeNull()
    })
  })
})
