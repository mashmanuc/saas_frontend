/**
 * Phase 29: TanStack Query — QueryClient configuration
 *
 * Central query client for all declarative data fetching.
 * Replaces Phase 28's manual TTL pattern.
 *
 * Config rationale:
 * - staleTime 60s: matches Phase 28's most common TTL (relations, inquiries)
 * - gcTime 5min: keep unused data in memory for back-navigation
 * - retry 1: single retry, don't create retry storms
 * - refetchOnWindowFocus false: explicit UX, not surprising background refetches
 * - refetchOnReconnect true: refresh data after offline → online
 */
import { QueryClient } from '@tanstack/vue-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,          // 1 хв — дані "свіжі" після fetch
      gcTime: 5 * 60_000,         // 5 хв — garbage collection
      retry: 1,                    // 1 retry on failure
      refetchOnWindowFocus: false, // НЕ refetch при tab switch
      refetchOnReconnect: true,    // refetch при reconnect
      refetchOnMount: true,        // refetch при mount якщо stale
    },
  },
})
