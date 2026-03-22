/**
 * Phase 29: Relations Query
 *
 * Replaces relationsStore.fetchTutorRelations() + fetchStudentRelations()
 * INV-1: Query = READ only. Mutations stay in relationsStore.
 * INV-5: Uses queryKeys.relations() / queryKeys.relationsFiltered()
 *
 * Pagination: queryKey includes filters for automatic cache separation
 */
import { useQuery } from '@tanstack/vue-query'
import { queryKeys, type RelationFilters } from '@/api/queryKeys'
import relationsApi from '@/api/relations'
import type { Ref } from 'vue'
import { computed, unref } from 'vue'

export function useRelationsQuery(
  filters?: Ref<RelationFilters> | RelationFilters,
  options?: { enabled?: boolean }
) {
  const resolvedFilters = computed(() => unref(filters) ?? {})

  return useQuery({
    queryKey: computed(() => {
      const f = resolvedFilters.value
      return Object.keys(f).length > 0
        ? queryKeys.relationsFiltered(f)
        : queryKeys.relations()
    }),
    queryFn: () => {
      const f = resolvedFilters.value
      const params: Record<string, any> = {}
      if (f.role) params.role = f.role
      if (f.status) params.status = f.status
      if (f.cursor) params.cursor = f.cursor
      // Use role-specific API for proper endpoint routing
      if (f.role === 'tutor') {
        return relationsApi.getTutorRelations(params)
      }
      return relationsApi.getStudentRelations(params)
    },
    staleTime: 60_000, // 1 хв
    ...options,
  })
}

/**
 * Convenience: tutor relations only
 */
export function useTutorRelationsQuery(
  filters?: Ref<Omit<RelationFilters, 'role'>> | Omit<RelationFilters, 'role'>,
  options?: { enabled?: boolean }
) {
  const merged = computed(() => ({ ...unref(filters), role: 'tutor' as const }))
  return useRelationsQuery(merged, options)
}

/**
 * Convenience: student relations only
 */
export function useStudentRelationsQuery(
  filters?: Ref<Omit<RelationFilters, 'role'>> | Omit<RelationFilters, 'role'>,
  options?: { enabled?: boolean }
) {
  const merged = computed(() => ({ ...unref(filters), role: 'student' as const }))
  return useRelationsQuery(merged, options)
}
