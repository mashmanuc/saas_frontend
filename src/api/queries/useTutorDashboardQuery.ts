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
    // Marketplace Extraction 2026-06-18: `/v1/marketplace/me/` вимкнено (BYO не має
    // публічного профілю). Повертаємо статичний дефолт замість 404-виклику (раніше
    // 404 + необроблена відповідь → краш на дашборді / підвисання дзвіночка).
    queryFn: () => Promise.resolve({ is_published: false } as any),
    staleTime: Infinity,
    ...options,
  })

  const isProfilePublished = computed(() => !!query.data.value?.is_published)

  return {
    ...query,
    isProfilePublished,
  }
}
