/**
 * Phase 29: Student Dashboard Query
 *
 * Replaces dashboardStore.fetchStudentDashboard() with declarative query.
 * Endpoint: GET /v1/dashboard/student/
 *
 * INV-1: READ-only. Mutations → store → invalidateQueries(['student-dashboard'])
 * INV-5: Uses queryKeys.studentDashboard()
 */
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { queryKeys } from '@/api/queryKeys'
import { dashboardApi, type StudentDashboardData, type AssignedTutor } from '@/modules/dashboard/api/dashboard'

export function useStudentDashboardQuery(options?: { enabled?: boolean }) {
  const query = useQuery({
    queryKey: queryKeys.studentDashboard(),
    queryFn: () => dashboardApi.getStudentDashboard(),
    staleTime: 2 * 60_000, // 2 хв
    ...options,
  })

  // Convenience accessors — replaces dashboardStore.xxx reads
  const upcomingLessons = computed(() => query.data.value?.upcoming_lessons ?? [])
  const assignedTutor = computed(() => query.data.value?.assigned_tutor ?? null)
  const activeTutors = computed<AssignedTutor[]>(() => {
    const data = query.data.value
    if (!data) return []
    if (data.active_tutors?.length) return data.active_tutors
    return data.assigned_tutor ? [data.assigned_tutor] : []
  })
  const studentStats = computed(() => query.data.value?.stats ?? null)

  return {
    ...query,
    upcomingLessons,
    assignedTutor,
    activeTutors,
    studentStats,
  }
}
