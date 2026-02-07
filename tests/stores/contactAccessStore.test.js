import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useContactAccessStore } from '@/stores/contactAccessStore'
import contactsApi from '@/api/contacts'

vi.mock('@/api/contacts')
vi.mock('@/utils/notify', () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}))

describe('ContactAccessStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('unlockContacts', () => {
    it('should unlock contacts and cache them', async () => {
      const mockUnlockResponse = {
        unlocked: true,
        access_level: 'CONTACTS_SHARED',
        was_already_unlocked: false,
      }
      const mockContactsResponse = {
        contacts: {
          phone: '+380501234567',
          telegram: 'student_tg',
          email: 'student@test.com',
        },
      }

      contactsApi.unlockContacts.mockResolvedValue(mockUnlockResponse)
      contactsApi.getContacts.mockResolvedValue(mockContactsResponse)

      const store = useContactAccessStore()
      await store.unlockContacts({ inquiryId: 456, studentId: 123 })

      expect(contactsApi.unlockContacts).toHaveBeenCalledWith(456, false)
      expect(contactsApi.getContacts).not.toHaveBeenCalled()
      expect(store.hasContactAccess(123)).toBe(true)
      expect(store.getStudentContacts(123)).toEqual(mockContactsResponse.contacts)
      expect(store.getAccessLevel(123)).toBe('CONTACTS_SHARED')
    })

    it('should handle unlock error', async () => {
      const error = {
        response: {
          data: {
            detail: 'Relation must be ACTIVE first',
          },
        },
      }
      contactsApi.unlockContacts.mockRejectedValue(error)

      const store = useContactAccessStore()
      await expect(store.unlockContacts({ inquiryId: 456, studentId: 123 })).rejects.toThrow()
      expect(store.hasContactAccess(123)).toBe(false)
    })
  })

  describe('revokeContacts', () => {
    it('should revoke access and clear cache', async () => {
      const mockUnlockResponse = {
        unlocked: true,
        access_level: 'CONTACTS_SHARED',
        was_already_unlocked: false,
      }
      const mockContactsResponse = {
        contacts: {
          phone: '+380501234567',
          telegram: 'student_tg',
          email: 'student@test.com',
        },
      }

      contactsApi.unlockContacts.mockResolvedValue(mockUnlockResponse)
      contactsApi.getContacts.mockResolvedValue(mockContactsResponse)
      contactsApi.revokeContacts.mockResolvedValue({ revoked: true })

      const store = useContactAccessStore()
      
      // First unlock
      await store.unlockContacts({ inquiryId: 456, studentId: 123 })
      expect(store.hasContactAccess(123)).toBe(true)

      // Then revoke
      await store.revokeContacts({ inquiryId: 456, studentId: 123 }, 'test reason')
      
      expect(contactsApi.revokeContacts).toHaveBeenCalledWith(456, 'test reason')
      expect(store.hasContactAccess(123)).toBe(false)
      expect(store.getStudentContacts(123)).toBeNull()
    })
  })

  describe('fetchContacts', () => {
    it('should fetch and cache contacts', async () => {
      const mockContactsResponse = {
        contacts: {
          phone: '+380501234567',
          telegram: 'student_tg',
          email: 'student@test.com',
        },
      }

      contactsApi.getContacts.mockResolvedValue(mockContactsResponse)

      const store = useContactAccessStore()
      const contacts = await store.fetchContacts(123)

      expect(contacts).toEqual(mockContactsResponse.contacts)
      expect(store.hasContactAccess(123)).toBe(true)
    })

    it('should clear cache on 403 error', async () => {
      const error = {
        response: {
          status: 403,
        },
      }
      contactsApi.getContacts.mockRejectedValue(error)

      const store = useContactAccessStore()
      
      // Set some cached data first
      store.contactsCache.set(123, {
        contacts: { phone: '+380501234567' },
        access_level: 'CONTACTS_SHARED',
      })

      await expect(store.fetchContacts(123)).rejects.toThrow()
      expect(store.hasContactAccess(123)).toBe(false)
    })
  })

  describe('canAccessChat', () => {
    it('should return false for CONTACTS_SHARED level', () => {
      const store = useContactAccessStore()
      store.contactsCache.set(123, {
        contacts: { phone: '+380501234567' },
        access_level: 'CONTACTS_SHARED',
      })

      expect(store.canAccessChat(123)).toBe(false)
    })

    it('should return true for CHAT_ENABLED level', () => {
      const store = useContactAccessStore()
      store.contactsCache.set(123, {
        contacts: { phone: '+380501234567' },
        access_level: 'CHAT_ENABLED',
      })

      expect(store.canAccessChat(123)).toBe(true)
    })

    it('should return false when no access', () => {
      const store = useContactAccessStore()
      expect(store.canAccessChat(123)).toBe(false)
    })
  })

  describe('clearCache', () => {
    it('should clear all cached contacts', () => {
      const store = useContactAccessStore()
      store.contactsCache.set(123, {
        contacts: { phone: '+380501234567' },
        access_level: 'CONTACTS_SHARED',
      })
      store.contactsCache.set(456, {
        contacts: { phone: '+380509876543' },
        access_level: 'CONTACTS_SHARED',
      })

      expect(store.contactsCache.size).toBe(2)
      
      store.clearCache()
      
      expect(store.contactsCache.size).toBe(0)
      expect(store.hasContactAccess(123)).toBe(false)
      expect(store.hasContactAccess(456)).toBe(false)
    })
  })
})
