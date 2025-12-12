// F3: Wallet Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  paymentsApi,
  Wallet,
  WalletTransaction,
  PayoutRequest,
  EarningsAnalytics,
  PayoutSettings,
} from '../api/payments'

export const useWalletStore = defineStore('wallet', () => {
  // State
  const wallet = ref<Wallet | null>(null)
  const transactions = ref<WalletTransaction[]>([])
  const payouts = ref<PayoutRequest[]>([])
  const analytics = ref<EarningsAnalytics | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Pagination
  const hasMoreTransactions = ref(false)
  const transactionsPage = ref(1)

  // Computed
  const balance = computed(() => wallet.value?.balance || 0)
  const pending = computed(() => wallet.value?.pending || 0)
  const totalEarned = computed(() => wallet.value?.total_earned || 0)
  const totalWithdrawn = computed(() => wallet.value?.total_withdrawn || 0)
  const currency = computed(() => wallet.value?.currency || 'UAH')

  const canWithdraw = computed(() => wallet.value?.can_withdraw || false)
  const payoutThreshold = computed(() => wallet.value?.payout_threshold || 0)

  const pendingPayouts = computed(() =>
    payouts.value.filter((p) => p.status === 'pending' || p.status === 'approved')
  )

  const completedPayouts = computed(() =>
    payouts.value.filter((p) => p.status === 'completed')
  )

  // Format currency helper
  function formatCurrency(amount: number, curr?: string): string {
    const c = curr || currency.value
    return new Intl.NumberFormat('uk-UA', {
      style: 'currency',
      currency: c,
    }).format(amount / 100)
  }

  const balanceFormatted = computed(() => formatCurrency(balance.value))
  const pendingFormatted = computed(() => formatCurrency(pending.value))
  const totalEarnedFormatted = computed(() => formatCurrency(totalEarned.value))

  // Actions
  async function loadWallet(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      wallet.value = await paymentsApi.getWallet()
    } catch (e: any) {
      error.value = e.message || 'Failed to load wallet'
    } finally {
      isLoading.value = false
    }
  }

  async function loadTransactions(
    params?: { type?: string },
    reset = false
  ): Promise<void> {
    if (reset) {
      transactions.value = []
      transactionsPage.value = 1
    }

    try {
      const response = await paymentsApi.getTransactions({
        ...params,
        page: transactionsPage.value,
      })

      if (reset) {
        transactions.value = response.results
      } else {
        transactions.value.push(...response.results)
      }

      hasMoreTransactions.value = !!response.next
    } catch (e: any) {
      error.value = e.message || 'Failed to load transactions'
    }
  }

  async function loadMoreTransactions(params?: { type?: string }): Promise<void> {
    if (!hasMoreTransactions.value || isLoading.value) return
    transactionsPage.value++
    await loadTransactions(params, false)
  }

  async function loadAnalytics(
    period: 'week' | 'month' | 'year' = 'month'
  ): Promise<void> {
    try {
      analytics.value = await paymentsApi.getEarningsAnalytics(period)
    } catch (e: any) {
      error.value = e.message || 'Failed to load analytics'
    }
  }

  async function loadPayouts(): Promise<void> {
    try {
      payouts.value = await paymentsApi.getPayouts()
    } catch (e: any) {
      error.value = e.message || 'Failed to load payouts'
    }
  }

  async function requestPayout(amount?: number): Promise<PayoutRequest> {
    try {
      const payout = await paymentsApi.requestPayout(amount)
      payouts.value.unshift(payout)
      await loadWallet() // Refresh balance
      return payout
    } catch (e: any) {
      error.value = e.message || 'Failed to request payout'
      throw e
    }
  }

  async function cancelPayout(id: number): Promise<void> {
    try {
      await paymentsApi.cancelPayout(id)
      payouts.value = payouts.value.filter((p) => p.id !== id)
      await loadWallet()
    } catch (e: any) {
      error.value = e.message || 'Failed to cancel payout'
      throw e
    }
  }

  async function updatePayoutSettings(settings: PayoutSettings): Promise<void> {
    try {
      wallet.value = await paymentsApi.updatePayoutSettings(settings)
    } catch (e: any) {
      error.value = e.message || 'Failed to update payout settings'
      throw e
    }
  }

  function $reset(): void {
    wallet.value = null
    transactions.value = []
    payouts.value = []
    analytics.value = null
    isLoading.value = false
    error.value = null
    hasMoreTransactions.value = false
    transactionsPage.value = 1
  }

  return {
    // State
    wallet,
    transactions,
    payouts,
    analytics,
    isLoading,
    error,
    hasMoreTransactions,

    // Computed
    balance,
    pending,
    totalEarned,
    totalWithdrawn,
    currency,
    canWithdraw,
    payoutThreshold,
    pendingPayouts,
    completedPayouts,
    balanceFormatted,
    pendingFormatted,
    totalEarnedFormatted,

    // Actions
    loadWallet,
    loadTransactions,
    loadMoreTransactions,
    loadAnalytics,
    loadPayouts,
    requestPayout,
    cancelPayout,
    updatePayoutSettings,
    formatCurrency,
    $reset,
  }
})
