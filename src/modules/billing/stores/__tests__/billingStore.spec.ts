/**
 * Unit tests for billingStore (v0.74.0)
 * 
 * Tests for billing state management and API integration.
 * Includes LiqPay POST form and Stripe redirect checkout flows.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBillingStore } from '../billingStore'
import * as billingApi from '../../api/billingApi'

// Mock billingApi
vi.mock('../../api/billingApi')

const makeBillingMeDto = (overrides: Partial<billingApi.BillingMeDto> = {}): billingApi.BillingMeDto => ({
  subscription: {
    status: 'active',
    provider: 'liqpay',
    current_period_end: '2026-02-01T00:00:00Z',
    cancel_at_period_end: false,
    canceled_at: null
  },
  entitlement: {
    plan_code: 'PRO',
    features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
    expires_at: '2026-02-01T00:00:00Z'
  },
  pending_plan_code: null,
  pending_since: null,
  display_plan_code: 'PRO',
  subscription_status: 'active',
  plan: 'PRO',
  expires_at: '2026-02-01T00:00:00Z',
  is_active: true,
  pending_age_seconds: null,
  last_checkout_order_id: null,
  last_checkout_created_at: null,
  ...overrides
})

describe('billingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchMe', () => {
    it('should fetch billing status successfully', async () => {
      const mockData = makeBillingMeDto()

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.me).toEqual(mockData)
      expect(store.currentPlanCode).toBe('PRO')
      expect(store.isSubscribed).toBe(true)
      expect(store.isPro).toBe(true)
      expect(store.isFree).toBe(false)
      expect(store.lastError).toBeNull()
    })

    it('should handle FREE user correctly', async () => {
      const mockData = makeBillingMeDto({
        subscription: {
          status: 'none',
          provider: null,
          current_period_end: null,
          cancel_at_period_end: false,
          canceled_at: null
        },
        entitlement: {
          plan_code: 'FREE',
          features: [],
          expires_at: null
        },
        display_plan_code: 'FREE',
        subscription_status: 'none',
        plan: 'FREE',
        expires_at: null,
        is_active: false
      })

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.currentPlanCode).toBe('FREE')
      expect(store.subscription?.status).toBe('none')
      expect(store.isSubscribed).toBe(false)
      expect(store.isFree).toBe(true)
      expect(store.isPro).toBe(false)
    })

    it('should handle API error', async () => {
      const errorMessage = 'Network error'
      vi.mocked(billingApi.getMe).mockRejectedValue(new Error(errorMessage))

      const store = useBillingStore()
      
      await expect(store.fetchMe()).rejects.toThrow()
      expect(store.lastError).toBeTruthy()
    })
  })

  describe('fetchPlans', () => {
    it('should fetch plans successfully', async () => {
      const backendPlans: billingApi.PlanDto[] = [
        {
          code: 'FREE',
          title: 'Free',
          price: { amount: 0, currency: 'UAH' },
          interval: 'monthly',
          features: [],
          is_active: true,
          sort_order: 0
        },
        {
          code: 'PRO',
          title: 'Pro',
          price: { amount: 29900, currency: 'UAH' },
          interval: 'monthly',
          features: ['CONTACT_UNLOCK', 'UNLIMITED_INQUIRIES'],
          is_active: true,
          sort_order: 1
        }
      ]

      const expectedPlans = [
        backendPlans[0],
        {
          ...backendPlans[1],
          price: { amount: 299, currency: 'UAH' }
        }
      ]

      const mockResponse: billingApi.PlansResponse = { plans: backendPlans }
      vi.mocked(billingApi.getPlans).mockResolvedValue(mockResponse)

      const store = useBillingStore()
      await store.fetchPlans()

      expect(store.plans).toEqual(expectedPlans)
      expect(store.plans).toHaveLength(2)
      expect(store.lastError).toBeNull()
    })

    it('should handle empty plans list', async () => {
      const mockResponse: billingApi.PlansResponse = { plans: [] }
      vi.mocked(billingApi.getPlans).mockResolvedValue(mockResponse)

      const store = useBillingStore()
      await store.fetchPlans()

      expect(store.plans).toEqual([])
      expect(store.plans).toHaveLength(0)
    })
  })

  describe('startCheckout', () => {
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

      vi.mocked(billingApi.startCheckout).mockResolvedValue(mockResponse)

      const store = useBillingStore()
      const result = await store.startCheckout('PRO')

      expect(result).toEqual(mockResponse)
      expect(billingApi.startCheckout).toHaveBeenCalledWith('PRO')
    })

    it('should handle Stripe checkout with redirect', async () => {
      const mockResponse: billingApi.CheckoutResponse = {
        provider: 'stripe',
        session_id: 'cs_test_123',
        checkout_url: 'https://checkout.stripe.com/session/cs_test_123'
      }

      vi.mocked(billingApi.startCheckout).mockResolvedValue(mockResponse)
      const windowLocationSpy = vi.spyOn(window.location, 'href', 'set')

      const store = useBillingStore()
      await store.startCheckout('PRO')

      expect(windowLocationSpy).toHaveBeenCalledWith(mockResponse.checkout_url)
    })

    it('should handle checkout error', async () => {
      vi.mocked(billingApi.startCheckout).mockRejectedValue(new Error('Checkout failed'))

      const store = useBillingStore()

      await expect(store.startCheckout('PRO')).rejects.toThrow()
      expect(store.lastError).toBeTruthy()
    })
  })

  describe('cancel', () => {
    it('should cancel subscription and refetch billing status', async () => {
      const mockCancelResponse = {
        status: 'cancelled',
        message: 'Subscription cancelled'
      }

      const mockMeData = makeBillingMeDto({
        subscription: {
          status: 'active',
          provider: 'liqpay',
          current_period_end: '2026-02-01T00:00:00Z',
          cancel_at_period_end: true,
          canceled_at: null
        },
        entitlement: {
          plan_code: 'PRO',
          features: ['CONTACT_UNLOCK'],
          expires_at: '2026-02-01T00:00:00Z'
        }
      })

      vi.mocked(billingApi.cancelSubscription).mockResolvedValue(mockCancelResponse)
      vi.mocked(billingApi.getMe).mockResolvedValue(mockMeData)

      const store = useBillingStore()
      const result = await store.cancel(true)

      expect(result).toEqual(mockCancelResponse)
      expect(billingApi.cancelSubscription).toHaveBeenCalledWith(true)
      expect(billingApi.getMe).toHaveBeenCalled()
      expect(store.me).toEqual(mockMeData)
    })
  })

  describe('hasFeature', () => {
    it('should check if user has feature', async () => {
      const mockData = makeBillingMeDto()

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.hasFeature('CONTACT_UNLOCK')).toBe(true)
      expect(store.hasFeature('UNLIMITED_INQUIRIES')).toBe(true)
      expect(store.hasFeature('PRIORITY_SUPPORT')).toBe(false)
    })

    it('should return false for FREE user', async () => {
      const mockData = makeBillingMeDto({
        subscription: {
          status: 'none',
          provider: null,
          current_period_end: null,
          cancel_at_period_end: false,
          canceled_at: null
        },
        entitlement: {
          plan_code: 'FREE',
          features: [],
          expires_at: null
        },
        display_plan_code: 'FREE',
        subscription_status: 'none',
        plan: 'FREE',
        expires_at: null,
        is_active: false
      })

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.hasFeature('CONTACT_UNLOCK')).toBe(false)
      expect(store.hasFeature('UNLIMITED_INQUIRIES')).toBe(false)
    })
  })

  describe('$reset', () => {
    it('should reset store state', async () => {
      const mockData = makeBillingMeDto({
        entitlement: {
          plan_code: 'PRO',
          features: ['CONTACT_UNLOCK'],
          expires_at: '2026-02-01T00:00:00Z'
        }
      })

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.me).not.toBeNull()

      store.$reset()

      expect(store.me).toBeNull()
      expect(store.plans).toEqual([])
      expect(store.lastError).toBeNull()
      expect(store.isLoading).toBe(false)
    })
  })

  // v0.78.0: Pending plan tests
  describe('pending plan (v0.78.0)', () => {
    it('should expose pending plan data when present', async () => {
      const mockData = makeBillingMeDto({
        subscription: {
          status: 'none',
          provider: null,
          current_period_end: null,
          cancel_at_period_end: false,
          canceled_at: null
        },
        entitlement: {
          plan_code: 'FREE',
          features: [],
          expires_at: null
        },
        pending_plan_code: 'PRO',
        pending_since: '2026-01-13T20:00:00Z',
        display_plan_code: 'PRO',
        subscription_status: 'none',
        plan: 'FREE',
        expires_at: null,
        is_active: false
      })

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.pendingPlanCode).toBe('PRO')
      expect(store.pendingSince).toBe('2026-01-13T20:00:00Z')
      expect(store.displayPlanCode).toBe('PRO')
      expect(store.hasPendingPlan).toBe(true)
      expect(store.subscriptionStatus).toBe('none')
    })

    it('should not have pending plan when null', async () => {
      const mockData = makeBillingMeDto({
        entitlement: {
          plan_code: 'PRO',
          features: ['CONTACT_UNLOCK'],
          expires_at: '2026-02-01T00:00:00Z'
        }
      })

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.pendingPlanCode).toBeNull()
      expect(store.pendingSince).toBeNull()
      expect(store.hasPendingPlan).toBe(false)
      expect(store.displayPlanCode).toBe('PRO')
    })

    it('should use displayPlanCode over currentPlanCode when pending', async () => {
      const mockData = makeBillingMeDto({
        subscription: {
          status: 'none',
          provider: null,
          current_period_end: null,
          cancel_at_period_end: false,
          canceled_at: null
        },
        entitlement: {
          plan_code: 'FREE',
          features: [],
          expires_at: null
        },
        pending_plan_code: 'BUSINESS',
        pending_since: '2026-01-13T20:00:00Z',
        display_plan_code: 'BUSINESS',
        subscription_status: 'none',
        plan: 'FREE',
        expires_at: null,
        is_active: false
      })

      vi.mocked(billingApi.getMe).mockResolvedValue(mockData)

      const store = useBillingStore()
      await store.fetchMe()

      expect(store.currentPlanCode).toBe('FREE')
      expect(store.displayPlanCode).toBe('BUSINESS')
      expect(store.hasPendingPlan).toBe(true)
    })
  })
})
