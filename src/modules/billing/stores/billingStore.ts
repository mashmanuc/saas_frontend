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
  BillingMeDto, 
  PlanDto, 
  CheckoutResponse,
  CancelResponse 
} from '../api/billingApi'
import * as billingApi from '../api/billingApi'
import { submitCheckoutForm, validateCheckoutResponse } from '../utils/checkoutHelper'
import { minorToMajor } from '../utils/priceFormatter'

export const useBillingStore = defineStore('billing-v074', () => {
  // State
  const me = ref<BillingMeDto | null>(null)
  const plans = ref<PlanDto[]>([])
  const isLoading = ref(false)
  const isLoadingPlans = ref(false)
  const isLoadingAction = ref(false)
  const lastError = ref<any>(null)

  // Computed
  const currentPlanCode = computed(() => me.value?.entitlement?.plan_code || 'FREE')
  const currentPlan = computed(() => me.value?.entitlement?.plan_code || 'FREE')
  const subscription = computed(() => me.value?.subscription || null)
  const entitlement = computed(() => me.value?.entitlement || null)
  const isSubscribed = computed(() => subscription.value?.status === 'active')
  const hasFeature = computed(() => (feature: string) => {
    return entitlement.value?.features?.includes(feature) || false
  })
  const isPro = computed(() => currentPlan.value === 'PRO')
  const isBusiness = computed(() => currentPlan.value === 'BUSINESS')
  const isFree = computed(() => currentPlan.value === 'FREE')
  
  // v0.76.3: Pending plan support
  const pendingPlanCode = computed(() => me.value?.pending_plan_code || null)
  const pendingSince = computed(() => me.value?.pending_since || null)
  const displayPlanCode = computed(() => me.value?.display_plan_code || currentPlan.value)
  const subscriptionStatus = computed(() => me.value?.subscription_status || 'none')
  const hasPendingPlan = computed(() => !!pendingPlanCode.value)

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
    lastError.value = null

    try {
      me.value = await billingApi.getMe()
    } catch (err: any) {
      console.error('Failed to fetch billing status:', err)
      lastError.value = err
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
    isLoadingPlans.value = true
    lastError.value = null

    try {
      const response = await billingApi.getPlans()
      
      if (import.meta.env.DEV) {
        console.debug('[billingStore] Raw API response:', response)
        console.debug('[billingStore] Plans array:', response?.plans)
      }
      
      const normalizedPlans = (response?.plans ?? [])
        .filter(plan => plan && plan.is_active !== false)
        .map((plan, index) => {
          const safeSort = typeof plan.sort_order === 'number' ? plan.sort_order : index * 10
          const currency = plan?.price?.currency || 'UAH'
          const amountMinor = typeof plan?.price?.amount === 'number' ? plan.price.amount : 0
          return {
            ...plan,
            sort_order: safeSort,
            interval: plan?.interval || 'monthly',
            price: {
              amount: minorToMajor(amountMinor, currency),
              currency
            }
          }
        })
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))

      plans.value = normalizedPlans
      
      if (import.meta.env.DEV) {
        console.debug('[billingStore] Normalized plans:', normalizedPlans)
        console.debug('[billingStore] Plans count:', normalizedPlans.length)
      }
    } catch (err: any) {
      console.error('Failed to fetch plans:', err)
      lastError.value = err
      throw err
    } finally {
      isLoadingPlans.value = false
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
  async function startCheckout(planCode: string): Promise<CheckoutResponse> {
    isLoadingAction.value = true
    lastError.value = null

    try {
      const response = await billingApi.startCheckout(planCode)
      
      // Handle different providers
      if (response.provider === 'liqpay' && response.checkout) {
        // LiqPay: POST form submission
        validateCheckoutResponse(response.provider, response.session_id, response.checkout)
        submitCheckoutForm(response.checkout)
      } else if (response.provider === 'stripe' && response.checkout_url) {
        // Stripe: Redirect to checkout URL
        window.location.href = response.checkout_url
      } else {
        throw new Error(`Unsupported provider: ${response.provider}`)
      }
      
      return response
    } catch (err: any) {
      console.error('Checkout failed:', err)
      lastError.value = err
      throw err
    } finally {
      isLoadingAction.value = false
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
    isLoadingAction.value = true
    lastError.value = null

    try {
      const response = await billingApi.cancelSubscription(atPeriodEnd)
      
      // CRITICAL: Refetch billing status after cancel
      await fetchMe()
      
      return response
    } catch (err: any) {
      console.error('Cancel failed:', err)
      lastError.value = err
      throw err
    } finally {
      isLoadingAction.value = false
    }
  }


  /**
   * Clear error state
   */
  function clearError() {
    lastError.value = null
  }

  /**
   * Reset store state
   */
  function $reset() {
    me.value = null
    plans.value = []
    isLoading.value = false
    isLoadingPlans.value = false
    isLoadingAction.value = false
    lastError.value = null
  }

  return {
    // State
    me,
    plans,
    isLoading,
    isLoadingPlans,
    isLoadingAction,
    lastError,
    
    // Computed
    currentPlanCode,
    currentPlan,
    subscription,
    entitlement,
    isSubscribed,
    hasFeature,
    isPro,
    isBusiness,
    isFree,
    
    // v0.76.3: Pending plan computed
    pendingPlanCode,
    pendingSince,
    displayPlanCode,
    subscriptionStatus,
    hasPendingPlan,
    
    // Actions
    fetchMe,
    fetchPlans,
    startCheckout,
    cancel,
    clearError,
    $reset,
  }
})
