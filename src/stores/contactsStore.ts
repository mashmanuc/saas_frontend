/**
 * Contacts Store - Phase 2.3
 * 
 * Управління contact tokens (balance, ledger, stats)
 * 
 * Інваріанти Phase 2.3:
 * - INV-1: Pagination тільки через limit+offset (без cursor/infinite-scroll)
 * - INV-3: Після accept → refetch balance + ledger (без локальних підкруток)
 * - INV-5: Error handling → ErrorState (без вічних loaders)
 * 
 * Reference: TECH_SPEC_Phase_2.3.md
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  ContactBalanceDTO,
  ContactLedgerItemDTO,
  InquiryStatsDTO
} from '@/types/billing'
import {
  getContactBalance,
  getContactLedger,
  getInquiryStats
} from '@/api/billing'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'

export const useContactsStore = defineStore('contacts', () => {
  // State
  const balance = ref<number | null>(null)
  const ledger = ref<ContactLedgerItemDTO[]>([])
  const stats = ref<InquiryStatsDTO | null>(null)
  
  // Pagination state (SSOT: limit+offset)
  const ledgerLimit = ref(50)
  const ledgerOffset = ref(0)
  const ledgerHasMore = ref(true)
  
  // Loading states
  const isLoadingBalance = ref(false)
  const isLoadingLedger = ref(false)
  const isLoadingStats = ref(false)
  
  // Error states
  const errorBalance = ref<string | null>(null)
  const errorLedger = ref<string | null>(null)
  const errorStats = ref<string | null>(null)
  
  // Computed
  const hasBalance = computed(() => balance.value !== null)
  const isBlocked = computed(() => stats.value?.is_blocked_by_decline_streak ?? false)
  const declineStreak = computed(() => stats.value?.decline_streak ?? 0)
  
  /**
   * Fetch contact balance
   * Phase 2.3: GET /api/v1/billing/contacts/balance/
   */
  async function fetchBalance(): Promise<void> {
    isLoadingBalance.value = true
    errorBalance.value = null
    
    try {
      const data = await getContactBalance()
      balance.value = data.balance
    } catch (err: any) {
      errorBalance.value = err.message || 'Failed to load balance'
      rethrowAsDomainError(err)
    } finally {
      isLoadingBalance.value = false
    }
  }
  
  /**
   * Fetch inquiry stats
   * Phase 2.3: GET /api/v1/inquiries/stats/
   */
  async function fetchStats(): Promise<void> {
    isLoadingStats.value = true
    errorStats.value = null
    
    try {
      const data = await getInquiryStats()
      stats.value = data
    } catch (err: any) {
      errorStats.value = err.message || 'Failed to load stats'
      rethrowAsDomainError(err)
    } finally {
      isLoadingStats.value = false
    }
  }
  
  /**
   * Fetch ledger with pagination
   * Phase 2.3: GET /api/v1/billing/contacts/ledger/?limit=&offset=
   * 
   * INV-1: SSOT pagination = limit+offset (no cursor)
   * 
   * @param options.limit - Number of records (default 50)
   * @param options.offset - Number of records to skip (default current offset)
   * @param options.append - If true, append to existing ledger; if false, replace
   */
  async function fetchLedger(options: {
    limit?: number
    offset?: number
    append?: boolean
  } = {}): Promise<void> {
    const limit = options.limit ?? ledgerLimit.value
    const offset = options.offset ?? ledgerOffset.value
    const append = options.append ?? false
    
    isLoadingLedger.value = true
    errorLedger.value = null
    
    try {
      const data = await getContactLedger(limit, offset)
      
      if (append) {
        ledger.value = [...ledger.value, ...data]
      } else {
        ledger.value = data
      }
      
      // Update pagination state
      ledgerOffset.value = offset + data.length
      ledgerHasMore.value = data.length === limit
      
    } catch (err: any) {
      errorLedger.value = err.message || 'Failed to load ledger'
      rethrowAsDomainError(err)
    } finally {
      isLoadingLedger.value = false
    }
  }
  
  /**
   * Reset ledger and fetch first page
   * Phase 2.3: Used when opening modal or after mutations
   */
  async function resetLedgerAndFetchFirstPage(): Promise<void> {
    ledger.value = []
    ledgerOffset.value = 0
    ledgerHasMore.value = true
    
    await fetchLedger({ limit: ledgerLimit.value, offset: 0, append: false })
  }
  
  /**
   * Load more ledger items (pagination)
   * Phase 2.3: "Load More" button action
   */
  async function loadMoreLedger(): Promise<void> {
    if (!ledgerHasMore.value || isLoadingLedger.value) {
      return
    }
    
    await fetchLedger({
      limit: ledgerLimit.value,
      offset: ledgerOffset.value,
      append: true
    })
  }
  
  /**
   * Refresh after accept contact
   * Phase 2.3 INV-3: Після accept → refetch balance + ledger
   * 
   * Викликається після успішного InquiryService.accept()
   */
  async function afterAcceptRefresh(): Promise<void> {
    await Promise.all([
      fetchBalance(),
      resetLedgerAndFetchFirstPage()
    ])
  }
  
  /**
   * Clear all state (logout)
   */
  function $reset(): void {
    balance.value = null
    ledger.value = []
    stats.value = null
    ledgerOffset.value = 0
    ledgerHasMore.value = true
    
    isLoadingBalance.value = false
    isLoadingLedger.value = false
    isLoadingStats.value = false
    
    errorBalance.value = null
    errorLedger.value = null
    errorStats.value = null
  }
  
  return {
    // State
    balance,
    ledger,
    stats,
    ledgerLimit,
    ledgerOffset,
    ledgerHasMore,
    
    // Loading
    isLoadingBalance,
    isLoadingLedger,
    isLoadingStats,
    
    // Errors
    errorBalance,
    errorLedger,
    errorStats,
    
    // Computed
    hasBalance,
    isBlocked,
    declineStreak,
    
    // Actions
    fetchBalance,
    fetchStats,
    fetchLedger,
    resetLedgerAndFetchFirstPage,
    loadMoreLedger,
    afterAcceptRefresh,
    $reset
  }
})
