/**
 * Unit tests for entitlementsStore
 * 
 * Tests for entitlements state management and feature gates.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useEntitlementsStore } from '../entitlementsStore'
import * as entitlementsApi from '../../api/entitlements'

// Mock entitlementsApi
vi.mock('../../api/entitlements')

describe('entitlementsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('state', () => {
    it('should initialize with default state', () => {
      const store = useEntitlementsStore()
      
      expect(store.entitlements).toBeNull()
      expect(store.features).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.graceAcknowledged).toBe(false)
    })
  })

  describe('fetchEntitlements', () => {
    it('should fetch entitlements successfully', async () => {
      const mockEntitlements = {
        plan: 'pro',
        status: 'active',
        features: {
          'analytics_advanced': { feature: 'analytics_advanced', granted: true, reason: 'active_subscription' },
          'unlimited_contacts': { feature: 'unlimited_contacts', granted: false, reason: 'none' }
        },
        limits: {
          max_contacts_per_month: 10,
          max_students: 50,
          max_storage_gb: 5,
          analytics_level: 'advanced'
        }
      }
      
      vi.mocked(entitlementsApi.entitlementsApi.getUserEntitlements).mockResolvedValue(mockEntitlements)
      
      const store = useEntitlementsStore()
      await store.fetchEntitlements()
      
      expect(store.entitlements?.plan).toBe('pro')
      expect(store.entitlements?.status).toBe('active')
      expect(store.loading).toBe(false)
      expect(store.isFresh).toBe(true)
    })

    it('should use cache when fresh', async () => {
      vi.mocked(entitlementsApi.entitlementsApi.getUserEntitlements).mockResolvedValue({
        plan: 'basic',
        status: 'active',
        features: {},
        limits: { max_contacts_per_month: 5, max_students: 10, max_storage_gb: 1, analytics_level: 'basic' }
      })
      
      const store = useEntitlementsStore()
      await store.fetchEntitlements()
      
      // Second call should use cache
      vi.mocked(entitlementsApi.entitlementsApi.getUserEntitlements).mockClear()
      await store.fetchEntitlements()
      
      expect(entitlementsApi.entitlementsApi.getUserEntitlements).not.toHaveBeenCalled()
    })

    it('should force fetch when requested', async () => {
      vi.mocked(entitlementsApi.entitlementsApi.getUserEntitlements).mockResolvedValue({
        plan: 'basic',
        status: 'active',
        features: {},
        limits: { max_contacts_per_month: 5, max_students: 10, max_storage_gb: 1, analytics_level: 'basic' }
      })
      
      const store = useEntitlementsStore()
      await store.fetchEntitlements()
      
      // Force fetch should bypass cache
      await store.fetchEntitlements(true)
      
      expect(entitlementsApi.entitlementsApi.getUserEntitlements).toHaveBeenCalledTimes(2)
    })
  })

  describe('checkFeature', () => {
    it('should check feature from cache when fresh', async () => {
      const mockEntitlements = {
        plan: 'pro',
        status: 'active',
        features: {
          'test_feature': { feature: 'test_feature', granted: true, reason: 'active_subscription' }
        },
        limits: { max_contacts_per_month: 10, max_students: 50, max_storage_gb: 5, analytics_level: 'advanced' }
      }
      
      vi.mocked(entitlementsApi.entitlementsApi.getUserEntitlements).mockResolvedValue(mockEntitlements)
      
      const store = useEntitlementsStore()
      await store.fetchEntitlements()
      
      const result = await store.checkFeature('test_feature')
      
      expect(result.granted).toBe(true)
      // Should not call API when fresh
      expect(entitlementsApi.entitlementsApi.checkFeature).not.toHaveBeenCalled()
    })

    it('should check feature via API when not fresh', async () => {
      const mockCheck = { feature: 'new_feature', granted: true, reason: 'trial' }
      
      vi.mocked(entitlementsApi.entitlementsApi.checkFeature).mockResolvedValue(mockCheck)
      
      const store = useEntitlementsStore()
      const result = await store.checkFeature('new_feature')
      
      expect(result.granted).toBe(true)
      expect(entitlementsApi.entitlementsApi.checkFeature).toHaveBeenCalledWith('new_feature')
    })
  })

  describe('canUseFeature', () => {
    it('should return true for granted features', () => {
      const store = useEntitlementsStore()
      store.entitlements = {
        plan: 'pro',
        status: 'active',
        features: {
          'feature1': { feature: 'feature1', granted: true, reason: 'active_subscription' }
        },
        limits: { max_contacts_per_month: 10, max_students: 50, max_storage_gb: 5, analytics_level: 'advanced' }
      }
      
      expect(store.canUseFeature('feature1')).toBe(true)
    })

    it('should return false for non-granted features', () => {
      const store = useEntitlementsStore()
      store.entitlements = {
        plan: 'basic',
        status: 'active',
        features: {
          'feature1': { feature: 'feature1', granted: false, reason: 'none' }
        },
        limits: { max_contacts_per_month: 5, max_students: 10, max_storage_gb: 1, analytics_level: 'basic' }
      }
      
      expect(store.canUseFeature('feature1')).toBe(false)
    })
  })

  describe('getters', () => {
    it('should detect grace period', () => {
      const store = useEntitlementsStore()
      store.entitlements = {
        plan: 'pro',
        status: 'grace_period',
        features: {},
        limits: { max_contacts_per_month: 10, max_students: 50, max_storage_gb: 5, analytics_level: 'advanced' },
        grace_period: {
          started_at: '2026-01-01',
          ends_at: '2026-01-15',
          days_remaining: 5
        }
      }
      
      expect(store.isInGracePeriod).toBe(true)
      expect(store.daysRemaining).toBe(5)
    })

    it('should detect trial', () => {
      const store = useEntitlementsStore()
      store.entitlements = {
        plan: 'pro',
        status: 'trialing',
        features: {},
        limits: { max_contacts_per_month: 10, max_students: 50, max_storage_gb: 5, analytics_level: 'advanced' },
        trial: {
          started_at: '2026-01-01',
          ends_at: '2026-01-15',
          days_remaining: 10
        }
      }
      
      expect(store.isTrialing).toBe(true)
      expect(store.daysRemaining).toBe(10)
    })

    it('should return limits', () => {
      const store = useEntitlementsStore()
      store.entitlements = {
        plan: 'pro',
        status: 'active',
        features: {},
        limits: {
          max_contacts_per_month: 20,
          max_students: 100,
          max_storage_gb: 10,
          analytics_level: 'advanced'
        }
      }
      
      expect(store.maxContactsPerMonth).toBe(20)
      expect(store.maxStudents).toBe(100)
      expect(store.maxStorageGb).toBe(10)
      expect(store.analyticsLevel).toBe('advanced')
    })

    it('should show grace banner when not acknowledged', () => {
      const store = useEntitlementsStore()
      store.entitlements = {
        plan: 'pro',
        status: 'grace_period',
        features: {},
        limits: { max_contacts_per_month: 10, max_students: 50, max_storage_gb: 5, analytics_level: 'advanced' }
      }
      store.graceAcknowledged = false
      
      expect(store.shouldShowGraceBanner).toBe(true)
    })

    it('should not show grace banner when acknowledged', () => {
      const store = useEntitlementsStore()
      store.entitlements = {
        plan: 'pro',
        status: 'grace_period',
        features: {},
        limits: { max_contacts_per_month: 10, max_students: 50, max_storage_gb: 5, analytics_level: 'advanced' }
      }
      store.graceAcknowledged = true
      
      expect(store.shouldShowGraceBanner).toBe(false)
    })
  })

  describe('acknowledgeGrace', () => {
    it('should acknowledge grace period', async () => {
      vi.mocked(entitlementsApi.entitlementsApi.acknowledgeGracePeriod).mockResolvedValue(undefined)
      
      const store = useEntitlementsStore()
      await store.acknowledgeGrace()
      
      expect(store.graceAcknowledged).toBe(true)
      expect(entitlementsApi.entitlementsApi.acknowledgeGracePeriod).toHaveBeenCalled()
    })

    it('should acknowledge locally even if API fails', async () => {
      vi.mocked(entitlementsApi.entitlementsApi.acknowledgeGracePeriod).mockRejectedValue(new Error('API error'))
      
      const store = useEntitlementsStore()
      await store.acknowledgeGrace()
      
      expect(store.graceAcknowledged).toBe(true)
    })
  })

  describe('$reset', () => {
    it('should reset all state', () => {
      const store = useEntitlementsStore()
      store.entitlements = { plan: 'pro', status: 'active', features: {}, limits: { max_contacts_per_month: 10, max_students: 50, max_storage_gb: 5, analytics_level: 'advanced' } }
      store.graceAcknowledged = true
      store.error = 'Some error'
      
      store.$reset()
      
      expect(store.entitlements).toBeNull()
      expect(store.graceAcknowledged).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
