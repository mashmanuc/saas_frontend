/**
 * Billing Store for v0.64.0
 * Manages subscription billing status and checkout flow
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import billingApi from '@/api/billing'
import type { BillingStatus } from '@/types/billing'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'

export const useBillingStore = defineStore('billing', () => {
  // State
  const subscriptionStatus = ref<'active' | 'canceled' | 'past_due' | 'trialing' | 'none'>('none')
  const currentPeriodEnd = ref<Date | null>(null)
  const cancelAtPeriodEnd = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Getters
  const isActive = computed(() => subscriptionStatus.value === 'active')
  const isPastDue = computed(() => subscriptionStatus.value === 'past_due')
  const hasSubscription = computed(() => subscriptionStatus.value !== 'none')

  // Actions
  
  /**
   * Start checkout session and redirect to payment page
   * @param plan - Plan to upgrade to (default: 'PRO')
   */
  async function startCheckout(plan: string = 'PRO'): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const response = await billingApi.startCheckout(plan)
      
      // Redirect to checkout URL
      window.location.href = response.checkout_url
    } catch (err) {
      error.value = 'Failed to start checkout'
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load current billing status
   */
  async function loadBillingMe(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      const dto = await billingApi.getBillingMe()
      
      // Normalize DTO to state
      subscriptionStatus.value = dto.subscription_status
      currentPeriodEnd.value = dto.current_period_end ? new Date(dto.current_period_end) : null
      cancelAtPeriodEnd.value = dto.cancel_at_period_end
    } catch (err) {
      error.value = 'Failed to load billing status'
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Cancel subscription
   * @param atPeriodEnd - If true, cancel at period end; if false, cancel immediately
   */
  async function cancelSubscription(atPeriodEnd: boolean = true): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      await billingApi.cancelSubscription(atPeriodEnd)
      
      // Reload billing status to reflect changes
      await loadBillingMe()
    } catch (err) {
      error.value = 'Failed to cancel subscription'
      rethrowAsDomainError(err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Reset store to initial state
   */
  function reset(): void {
    subscriptionStatus.value = 'none'
    currentPeriodEnd.value = null
    cancelAtPeriodEnd.value = false
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    subscriptionStatus,
    currentPeriodEnd,
    cancelAtPeriodEnd,
    isLoading,
    error,
    
    // Getters
    isActive,
    isPastDue,
    hasSubscription,
    
    // Actions
    startCheckout,
    loadBillingMe,
    cancelSubscription,
    reset
  }
})
