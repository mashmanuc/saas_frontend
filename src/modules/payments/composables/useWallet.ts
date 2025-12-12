// F31: useWallet composable
import { onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useWalletStore } from '../stores/walletStore'

export function useWallet() {
  const store = useWalletStore()

  const {
    wallet,
    transactions,
    payouts,
    analytics,
    isLoading,
    error,
    hasMoreTransactions,
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
  } = storeToRefs(store)

  onMounted(() => {
    store.loadWallet()
  })

  async function withdraw(amount?: number) {
    try {
      const payout = await store.requestPayout(amount)
      return payout
    } catch (e) {
      console.error('Failed to request payout:', e)
      throw e
    }
  }

  async function cancelWithdrawal(payoutId: number) {
    try {
      await store.cancelPayout(payoutId)
    } catch (e) {
      console.error('Failed to cancel payout:', e)
      throw e
    }
  }

  async function refreshWallet() {
    await store.loadWallet()
  }

  async function loadEarnings(period: 'week' | 'month' | 'year' = 'month') {
    await store.loadAnalytics(period)
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
    withdraw,
    cancelWithdrawal,
    refreshWallet,
    loadEarnings,

    // Store actions
    loadWallet: store.loadWallet,
    loadTransactions: store.loadTransactions,
    loadMoreTransactions: store.loadMoreTransactions,
    loadAnalytics: store.loadAnalytics,
    loadPayouts: store.loadPayouts,
    updatePayoutSettings: store.updatePayoutSettings,
    formatCurrency: store.formatCurrency,
  }
}
