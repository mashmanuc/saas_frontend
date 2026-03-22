/**
 * Phase 29: Tutor Dashboard Query + Marketplace Me Query
 *
 * Replaces dashboardStore.fetchTutorDashboard() + fetchMarketplaceMe()
 * with declarative queries.
 *
 * INV-1: READ-only. Mutations → store → invalidateQueries()
 * INV-5: Uses queryKeys.tutorDashboard() / queryKeys.marketplaceMe()
 */
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { queryKeys } from '@/api/queryKeys'
import { dashboardApi } from '@/modules/dashboard/api/dashboard'
import apiClient from '@/utils/apiClient'

export function useTutorDashboardQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.tutorDashboard(),
    queryFn: () => dashboardApi.getTutorDashboard(),
    staleTime: 2 * 60_000, // 2 хв
    ...options,
  })
}

/**
 * Marketplace profile published status.
 * Endpoint: GET /v1/marketplace/me/
 * Phase 28: consolidated from DashboardTutor.vue + TutorHome.vue inline fetches.
 */
export function useMarketplaceMeQuery(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: queryKeys.marketplaceMe(),
    queryFn: () => apiClient.get('/v1/marketplace/me/', { meta: { skipLoader: true } } as any),
    staleTime: 5 * 60_000, // 5 хв — рідко змінюється
    ...options,
  })

  const isProfilePublished = computed(() => !!query.data.value?.is_published)

  return {
    ...query,
    isProfilePublished,
  }
}
