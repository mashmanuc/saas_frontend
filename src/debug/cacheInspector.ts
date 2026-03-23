/**
 * Phase 30: Cache Inspector — TanStack Query cache stats
 *
 * Reads query cache state (INV-1: read-only, no modifications).
 *
 * Hit rate calculation (per user spec):
 * - Only count queries that have dataUpdatedAt (i.e., have fetched at least once)
 * - hit = query is fresh AND not currently fetching (won't refetch on mount)
 * - hitRate = hits / eligible queries
 */
import { queryClient } from '@/app/queryClient'

export interface CacheStats {
  total: number
  fresh: number
  stale: number
  hitRate: number
}

export function inspectQueryCache(): CacheStats {
  try {
    const queries = queryClient.getQueryCache().getAll()
    const total = queries.length
    if (total === 0) return { total: 0, fresh: 0, stale: 0, hitRate: 1 }

    const now = Date.now()

    // Only consider queries that have actually fetched data (have dataUpdatedAt)
    const eligible = queries.filter(query => query.state.dataUpdatedAt > 0)

    if (eligible.length === 0) {
      return { total, fresh: 0, stale: total, hitRate: 0 }
    }

    const fresh = eligible.filter(query => {
      const state = query.state
      // staleTime from query options, fallback to queryClient default (60s)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const staleTime = (query.options as any)?.staleTime ?? 60_000
      const isFresh = (now - state.dataUpdatedAt) < staleTime
      // hit = fresh AND not currently fetching (won't trigger refetch on mount)
      const isFetching = state.fetchStatus === 'fetching'
      return isFresh && !isFetching
    }).length

    return {
      total,
      fresh,
      stale: total - fresh,
      hitRate: fresh / eligible.length,
    }
  } catch {
    return { total: 0, fresh: 0, stale: 0, hitRate: 1 }
  }
}
