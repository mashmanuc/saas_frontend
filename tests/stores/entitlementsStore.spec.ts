/**
 * Unit tests for entitlementsStore (v0.63.0)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEntitlementsStore } from '@/stores/entitlementsStore'
import entitlementsApi from '@/api/entitlements'
import type { EntitlementsDTO } from '@/types/entitlements'

vi.mock('@/api/entitlements', () => ({
  default: {
    getEntitlements: vi.fn()
  }
}))

vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: vi.fn((err) => {
    throw err
  })
}))

describe('entitlementsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('has correct default values', () => {
      const store = useEntitlementsStore()
      
      expect(store.plan).toBe('FREE')
      expect(store.features).toEqual([])
      expect(store.expiresAt).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('loadEntitlements', () => {
    it('loads entitlements successfully', async () => {
      const mockDTO: EntitlementsDTO = {
        plan: 'PRO',
        features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
        expires_at: '2025-12-31T23:59:59Z'
      }

      vi.mocked(entitlementsApi.getEntitlements).mockResolvedValue(mockDTO)

      const store = useEntitlementsStore()
      await store.loadEntitlements()

      expect(store.plan).toBe('PRO')
      expect(store.features).toEqual(['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'])
      expect(store.expiresAt).toBeInstanceOf(Date)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('handles null expires_at', async () => {
      const mockDTO: EntitlementsDTO = {
        plan: 'FREE',
        features: [],
        expires_at: null
      }

      vi.mocked(entitlementsApi.getEntitlements).mockResolvedValue(mockDTO)

      const store = useEntitlementsStore()
      await store.loadEntitlements()

      expect(store.plan).toBe('FREE')
      expect(store.expiresAt).toBeNull()
    })

    it('sets loading state during fetch', async () => {
      const mockDTO: EntitlementsDTO = {
        plan: 'PRO',
        features: ['CONTACT_UNLOCK'],
        expires_at: null
      }

      let resolvePromise: (value: EntitlementsDTO) => void
      const promise = new Promise<EntitlementsDTO>((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(entitlementsApi.getEntitlements).mockReturnValue(promise)

      const store = useEntitlementsStore()
      const loadPromise = store.loadEntitlements()

      expect(store.isLoading).toBe(true)

      resolvePromise!(mockDTO)
      await loadPromise

      expect(store.isLoading).toBe(false)
    })

    it('handles API errors', async () => {
      const error = new Error('Network error')
      vi.mocked(entitlementsApi.getEntitlements).mockRejectedValue(error)

      const store = useEntitlementsStore()

      await expect(store.loadEntitlements()).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load entitlements')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('getters', () => {
    describe('isActive', () => {
      it('returns true when expiresAt is null', () => {
        const store = useEntitlementsStore()
        store.expiresAt = null

        expect(store.isActive).toBe(true)
      })

      it('returns true when expiresAt is in the future', () => {
        const store = useEntitlementsStore()
        const futureDate = new Date()
        futureDate.setFullYear(futureDate.getFullYear() + 1)
        store.expiresAt = futureDate

        expect(store.isActive).toBe(true)
      })

      it('returns false when expiresAt is in the past', () => {
        const store = useEntitlementsStore()
        const pastDate = new Date()
        pastDate.setFullYear(pastDate.getFullYear() - 1)
        store.expiresAt = pastDate

        expect(store.isActive).toBe(false)
      })
    })

    describe('hasFeature', () => {
      it('returns true when feature is present and active', () => {
        const store = useEntitlementsStore()
        store.features = ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES']
        store.expiresAt = null

        expect(store.hasFeature('CONTACT_UNLOCK')).toBe(true)
        expect(store.hasFeature('UNLIMITED_INQUIRIES')).toBe(true)
      })

      it('returns false when feature is not present', () => {
        const store = useEntitlementsStore()
        store.features = ['CONTACT_UNLOCK']
        store.expiresAt = null

        expect(store.hasFeature('UNLIMITED_INQUIRIES')).toBe(false)
      })

      it('returns false when subscription is expired', () => {
        const store = useEntitlementsStore()
        store.features = ['CONTACT_UNLOCK']
        const pastDate = new Date()
        pastDate.setFullYear(pastDate.getFullYear() - 1)
        store.expiresAt = pastDate

        expect(store.hasFeature('CONTACT_UNLOCK')).toBe(false)
      })
    })

    describe('isPro', () => {
      it('returns true for PRO plan', () => {
        const store = useEntitlementsStore()
        store.plan = 'PRO'

        expect(store.isPro).toBe(true)
      })

      it('returns true for BUSINESS plan', () => {
        const store = useEntitlementsStore()
        store.plan = 'BUSINESS'

        expect(store.isPro).toBe(true)
      })

      it('returns false for FREE plan', () => {
        const store = useEntitlementsStore()
        store.plan = 'FREE'

        expect(store.isPro).toBe(false)
      })
    })

    describe('isFree', () => {
      it('returns true for FREE plan', () => {
        const store = useEntitlementsStore()
        store.plan = 'FREE'

        expect(store.isFree).toBe(true)
      })

      it('returns false for PRO plan', () => {
        const store = useEntitlementsStore()
        store.plan = 'PRO'

        expect(store.isFree).toBe(false)
      })
    })
  })

  describe('reset', () => {
    it('resets store to initial state', () => {
      const store = useEntitlementsStore()
      
      store.plan = 'PRO'
      store.features = ['CONTACT_UNLOCK']
      store.expiresAt = new Date()
      store.isLoading = true
      store.error = 'Some error'

      store.reset()

      expect(store.plan).toBe('FREE')
      expect(store.features).toEqual([])
      expect(store.expiresAt).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
