/**
 * Contact Tokens Store
 * 
 * DOMAIN-07: Contact Tokens State Management
 * 
 * Pinia store for managing contact token balance, ledger, and purchases.
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { contactsApi, ContactBalance, ContactLedgerEntry, ContactPackage } from '../api/contacts'

const LOW_BALANCE_THRESHOLD = 3
const CACHE_TTL_MS = 30000 // 30 seconds

export const useContactTokensStore = defineStore('contactTokens', () => {
  // State
  const balance = ref<number>(0)
  const pendingGrants = ref<number>(0)
  const lastGrantDate = ref<string | null>(null)
  const nextAllowanceDate = ref<string | null>(null)
  const planAllowance = ref<number>(0)
  
  const ledger = ref<ContactLedgerEntry[]>([])
  const packages = ref<ContactPackage[]>([])
  const allowanceHistory = ref<Array<{ date: string; amount: number; plan: string }>>([])
  
  const loading = ref(false)
  const error = ref<string | null>(null)
  const lastFetched = ref<number>(0)
  
  // Pagination
  const ledgerCount = ref(0)
  const ledgerHasMore = ref(false)
  const ledgerOffset = ref(0)

  // Getters
  const hasLowBalance = computed(() => balance.value <= LOW_BALANCE_THRESHOLD)
  const hasNoTokens = computed(() => balance.value === 0)
  const isFresh = computed(() => {
    if (!lastFetched.value) return false
    return Date.now() - lastFetched.value < CACHE_TTL_MS
  })

  const formattedBalance = computed(() => {
    return balance.value.toLocaleString('uk-UA')
  })

  const daysUntilAllowance = computed(() => {
    if (!nextAllowanceDate.value) return null
    const next = new Date(nextAllowanceDate.value)
    const now = new Date()
    const diff = next.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })

  const ledgerByType = computed(() => {
    return (type: ContactLedgerEntry['type']) => {
      return ledger.value.filter(entry => entry.type === type)
    }
  })

  // Actions
  async function fetchBalance(force = false): Promise<void> {
    if (!force && isFresh.value) return
    
    loading.value = true
    error.value = null
    
    try {
      const response = await contactsApi.getBalance()
      balance.value = response.balance
      pendingGrants.value = response.pending_grants || 0
      lastGrantDate.value = response.last_grant_date
      nextAllowanceDate.value = response.next_allowance_date
      planAllowance.value = response.plan_allowance || 0
      lastFetched.value = Date.now()
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch balance'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchLedger(
    params: { limit?: number; offset?: number; type?: ContactLedgerEntry['type'] } = {}
  ): Promise<void> {
    const limit = params.limit || 20
    const offset = params.offset || 0
    
    loading.value = true
    error.value = null
    
    try {
      const response = await contactsApi.getLedger({ limit, offset, type: params.type })
      
      if (offset === 0) {
        ledger.value = response.results
      } else {
        ledger.value.push(...response.results)
      }
      
      ledgerCount.value = response.count
      ledgerHasMore.value = !!response.next
      ledgerOffset.value = offset + response.results.length
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch ledger'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loadMoreLedger(): Promise<void> {
    if (!ledgerHasMore.value || loading.value) return
    await fetchLedger({ offset: ledgerOffset.value })
  }

  async function fetchPackages(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await contactsApi.getPackages()
      packages.value = response
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch packages'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function fetchAllowanceInfo(): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      const response = await contactsApi.getAllowanceInfo()
      planAllowance.value = response.plan_allowance
      nextAllowanceDate.value = response.next_grant_date
      lastGrantDate.value = response.last_grant_date
      allowanceHistory.value = response.history || []
    } catch (e: any) {
      error.value = e.message || 'Failed to fetch allowance info'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function purchaseTokens(
    packageId: string,
    redirectUrls: { success: string; cancel: string }
  ): Promise<{ provider: string; redirectUrl: string }> {
    loading.value = true
    error.value = null
    
    try {
      const response = await contactsApi.purchaseTokens({
        package_id: packageId,
        success_url: redirectUrls.success,
        cancel_url: redirectUrls.cancel,
      })
      
      return {
        provider: response.provider,
        redirectUrl: response.redirect_url,
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to initiate purchase'
      throw e
    } finally {
      loading.value = false
    }
  }

  async function grantTokens(
    amount: number,
    reason: string,
    subscriptionId?: number
  ): Promise<void> {
    loading.value = true
    error.value = null
    
    try {
      await contactsApi.grantTokens({
        amount,
        reason,
        subscription_id: subscriptionId,
      })
      // Refresh balance after grant
      await fetchBalance(true)
    } catch (e: any) {
      error.value = e.message || 'Failed to grant tokens'
      throw e
    } finally {
      loading.value = false
    }
  }

  // Optimistic deduction (for inquiry accept)
  function optimisticDeduction(): void {
    if (balance.value > 0) {
      balance.value--
    }
  }

  // Refund (restore token)
  function refundToken(): void {
    balance.value++
  }

  // Refresh after inquiry action
  async function refreshAfterInquiry(): Promise<void> {
    await fetchBalance(true)
    await fetchLedger({ limit: 5 })
  }

  function $reset(): void {
    balance.value = 0
    pendingGrants.value = 0
    lastGrantDate.value = null
    nextAllowanceDate.value = null
    planAllowance.value = 0
    ledger.value = []
    packages.value = []
    allowanceHistory.value = []
    loading.value = false
    error.value = null
    lastFetched.value = 0
    ledgerCount.value = 0
    ledgerHasMore.value = false
    ledgerOffset.value = 0
  }

  return {
    // State
    balance,
    pendingGrants,
    lastGrantDate,
    nextAllowanceDate,
    planAllowance,
    ledger,
    packages,
    allowanceHistory,
    loading,
    error,
    ledgerCount,
    ledgerHasMore,
    
    // Getters
    hasLowBalance,
    hasNoTokens,
    isFresh,
    formattedBalance,
    daysUntilAllowance,
    ledgerByType,
    
    // Actions
    fetchBalance,
    fetchLedger,
    loadMoreLedger,
    fetchPackages,
    fetchAllowanceInfo,
    purchaseTokens,
    grantTokens,
    optimisticDeduction,
    refundToken,
    refreshAfterInquiry,
    $reset,
  }
})
