/**
 * Phase 29: User Context Query
 *
 * Replaces 3-4 separate store fetches with single declarative query.
 * Endpoint: GET /v1/users/me/context/ (Phase 28, Agent C)
 *
 * Returns: { entitlements, limits, billing }
 *
 * INV-1: This is READ-only. Mutations that affect context
 *        (e.g., plan upgrade) → store action → invalidateQueries(['user-context'])
 * INV-5: Uses queryKeys.userContext() — not hardcoded string
 */
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { queryKeys } from '@/api/queryKeys'
import apiClient from '@/utils/apiClient'

export interface UserContextEntitlements {
  plan: string
  features: string[]
  expires_at: string | null
  is_in_grace_period: boolean
  grace_period_until: string | null
}

export interface UserContextLimit {
  limit_type: string
  max_count: number
  current_count: number
  remaining: number
  reset_at: string | null
  period_days: number
}

export interface UserContextBilling {
  balance: number | null
}

export interface UserContextResponse {
  entitlements: UserContextEntitlements
  limits: { limits: UserContextLimit[] }
  billing: UserContextBilling
}

export function useUserContextQuery(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: queryKeys.userContext(),
    queryFn: () => apiClient.get<UserContextResponse>('/v1/users/me/context/'),
    staleTime: 5 * 60_000, // 5 хв — рідко змінюється
    ...options,
  })

  // Convenience computed accessors
  const entitlements = computed(() => query.data.value?.entitlements ?? null)
  const limits = computed(() => query.data.value?.limits?.limits ?? [])
  const billing = computed(() => query.data.value?.billing ?? null)
  const plan = computed(() => query.data.value?.entitlements?.plan ?? 'FREE')
  const isPro = computed(() => plan.value === 'PRO' || plan.value === 'BUSINESS')
  const isFree = computed(() => plan.value === 'FREE')

  return {
    ...query,
    entitlements,
    limits,
    billing,
    plan,
    isPro,
    isFree,
  }
}
