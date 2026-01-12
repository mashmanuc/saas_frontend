/**
 * Billing Store (v0.73.0)
 * 
 * Source of truth for billing state in frontend.
 * 
 * INVARIANTS:
 * - Store does NOT calculate features or limits
 * - Store ONLY reads from backend via API
 * - After any billing action (checkout, cancel), store refetches /billing/me
 * - No hardcoded plans or feature logic
 * - Checkout uses POST form submission (LiqPay/Stripe)
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { 
  BillingMe, 
  BillingPlan, 
  CheckoutResponse,
  CancelResponse 
} from '../api/billingApi'
import * as billingApi from '../api/billingApi'
import { submitCheckoutForm, validateCheckoutResponse } from '../utils/checkoutHelper'

export const useBillingStore = defineStore('billing', () => {
  // State
  const me = ref<BillingMe | null>(null)
  const plans = ref<BillingPlan[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const currentPlan = computed(() => me.value?.plan || 'FREE')
  const subscription = computed(() => me.value?.subscription || null)
  const entitlements = computed(() => me.value?.entitlements || null)
  const isSubscribed = computed(() => subscription.value?.status === 'active')
  const hasFeature = computed(() => (feature: string) => {
    return entitlements.value?.features.includes(feature as any) || false
  })
  const isPro = computed(() => currentPlan.value === 'PRO')
  const isBusiness = computed(() => currentPlan.value === 'BUSINESS')
  const isFree = computed(() => currentPlan.value === 'FREE')

  /**
   * Fetch current user's billing status
   * 
   * This is the source of truth for:
   * - Current plan
   * - Subscription status
   * - Entitlements
   */
  async function fetchMe() {
    isLoading.value = true
    error.value = null

    try {
      me.value = await billingApi.getMe()
    } catch (err: any) {
      console.error('Failed to fetch billing status:', err)
      error.value = err.response?.data?.error?.message || 'Failed to load billing status'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch available billing plans
   * 
   * Plans come from backend, NOT hardcoded in FE.
   */
  async function fetchPlans() {
    isLoading.value = true
    error.value = null

    try {
      plans.value = await billingApi.getPlans()
    } catch (err: any) {
      console.error('Failed to fetch plans:', err)
      error.value = err.response?.data?.error?.message || 'Failed to load plans'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Initiate checkout for a plan
   * 
   * Backend returns checkout details (provider, session_id, form fields).
   * FE submits POST form to payment provider.
   * After user completes payment and returns, FE should call fetchMe() to refresh status.
   * 
   * @param planCode - Plan identifier (e.g., 'PRO', 'FREE')
   * @returns Checkout response with session info
   */
  async function checkout(planCode: string): Promise<CheckoutResponse> {
    isLoading.value = true
    error.value = null

    try {
      const response = await billingApi.checkout(planCode)
      
      // Validate response before submission
      validateCheckoutResponse(response.provider, response.session_id, response.checkout)
      
      // Submit form to payment provider (causes navigation)
      submitCheckoutForm(response.checkout)
      
      // Note: After form submission, browser navigates away.
      // When user returns, route guard or component should call fetchMe().
      
      return response
    } catch (err: any) {
      console.error('Checkout failed:', err)
      error.value = err.response?.data?.error?.message || 'Checkout failed'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Cancel current subscription
   * 
   * After cancellation, automatically refetch billing status.
   * 
   * @param atPeriodEnd - If true, cancel at end of billing period
   */
  async function cancel(atPeriodEnd: boolean = true): Promise<CancelResponse> {
    isLoading.value = true
    error.value = null

    try {
      const response = await billingApi.cancel(atPeriodEnd)
      
      // CRITICAL: Refetch billing status after cancel
      await fetchMe()
      
      return response
    } catch (err: any) {
      console.error('Cancel failed:', err)
      error.value = err.response?.data?.error?.message || 'Failed to cancel subscription'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Resume a canceled subscription
   * 
   * After resume, automatically refetch billing status.
   */
  async function resume(): Promise<CancelResponse> {
    isLoading.value = true
    error.value = null

    try {
      const response = await billingApi.resume()
      
      // CRITICAL: Refetch billing status after resume
      await fetchMe()
      
      return response
    } catch (err: any) {
      console.error('Resume failed:', err)
      error.value = err.response?.data?.error?.message || 'Failed to resume subscription'
      throw err
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Clear error state
   */
  function clearError() {
    error.value = null
  }

  /**
   * Reset store state
   */
  function $reset() {
    me.value = null
    plans.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    me,
    plans,
    isLoading,
    error,
    
    // Computed
    currentPlan,
    subscription,
    entitlements,
    isSubscribed,
    hasFeature,
    isPro,
    isBusiness,
    isFree,
    
    // Actions
    fetchMe,
    fetchPlans,
    checkout,
    cancel,
    resume,
    clearError,
    $reset,
  }
})
