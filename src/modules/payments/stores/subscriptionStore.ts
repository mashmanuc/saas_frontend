// F4: Subscription Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { paymentsApi, Plan, Subscription, Invoice } from '../api/payments'

export const useSubscriptionStore = defineStore('subscription', () => {
  // State
  const plans = ref<Plan[]>([])
  const currentSubscription = ref<Subscription | null>(null)
  const invoices = ref<Invoice[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const hasActiveSubscription = computed(
    () =>
      currentSubscription.value?.status === 'active' ||
      currentSubscription.value?.status === 'trialing'
  )

  const currentPlan = computed(() => currentSubscription.value?.plan)

  const lessonsRemaining = computed(() => {
    if (!currentSubscription.value || !currentPlan.value) return null
    if (currentPlan.value.lessons_per_month === 0) return Infinity // Unlimited
    return (
      currentPlan.value.lessons_per_month -
      currentSubscription.value.lessons_used_this_period
    )
  })

  const lessonsUsed = computed(
    () => currentSubscription.value?.lessons_used_this_period || 0
  )

  const featuredPlan = computed(() => plans.value.find((p) => p.is_featured))

  const sortedPlans = computed(() =>
    [...plans.value].sort((a, b) => a.price - b.price)
  )

  const isCancelling = computed(
    () => currentSubscription.value?.cancel_at_period_end || false
  )

  const periodEndDate = computed(() => {
    if (!currentSubscription.value) return null
    return new Date(currentSubscription.value.current_period_end)
  })

  const daysUntilRenewal = computed(() => {
    if (!periodEndDate.value) return null
    const now = new Date()
    const diff = periodEndDate.value.getTime() - now.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  })

  // Actions
  async function loadPlans(): Promise<void> {
    try {
      plans.value = await paymentsApi.getPlans()
    } catch (e: any) {
      error.value = e.message || 'Failed to load plans'
    }
  }

  async function loadCurrentSubscription(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      currentSubscription.value = await paymentsApi.getCurrentSubscription()
    } catch (e: any) {
      const status = e?.response?.status
      
      // v0.92.2: Graceful fallback for 404 - no subscription is valid state
      if (status === 404) {
        console.warn('[SubscriptionStore] No active subscription (404), using null')
        currentSubscription.value = null
        error.value = null // Don't show error to user
      } else {
        error.value = e.message || 'Failed to load subscription'
      }
    } finally {
      isLoading.value = false
    }
  }

  async function subscribe(
    planId: number,
    paymentMethodId?: number
  ): Promise<Subscription> {
    isLoading.value = true
    error.value = null

    try {
      const subscription = await paymentsApi.createSubscription(
        planId,
        paymentMethodId
      )
      currentSubscription.value = subscription
      return subscription
    } catch (e: any) {
      error.value = e.message || 'Failed to subscribe'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function cancelSubscription(atPeriodEnd = true): Promise<Subscription> {
    try {
      const subscription = await paymentsApi.cancelSubscription(atPeriodEnd)
      currentSubscription.value = subscription
      return subscription
    } catch (e: any) {
      error.value = e.message || 'Failed to cancel subscription'
      throw e
    }
  }

  async function reactivate(): Promise<Subscription> {
    try {
      const subscription = await paymentsApi.reactivateSubscription()
      currentSubscription.value = subscription
      return subscription
    } catch (e: any) {
      error.value = e.message || 'Failed to reactivate subscription'
      throw e
    }
  }

  async function changePlan(planId: number): Promise<Subscription> {
    isLoading.value = true
    error.value = null

    try {
      const subscription = await paymentsApi.changePlan(planId)
      currentSubscription.value = subscription
      return subscription
    } catch (e: any) {
      error.value = e.message || 'Failed to change plan'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function loadInvoices(params?: { status?: string }): Promise<void> {
    try {
      invoices.value = await paymentsApi.getInvoices(params)
    } catch (e: any) {
      error.value = e.message || 'Failed to load invoices'
    }
  }

  async function downloadInvoice(id: number): Promise<void> {
    try {
      const blob = await paymentsApi.downloadInvoicePdf(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: any) {
      error.value = e.message || 'Failed to download invoice'
      throw e
    }
  }

  function getPlanById(id: number): Plan | undefined {
    return plans.value.find((p) => p.id === id)
  }

  function $reset(): void {
    plans.value = []
    currentSubscription.value = null
    invoices.value = []
    isLoading.value = false
    error.value = null
  }

  return {
    // State
    plans,
    currentSubscription,
    invoices,
    isLoading,
    error,

    // Computed
    hasActiveSubscription,
    currentPlan,
    lessonsRemaining,
    lessonsUsed,
    featuredPlan,
    sortedPlans,
    isCancelling,
    periodEndDate,
    daysUntilRenewal,

    // Actions
    loadPlans,
    loadCurrentSubscription,
    subscribe,
    cancelSubscription,
    reactivate,
    changePlan,
    loadInvoices,
    downloadInvoice,
    getPlanById,
    $reset,
  }
})
