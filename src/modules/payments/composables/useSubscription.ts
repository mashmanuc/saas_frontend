// F32: useSubscription composable
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSubscriptionStore } from '../stores/subscriptionStore'

export function useSubscription() {
  const store = useSubscriptionStore()
  const router = useRouter()

  const {
    plans,
    currentSubscription,
    invoices,
    isLoading,
    error,
    hasActiveSubscription,
    currentPlan,
    lessonsRemaining,
    lessonsUsed,
    featuredPlan,
    sortedPlans,
    isCancelling,
    periodEndDate,
    daysUntilRenewal,
  } = storeToRefs(store)

  onMounted(() => {
    store.loadCurrentSubscription()
  })

  async function subscribeToPlan(planId: number, paymentMethodId?: number) {
    try {
      const subscription = await store.subscribe(planId, paymentMethodId)
      router.push('/subscription')
      return subscription
    } catch (e) {
      console.error('Failed to subscribe:', e)
      throw e
    }
  }

  async function cancelCurrentSubscription(atPeriodEnd = true) {
    try {
      const subscription = await store.cancelSubscription(atPeriodEnd)
      return subscription
    } catch (e) {
      console.error('Failed to cancel subscription:', e)
      throw e
    }
  }

  async function reactivateSubscription() {
    try {
      const subscription = await store.reactivate()
      return subscription
    } catch (e) {
      console.error('Failed to reactivate:', e)
      throw e
    }
  }

  async function switchPlan(planId: number) {
    try {
      const subscription = await store.changePlan(planId)
      return subscription
    } catch (e) {
      console.error('Failed to switch plan:', e)
      throw e
    }
  }

  function goToPlans() {
    router.push('/plans')
  }

  function goToSubscription() {
    router.push('/subscription')
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
    subscribeToPlan,
    cancelCurrentSubscription,
    reactivateSubscription,
    switchPlan,
    goToPlans,
    goToSubscription,

    // Store actions
    loadPlans: store.loadPlans,
    loadCurrentSubscription: store.loadCurrentSubscription,
    loadInvoices: store.loadInvoices,
    downloadInvoice: store.downloadInvoice,
    getPlanById: store.getPlanById,
  }
}
