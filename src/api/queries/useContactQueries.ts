/**
 * Phase 29: Contact Queries
 *
 * Replaces contactsStore.fetchBalance() + fetchStats()
 * INV-1: READ-only. Mutations (afterAcceptRefresh) → store → invalidateQueries()
 * INV-5: Uses queryKeys.contactBalance() / queryKeys.contactStats()
 */
import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '@/api/queryKeys'
import { contactsApi } from '@/modules/contacts/api/contacts'
import { getInquiryStats } from '@/api/billing'

export function useContactBalanceQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.contactBalance(),
    queryFn: () => contactsApi.getBalance(),
    staleTime: 2 * 60_000, // 2 хв
    ...options,
  })
}

export function useContactStatsQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.contactStats(),
    queryFn: () => getInquiryStats(),
    staleTime: 2 * 60_000, // 2 хв
    ...options,
  })
}
