/**
 * Unit tests for billingStore (v0.64.0)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBillingStore } from '@/stores/billingStore'
import billingApi from '@/api/billing'
import type { BillingMeDTO, CheckoutResponseDTO } from '@/types/billing'

vi.mock('@/api/billing', () => ({
  default: {
    startCheckout: vi.fn(),
    getBillingMe: vi.fn(),
    cancelSubscription: vi.fn()
  }
}))

vi.mock('@/utils/rethrowAsDomainError', () => ({
  rethrowAsDomainError: vi.fn((err) => {
    throw err
  })
}))

// Mock window.location
delete (window as any).location
window.location = { href: '' } as any

describe('billingStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.location.href = ''
  })

  describe('initial state', () => {
    it('has correct default values', () => {
      const store = useBillingStore()
      
      expect(store.subscriptionStatus).toBe('none')
      expect(store.currentPeriodEnd).toBeNull()
      expect(store.cancelAtPeriodEnd).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('startCheckout', () => {
    it('redirects to checkout URL', async () => {
      const mockResponse: CheckoutResponseDTO = {
        checkout_url: 'https://checkout.stripe.com/session_123'
      }

      vi.mocked(billingApi.startCheckout).mockResolvedValue(mockResponse)

      const store = useBillingStore()
      await store.startCheckout('PRO')

      expect(billingApi.startCheckout).toHaveBeenCalledWith('PRO')
      expect(window.location.href).toBe('https://checkout.stripe.com/session_123')
    })

    it('sets loading state during checkout', async () => {
      const mockResponse: CheckoutResponseDTO = {
        checkout_url: 'https://checkout.stripe.com/session_123'
      }

      let resolvePromise: (value: CheckoutResponseDTO) => void
      const promise = new Promise<CheckoutResponseDTO>((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(billingApi.startCheckout).mockReturnValue(promise)

      const store = useBillingStore()
      const checkoutPromise = store.startCheckout('PRO')

      expect(store.isLoading).toBe(true)

      resolvePromise!(mockResponse)
      await checkoutPromise

      expect(store.isLoading).toBe(false)
    })

    it('handles API errors', async () => {
      const error = new Error('Network error')
      vi.mocked(billingApi.startCheckout).mockRejectedValue(error)

      const store = useBillingStore()

      await expect(store.startCheckout('PRO')).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to start checkout')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('loadBillingMe', () => {
    it('loads billing status successfully', async () => {
      const mockDTO: BillingMeDTO = {
        subscription_status: 'active',
        current_period_end: '2025-12-31T23:59:59Z',
        cancel_at_period_end: false
      }

      vi.mocked(billingApi.getBillingMe).mockResolvedValue(mockDTO)

      const store = useBillingStore()
      await store.loadBillingMe()

      expect(store.subscriptionStatus).toBe('active')
      expect(store.currentPeriodEnd).toBeInstanceOf(Date)
      expect(store.cancelAtPeriodEnd).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('handles null current_period_end', async () => {
      const mockDTO: BillingMeDTO = {
        subscription_status: 'none',
        current_period_end: null,
        cancel_at_period_end: false
      }

      vi.mocked(billingApi.getBillingMe).mockResolvedValue(mockDTO)

      const store = useBillingStore()
      await store.loadBillingMe()

      expect(store.subscriptionStatus).toBe('none')
      expect(store.currentPeriodEnd).toBeNull()
    })

    it('handles canceled subscription', async () => {
      const mockDTO: BillingMeDTO = {
        subscription_status: 'canceled',
        current_period_end: '2025-01-31T23:59:59Z',
        cancel_at_period_end: true
      }

      vi.mocked(billingApi.getBillingMe).mockResolvedValue(mockDTO)

      const store = useBillingStore()
      await store.loadBillingMe()

      expect(store.subscriptionStatus).toBe('canceled')
      expect(store.cancelAtPeriodEnd).toBe(true)
    })

    it('sets loading state during fetch', async () => {
      const mockDTO: BillingMeDTO = {
        subscription_status: 'active',
        current_period_end: null,
        cancel_at_period_end: false
      }

      let resolvePromise: (value: BillingMeDTO) => void
      const promise = new Promise<BillingMeDTO>((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(billingApi.getBillingMe).mockReturnValue(promise)

      const store = useBillingStore()
      const loadPromise = store.loadBillingMe()

      expect(store.isLoading).toBe(true)

      resolvePromise!(mockDTO)
      await loadPromise

      expect(store.isLoading).toBe(false)
    })

    it('handles API errors', async () => {
      const error = new Error('Network error')
      vi.mocked(billingApi.getBillingMe).mockRejectedValue(error)

      const store = useBillingStore()

      await expect(store.loadBillingMe()).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to load billing status')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('cancelSubscription', () => {
    it('cancels subscription at period end', async () => {
      const mockDTO: BillingMeDTO = {
        subscription_status: 'active',
        current_period_end: '2025-12-31T23:59:59Z',
        cancel_at_period_end: true
      }

      vi.mocked(billingApi.cancelSubscription).mockResolvedValue()
      vi.mocked(billingApi.getBillingMe).mockResolvedValue(mockDTO)

      const store = useBillingStore()
      await store.cancelSubscription(true)

      expect(billingApi.cancelSubscription).toHaveBeenCalledWith(true)
      expect(billingApi.getBillingMe).toHaveBeenCalled()
      expect(store.cancelAtPeriodEnd).toBe(true)
    })

    it('cancels subscription immediately', async () => {
      const mockDTO: BillingMeDTO = {
        subscription_status: 'canceled',
        current_period_end: null,
        cancel_at_period_end: false
      }

      vi.mocked(billingApi.cancelSubscription).mockResolvedValue()
      vi.mocked(billingApi.getBillingMe).mockResolvedValue(mockDTO)

      const store = useBillingStore()
      await store.cancelSubscription(false)

      expect(billingApi.cancelSubscription).toHaveBeenCalledWith(false)
      expect(store.subscriptionStatus).toBe('canceled')
    })

    it('handles API errors', async () => {
      const error = new Error('Network error')
      vi.mocked(billingApi.cancelSubscription).mockRejectedValue(error)

      const store = useBillingStore()

      await expect(store.cancelSubscription(true)).rejects.toThrow('Network error')
      expect(store.error).toBe('Failed to cancel subscription')
      expect(store.isLoading).toBe(false)
    })
  })

  describe('getters', () => {
    describe('isActive', () => {
      it('returns true when subscription is active', () => {
        const store = useBillingStore()
        store.subscriptionStatus = 'active'

        expect(store.isActive).toBe(true)
      })

      it('returns false when subscription is not active', () => {
        const store = useBillingStore()
        store.subscriptionStatus = 'none'

        expect(store.isActive).toBe(false)
      })
    })

    describe('isPastDue', () => {
      it('returns true when subscription is past due', () => {
        const store = useBillingStore()
        store.subscriptionStatus = 'past_due'

        expect(store.isPastDue).toBe(true)
      })

      it('returns false when subscription is not past due', () => {
        const store = useBillingStore()
        store.subscriptionStatus = 'active'

        expect(store.isPastDue).toBe(false)
      })
    })

    describe('hasSubscription', () => {
      it('returns true when subscription exists', () => {
        const store = useBillingStore()
        store.subscriptionStatus = 'active'

        expect(store.hasSubscription).toBe(true)
      })

      it('returns false when no subscription', () => {
        const store = useBillingStore()
        store.subscriptionStatus = 'none'

        expect(store.hasSubscription).toBe(false)
      })
    })
  })

  describe('reset', () => {
    it('resets store to initial state', () => {
      const store = useBillingStore()
      
      store.subscriptionStatus = 'active'
      store.currentPeriodEnd = new Date()
      store.cancelAtPeriodEnd = true
      store.isLoading = true
      store.error = 'Some error'

      store.reset()

      expect(store.subscriptionStatus).toBe('none')
      expect(store.currentPeriodEnd).toBeNull()
      expect(store.cancelAtPeriodEnd).toBe(false)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })
  })
})
