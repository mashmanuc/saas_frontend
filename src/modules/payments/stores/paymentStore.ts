// F2: Payment Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { paymentsApi, Payment, PaymentMethod } from '../api/payments'

export const usePaymentStore = defineStore('payments', () => {
  // State
  const payments = ref<Payment[]>([])
  const currentPayment = ref<Payment | null>(null)
  const paymentMethods = ref<PaymentMethod[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Checkout state
  const checkoutInProgress = ref(false)
  const clientSecret = ref<string | null>(null)
  const pendingPaymentId = ref<number | null>(null)

  // Pagination
  const hasMore = ref(false)
  const currentPage = ref(1)
  const totalCount = ref(0)

  // Computed
  const defaultPaymentMethod = computed(() =>
    paymentMethods.value.find((m) => m.is_default)
  )

  const completedPayments = computed(() =>
    payments.value.filter((p) => p.status === 'completed')
  )

  const pendingPayments = computed(() =>
    payments.value.filter((p) => p.status === 'pending' || p.status === 'processing')
  )

  const totalSpent = computed(() =>
    completedPayments.value.reduce((sum, p) => sum + p.amount, 0)
  )

  // Actions
  async function loadPayments(
    params?: { status?: string; type?: string },
    reset = false
  ): Promise<void> {
    if (reset) {
      payments.value = []
      currentPage.value = 1
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await paymentsApi.getPayments({
        ...params,
        page: currentPage.value,
      })

      if (reset) {
        payments.value = response.results
      } else {
        payments.value.push(...response.results)
      }

      totalCount.value = response.count
      hasMore.value = !!response.next
    } catch (e: any) {
      error.value = e.message || 'Failed to load payments'
    } finally {
      isLoading.value = false
    }
  }

  async function loadMorePayments(params?: { status?: string; type?: string }): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await loadPayments(params, false)
  }

  async function loadPayment(id: number): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      currentPayment.value = await paymentsApi.getPayment(id)
    } catch (e: any) {
      error.value = e.message || 'Failed to load payment'
    } finally {
      isLoading.value = false
    }
  }

  async function loadPaymentMethods(): Promise<void> {
    try {
      paymentMethods.value = await paymentsApi.getPaymentMethods()
    } catch (e: any) {
      error.value = e.message || 'Failed to load payment methods'
    }
  }

  async function initiatePayment(data: {
    amount: number
    payment_type: string
    booking_id?: number
    currency?: string
  }): Promise<{ payment_id: number; client_secret: string }> {
    checkoutInProgress.value = true
    error.value = null

    try {
      const response = await paymentsApi.createPaymentIntent(data)
      clientSecret.value = response.client_secret
      pendingPaymentId.value = response.payment_id
      return response
    } catch (e: any) {
      checkoutInProgress.value = false
      error.value = e.message || 'Failed to initiate payment'
      throw e
    }
  }

  async function confirmPayment(paymentIntentId: string): Promise<Payment> {
    if (!pendingPaymentId.value) {
      throw new Error('No pending payment')
    }

    try {
      const payment = await paymentsApi.confirmPayment(
        pendingPaymentId.value,
        paymentIntentId
      )

      currentPayment.value = payment
      payments.value.unshift(payment)
      checkoutInProgress.value = false
      clientSecret.value = null
      pendingPaymentId.value = null

      return payment
    } catch (e: any) {
      error.value = e.message || 'Failed to confirm payment'
      throw e
    }
  }

  async function requestRefund(id: number, reason?: string): Promise<Payment> {
    try {
      const payment = await paymentsApi.requestRefund(id, reason)
      updatePaymentInList(payment)
      return payment
    } catch (e: any) {
      error.value = e.message || 'Failed to request refund'
      throw e
    }
  }

  async function addPaymentMethod(providerMethodId: string): Promise<PaymentMethod> {
    try {
      const method = await paymentsApi.addPaymentMethod(providerMethodId)
      paymentMethods.value.push(method)
      return method
    } catch (e: any) {
      error.value = e.message || 'Failed to add payment method'
      throw e
    }
  }

  async function removePaymentMethod(id: number): Promise<void> {
    try {
      await paymentsApi.removePaymentMethod(id)
      paymentMethods.value = paymentMethods.value.filter((m) => m.id !== id)
    } catch (e: any) {
      error.value = e.message || 'Failed to remove payment method'
      throw e
    }
  }

  async function setDefaultMethod(id: number): Promise<PaymentMethod> {
    try {
      const method = await paymentsApi.setDefaultPaymentMethod(id)
      paymentMethods.value.forEach((m) => {
        m.is_default = m.id === id
      })
      return method
    } catch (e: any) {
      error.value = e.message || 'Failed to set default method'
      throw e
    }
  }

  function updatePaymentInList(payment: Payment): void {
    const index = payments.value.findIndex((p) => p.id === payment.id)
    if (index !== -1) {
      payments.value[index] = payment
    }
    if (currentPayment.value?.id === payment.id) {
      currentPayment.value = payment
    }
  }

  function resetCheckout(): void {
    checkoutInProgress.value = false
    clientSecret.value = null
    pendingPaymentId.value = null
  }

  function $reset(): void {
    payments.value = []
    currentPayment.value = null
    paymentMethods.value = []
    isLoading.value = false
    error.value = null
    checkoutInProgress.value = false
    clientSecret.value = null
    pendingPaymentId.value = null
    hasMore.value = false
    currentPage.value = 1
    totalCount.value = 0
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
    pendingPaymentId,
    hasMore,
    currentPage,
    totalCount,

    // Computed
    defaultPaymentMethod,
    completedPayments,
    pendingPayments,
    totalSpent,

    // Actions
    loadPayments,
    loadMorePayments,
    loadPayment,
    loadPaymentMethods,
    initiatePayment,
    confirmPayment,
    requestRefund,
    addPaymentMethod,
    removePaymentMethod,
    setDefaultMethod,
    resetCheckout,
    $reset,
  }
})
