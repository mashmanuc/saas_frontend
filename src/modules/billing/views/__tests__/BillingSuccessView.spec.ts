/**
 * BillingSuccessView Unit Tests (v0.76.2)
 * 
 * FE-76.2.3: Tests for success view polling logic and plan_code display
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import BillingSuccessView from '../BillingSuccessView.vue'
import { useBillingStore } from '../../stores/billingStore'

// Mock router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

// Mock i18n
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key
  })
}))

// Mock notify
vi.mock('@/utils/notify', () => ({
  notifySuccess: vi.fn(),
  notifyWarning: vi.fn()
}))

describe('BillingSuccessView', () => {
  let pinia: any
  let billingStore: any

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    billingStore = useBillingStore()
    
    // Mock fetchMe
    billingStore.fetchMe = vi.fn()
    
    // Clear all timers
    vi.clearAllTimers()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    mockPush.mockClear()
  })

  describe('FE-76.2.1: Status-aware polling', () => {
    it('starts polling when plan_code is FREE', async () => {
      // Setup: plan is still FREE
      billingStore.me = {
        subscription: { status: 'none' },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null }
      }
      billingStore.fetchMe.mockResolvedValue(undefined)

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Should start polling after 1 second
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(1)

      // Advance timer by 1 second
      vi.advanceTimersByTime(1000)
      await flushPromises()

      // Should have called fetchMe again
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(2)
    })

    it('stops polling when plan_code changes to PRO', async () => {
      // Setup: plan starts as FREE
      billingStore.me = {
        subscription: { status: 'none' },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null }
      }
      
      let callCount = 0
      billingStore.fetchMe.mockImplementation(async () => {
        callCount++
        if (callCount === 2) {
          // On second call, plan becomes PRO
          billingStore.me = {
            subscription: { status: 'active' },
            entitlement: { plan_code: 'PRO', features: ['CONTACT_UNLOCK'], expires_at: '2026-02-13T18:00:00Z' }
          }
        }
      })

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // First fetch on mount
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(1)

      // Advance timer by 1 second (first poll)
      vi.advanceTimersByTime(1000)
      await flushPromises()

      // Second fetch - plan becomes PRO, should stop polling
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(2)

      // Advance timer by 3 more seconds
      vi.advanceTimersByTime(3000)
      await flushPromises()

      // Should NOT have called fetchMe again (polling stopped)
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(2)
    })

    it('shows activated message when plan_code is PRO', async () => {
      // Setup: plan is already PRO
      billingStore.me = {
        subscription: { status: 'active' },
        entitlement: { plan_code: 'PRO', features: ['CONTACT_UNLOCK'], expires_at: '2026-02-13T18:00:00Z' }
      }
      billingStore.fetchMe.mockResolvedValue(undefined)

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Should show activated message
      expect(wrapper.text()).toContain('billing.success.activated')
      
      // Should NOT start polling (plan already activated)
      vi.advanceTimersByTime(2000)
      await flushPromises()
      
      // Only initial fetch, no polling
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(1)
    })

    it('continues polling if subscription is active but plan still FREE', async () => {
      // Edge case: subscription active but entitlement not synced yet
      billingStore.me = {
        subscription: { status: 'active' },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null }
      }
      billingStore.fetchMe.mockResolvedValue(undefined)

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // First fetch on mount
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(1)

      // Advance timer by 1 second
      vi.advanceTimersByTime(1000)
      await flushPromises()

      // Should continue polling despite active status
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(2)
    })

    it('stops polling after max attempts', async () => {
      // Setup: plan stays FREE
      billingStore.me = {
        subscription: { status: 'none' },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null }
      }
      billingStore.fetchMe.mockResolvedValue(undefined)

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Initial fetch
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(1)

      // Simulate 10 polling attempts (max)
      for (let i = 0; i < 10; i++) {
        vi.advanceTimersByTime(3000) // Max delay is 3s
        await flushPromises()
      }

      const callsAfterMax = billingStore.fetchMe.mock.calls.length

      // Try to advance more
      vi.advanceTimersByTime(5000)
      await flushPromises()

      // Should not have called more times
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(callsAfterMax)
    })
  })

  describe('FE-76.2.2: Auth error handling', () => {
    it('shows recovery UI on 401 error', async () => {
      billingStore.fetchMe.mockRejectedValue({
        response: { status: 401 },
        code: 'auth_refresh_missing'
      })

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Should show recovery UI
      expect(wrapper.text()).toContain('billing.success.sessionExpired')
      expect(wrapper.text()).toContain('billing.success.loginAgain')
    })

    it('does not start polling on auth error', async () => {
      billingStore.fetchMe.mockRejectedValue({
        response: { status: 401 }
      })

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Initial fetch failed
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(1)

      // Advance timer
      vi.advanceTimersByTime(3000)
      await flushPromises()

      // Should NOT have called again (no polling on error)
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(1)
    })
  })

  describe('Cleanup', () => {
    it('clears polling timeout on unmount', async () => {
      billingStore.me = {
        subscription: { status: 'none' },
        entitlement: { plan_code: 'FREE', features: [], expires_at: null }
      }
      billingStore.fetchMe.mockResolvedValue(undefined)

      const wrapper = mount(BillingSuccessView, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      // Start polling
      vi.advanceTimersByTime(1000)
      await flushPromises()

      // Unmount component
      wrapper.unmount()

      // Advance timer
      vi.advanceTimersByTime(5000)
      await flushPromises()

      // Should not have called fetchMe after unmount
      expect(billingStore.fetchMe).toHaveBeenCalledTimes(2) // Only mount + first poll
    })
  })
})
