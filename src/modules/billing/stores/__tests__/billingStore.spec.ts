/**
 * Unit tests for billingStore (v0.73.0)
 * 
 * Tests for billing state management and API integration.
 * Includes LiqPay checkout flow with POST form submission.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBillingStore } from '../billingStore'
import * as billingApi from '../../api/billingApi'

// Mock billingApi
vi.mock('../../api/billingApi')

describe('billingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchMe', () => {
    it('should fetch billing status successfully', async () => {
      const mockData: billingApi.BillingMe = {
        plan: 'PRO',
        subscription: {
          status: 'active' as const,
          current_period_end: '2026-02-01T00:00:00Z',
          cancel_at_period_end: false
        },
        entitlements: {
          features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'] as any,
          expires_at: '2026-02-01T00:00:00Z'
        }
      }

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.me).toEqual(mockData)
      expect(store.currentPlan).toBe('PRO')
      expect(store.isSubscribed).toBe(true)
      expect(store.isPro).toBe(true)
      expect(store.isFree).toBe(false)
      expect(store.error).toBeNull()
    })

    it('should handle FREE user correctly', async () => {
      const mockData: billingApi.BillingMe = {
        plan: 'FREE',
        subscription: null,
        entitlements: {
          features: [] as any,
          expires_at: null
        }
      }

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.currentPlan).toBe('FREE')
      expect(store.subscription).toBeNull()
      expect(store.isSubscribed).toBe(false)
      expect(store.isFree).toBe(true)
      expect(store.isPro).toBe(false)
    })

    it('should handle API error', async () => {
      const errorMessage = 'Network error'
      vi.mocked(billingApi.getMe).mockRejectedValue(new Error(errorMessage))

      const store = useBillingStore()
      
      await expect(store.fetchMe()).rejects.toThrow()
      expect(store.error).toBeTruthy()
    })
  })

  describe('fetchPlans', () => {
    it('should fetch plans successfully', async () => {
      const mockPlans = [
        {
          id: 1,
          name: 'Free',
          slug: 'free',
          description: 'Free plan',
          price: 0,
          price_decimal: '0.00',
          currency: 'UAH',
          interval: 'monthly',
          lessons_per_month: 0,
          features: [],
          is_active: true,
          is_featured: false,
          display_order: 0
        },
        {
          id: 2,
          name: 'Pro',
          slug: 'pro',
          description: 'Pro plan',
          price: 29900,
          price_decimal: '299.00',
          currency: 'UAH',
          interval: 'monthly',
          lessons_per_month: 0,
          features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
          is_active: true,
          is_featured: true,
          display_order: 1
        }
      ]

      vi.mocked(billingApi.getPlans).mockResolvedValue(mockPlans)

      const store = useBillingStore()
      await store.fetchPlans()

      expect(store.plans).toEqual(mockPlans)
      expect(store.plans).toHaveLength(2)
      expect(store.error).toBeNull()
    })

    it('should handle empty plans list', async () => {
      vi.mocked(billingApi.getPlans).mockResolvedValue([])

      const store = useBillingStore()
      await store.fetchPlans()

      expect(store.plans).toEqual([])
      expect(store.plans).toHaveLength(0)
    })
  })

  describe('checkout', () => {
    it('should initiate checkout successfully with LiqPay', async () => {
      const mockResponse: billingApi.CheckoutResponse = {
        provider: 'liqpay',
        session_id: 'order_abc123',
        checkout: {
          method: 'POST',
          url: 'https://www.liqpay.ua/api/3/checkout',
          form_fields: {
            data: 'base64encodeddata',
            signature: 'base64encodedsignature'
          }
        }
      }

      vi.mocked(billingApi.checkout).mockResolvedValue(mockResponse)

      const store = useBillingStore()
      const result = await store.checkout('PRO')

      expect(result).toEqual(mockResponse)
      expect(billingApi.checkout).toHaveBeenCalledWith('PRO')
    })

    it('should handle checkout error', async () => {
      vi.mocked(billingApi.checkout).mockRejectedValue(new Error('Checkout failed'))

      const store = useBillingStore()

      await expect(store.checkout('pro')).rejects.toThrow()
      expect(store.error).toBeTruthy()
    })
  })

  describe('cancel', () => {
    it('should cancel subscription and refetch billing status', async () => {
      const mockCancelResponse = {
        status: 'cancelled',
        message: 'Subscription cancelled'
      }

      const mockMeData: billingApi.BillingMe = {
        plan: 'PRO',
        subscription: {
          status: 'active' as const,
          current_period_end: '2026-02-01T00:00:00Z',
          cancel_at_period_end: true
        },
        entitlements: {
          features: ['CONTACT_UNLOCK'] as any,
          expires_at: '2026-02-01T00:00:00Z'
        }
      }

      vi.mocked(billingApi.cancel).mockResolvedValue(mockCancelResponse)
      vi.mocked(billingApi.getMe).mockResolvedValue(mockMeData)

      const store = useBillingStore()
      const result = await store.cancel(true)

      expect(result).toEqual(mockCancelResponse)
      expect(billingApi.cancel).toHaveBeenCalledWith(true)
      expect(billingApi.getMe).toHaveBeenCalled()
      expect(store.me).toEqual(mockMeData)
    })
  })

  describe('hasFeature', () => {
    it('should check if user has feature', async () => {
      const mockData: billingApi.BillingMe = {
        plan: 'PRO',
        subscription: {
          status: 'active' as const,
          current_period_end: '2026-02-01T00:00:00Z',
          cancel_at_period_end: false
        },
        entitlements: {
          features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'] as any,
          expires_at: '2026-02-01T00:00:00Z'
        }
      }

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.hasFeature('CONTACT_UNLOCK')).toBe(true)
      expect(store.hasFeature('UNLIMITED_INQUIRIES')).toBe(true)
      expect(store.hasFeature('PRIORITY_SUPPORT')).toBe(false)
    })

    it('should return false for FREE user', async () => {
      const mockData = {
        plan: 'FREE',
        subscription: null,
        entitlements: {
          features: [],
          expires_at: null
        }
      }

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.hasFeature('CONTACT_UNLOCK')).toBe(false)
      expect(store.hasFeature('UNLIMITED_INQUIRIES')).toBe(false)
    })
  })

  describe('$reset', () => {
    it('should reset store state', async () => {
      const mockData: billingApi.BillingMe = {
        plan: 'PRO',
        subscription: {
          status: 'active' as const,
          current_period_end: '2026-02-01T00:00:00Z',
          cancel_at_period_end: false
        },
        entitlements: {
          features: ['CONTACT_UNLOCK'] as any,
          expires_at: '2026-02-01T00:00:00Z'
        }
      }

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.me).not.toBeNull()

      store.$reset()

      expect(store.me).toBeNull()
      expect(store.plans).toEqual([])
      expect(store.error).toBeNull()
      expect(store.isLoading).toBe(false)
    })
  })
})
