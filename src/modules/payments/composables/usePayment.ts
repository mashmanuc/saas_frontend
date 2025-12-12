// F30: usePayment composable
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { usePaymentStore } from '../stores/paymentStore'
import { paymentsApi } from '../api/payments'

export function usePayment() {
  const store = usePaymentStore()
  const router = useRouter()

  const {
    payments,
    currentPayment,
    paymentMethods,
    isLoading,
    error,
    checkoutInProgress,
    clientSecret,
    defaultPaymentMethod,
    completedPayments,
    pendingPayments,
    totalSpent,
  } = storeToRefs(store)

  async function payForBooking(bookingId: number, amount: number, currency = 'UAH') {
    try {
      await store.initiatePayment({
        amount,
        payment_type: 'lesson',
        booking_id: bookingId,
        currency,
      })

      router.push({
        path: '/checkout',
        query: {
          booking: bookingId.toString(),
          amount: amount.toString(),
          currency,
        },
      })
    } catch (e) {
      console.error('Failed to initiate payment:', e)
      throw e
    }
  }

  async function refundPayment(paymentId: number, reason?: string) {
    try {
      const payment = await store.requestRefund(paymentId, reason)
      return payment
    } catch (e) {
      console.error('Failed to request refund:', e)
      throw e
    }
  }

  async function addCard(providerMethodId: string) {
    try {
      const method = await store.addPaymentMethod(providerMethodId)
      return method
    } catch (e) {
      console.error('Failed to add card:', e)
      throw e
    }
  }

  async function removeCard(methodId: number) {
    try {
      await store.removePaymentMethod(methodId)
    } catch (e) {
      console.error('Failed to remove card:', e)
      throw e
    }
  }

  async function setDefaultCard(methodId: number) {
    try {
      await store.setDefaultMethod(methodId)
    } catch (e) {
      console.error('Failed to set default card:', e)
      throw e
    }
  }

  function goToCheckout(options: {
    type: string
    amount: number
    currency?: string
    bookingId?: number
    planId?: number
  }) {
    const query: Record<string, string> = {
      type: options.type,
      amount: options.amount.toString(),
      currency: options.currency || 'UAH',
    }

    if (options.bookingId) {
      query.booking = options.bookingId.toString()
    }
    if (options.planId) {
      query.plan = options.planId.toString()
    }

    router.push({ path: '/checkout', query })
  }

  return {
    // State
    payments,
    currentPayment,
    paymentMethods,
    isLoading,
    error,
    checkoutInProgress,
    clientSecret,

    // Computed
    defaultPaymentMethod,
    completedPayments,
    pendingPayments,
    totalSpent,

    // Actions
    payForBooking,
    refundPayment,
    addCard,
    removeCard,
    setDefaultCard,
    goToCheckout,

    // Store actions
    loadPayments: store.loadPayments,
    loadPaymentMethods: store.loadPaymentMethods,
    initiatePayment: store.initiatePayment,
    confirmPayment: store.confirmPayment,
    resetCheckout: store.resetCheckout,
  }
}
