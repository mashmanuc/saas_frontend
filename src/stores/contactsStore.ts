/**
 * Contacts Store — inquiry stats / decline-streak (anti-abuse).
 *
 * Ф5 (token-teardown, 2026-07-20): balance/ledger ВИДАЛЕНО — контакт-токени
 * вилучено з продукту (BE endpoint'и balance/ledger не існують). Лишається
 * ЖИВЕ: inquiry stats (decline_streak / is_blocked_by_decline_streak —
 * anti-abuse apps.limits, НЕ монетизація).
 *
 * Споживач: TutorInquiriesView (fetchStats + afterAcceptRefresh).
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { InquiryStatsDTO } from '@/types/billing'
import { getInquiryStats } from '@/api/billing'
import { rethrowAsDomainError } from '@/utils/rethrowAsDomainError'
import { queryClient } from '@/app/queryClient'
import { queryKeys } from '@/api/queryKeys'

export const useContactsStore = defineStore('contacts', () => {
  // State
  const stats = ref<InquiryStatsDTO | null>(null)
  const isLoadingStats = ref(false)
  const errorStats = ref<string | null>(null)

  // Computed (anti-abuse decline-streak)
  const isBlocked = computed(() => stats.value?.is_blocked_by_decline_streak ?? false)
  const declineStreak = computed(() => stats.value?.decline_streak ?? 0)

  /**
   * Fetch inquiry stats — GET /api/v1/inquiries/stats/
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
   * Refresh після accept: stats-only (balance/ledger не існують).
   */
  async function afterAcceptRefresh(): Promise<void> {
    queryClient.invalidateQueries({ queryKey: queryKeys.contactStats() })
    await fetchStats()
  }

  /**
   * Clear all state (logout)
   */
  function $reset(): void {
    stats.value = null
    isLoadingStats.value = false
    errorStats.value = null
  }

  return {
    // State
    stats,
    isLoadingStats,
    errorStats,

    // Computed
    isBlocked,
    declineStreak,

    // Actions
    fetchStats,
    afterAcceptRefresh,
    $reset,
  }
})
