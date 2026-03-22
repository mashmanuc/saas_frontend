/**
 * Phase 29: Inquiries Query
 *
 * Replaces inquiriesStore.fetchInquiries()
 * Filters as reactive queryKey for automatic refetch on filter change.
 *
 * INV-1: READ-only. Mutations (create/cancel/accept/reject) → store → invalidateQueries()
 * INV-5: Uses queryKeys.inquiries() / queryKeys.inquiriesFiltered()
 */
import { useQuery } from '@tanstack/vue-query'
import { queryKeys } from '@/api/queryKeys'
import { fetchInquiries as apiFetchInquiries } from '@/api/inquiries'
import type { InquiryFilters, InquiryDTO } from '@/types/inquiries'
import type { Ref } from 'vue'
import { computed, unref } from 'vue'

export function useInquiriesQuery(
  filters?: Ref<InquiryFilters> | InquiryFilters,
  options?: { enabled?: boolean }
) {
  const resolvedFilters = computed(() => unref(filters) ?? {})

  return useQuery({
    queryKey: computed(() => {
      const f = resolvedFilters.value
      // Strip force from queryKey — it's not a filter dimension
      const { force, ...keyFilters } = f
      return Object.keys(keyFilters).length > 0
        ? queryKeys.inquiriesFiltered(keyFilters)
        : queryKeys.inquiries()
    }),
    queryFn: (): Promise<InquiryDTO[]> => {
      return apiFetchInquiries(resolvedFilters.value)
    },
    staleTime: 60_000, // 1 хв
    ...options,
  })
}
