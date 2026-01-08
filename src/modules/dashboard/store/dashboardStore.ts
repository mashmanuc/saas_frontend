/**
 * Dashboard store.
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  dashboardApi,
  type ActiveLesson,
  type AssignedTutor,
  type StudentStats,
  type TutorStats,
} from '../api/dashboard'

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Student state
  const upcomingLessons = ref<ActiveLesson[]>([])
  const assignedTutor = ref<AssignedTutor | null>(null)
  const studentStats = ref<StudentStats | null>(null)
  const activeTutors = ref<AssignedTutor[]>([])

  // Tutor state
  const todaysLessons = ref<ActiveLesson[]>([])
  const pendingBookingsCount = ref(0)
  const tutorStats = ref<TutorStats | null>(null)

  // Legacy state (for backward compatibility)
  const tutorStudents = ref<unknown[]>([])
  const nextLessonAt = ref<string | null>(null)

  // Computed
  const hasUpcomingLessons = computed(() => upcomingLessons.value.length > 0)
  const hasTutor = computed(() => assignedTutor.value !== null)
  const hasActiveTutors = computed(() => activeTutors.value.length > 0)
  const nextLesson = computed(() => upcomingLessons.value[0] || null)

  // Actions
  async function fetchStudentDashboard() {
    isLoading.value = true
    error.value = null

    try {
      const data = await dashboardApi.getStudentDashboard()
      upcomingLessons.value = data.upcoming_lessons
      assignedTutor.value = data.assigned_tutor
      
      // Populate activeTutors from assigned_tutor if present
      if (data.assigned_tutor) {
        activeTutors.value = [data.assigned_tutor]
      }
      
      studentStats.value = {
        total_lessons: data.stats.total_lessons,
        upcoming_lessons: data.stats.upcoming_lessons,
        total_hours: data.stats.total_lessons,
        this_month_lessons: 0,
      }
    } catch (err: unknown) {
      const e = err as Error
      error.value = e.message || 'Failed to load dashboard'
      console.error('[Dashboard] Failed to fetch student dashboard:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchStudentActiveLessons() {
    try {
      const data = await dashboardApi.getStudentActiveLessons()
      upcomingLessons.value = data.results
    } catch (err: unknown) {
      console.error('[Dashboard] Failed to fetch active lessons:', err)
    }
  }

  async function fetchStudentTeacher() {
    try {
      const data = await dashboardApi.getStudentTeacher()
      assignedTutor.value = data.tutor
    } catch (err: unknown) {
      console.error('[Dashboard] Failed to fetch teacher:', err)
    }
  }

  async function fetchTutorDashboard() {
    isLoading.value = true
    error.value = null

    try {
      const data = await dashboardApi.getTutorDashboard()
      todaysLessons.value = data.todays_lessons
      pendingBookingsCount.value = data.pending_bookings_count
    } catch (err: unknown) {
      const e = err as Error
      error.value = e.message || 'Failed to load dashboard'
      console.error('[Dashboard] Failed to fetch tutor dashboard:', err)
    } finally {
      isLoading.value = false
    }
  }

  async function fetchTutorStats() {
    try {
      const data = await dashboardApi.getTutorStats()
      tutorStats.value = data
    } catch (err: unknown) {
      console.error('[Dashboard] Failed to fetch tutor stats:', err)
    }
  }

  function reset() {
    upcomingLessons.value = []
    assignedTutor.value = null
    activeTutors.value = []
    studentStats.value = null
    todaysLessons.value = []
    pendingBookingsCount.value = 0
    tutorStats.value = null
    tutorStudents.value = []
    nextLessonAt.value = null
    error.value = null
  }

  return {
    // State
    isLoading,
    error,
    upcomingLessons,
    assignedTutor,
    activeTutors,
    studentStats,
    todaysLessons,
    pendingBookingsCount,
    tutorStats,
    tutorStudents,
    nextLessonAt,

    // Computed
    hasUpcomingLessons,
    hasTutor,
    hasActiveTutors,
    nextLesson,

    // Actions
    fetchStudentDashboard,
    fetchStudentActiveLessons,
    fetchStudentTeacher,
    fetchTutorDashboard,
    fetchTutorStats,
    reset,
  }
})
