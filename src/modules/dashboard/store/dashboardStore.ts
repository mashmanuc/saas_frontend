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
  type TutorDashboardSnapshot,
} from '../api/dashboard'
import apiClient from '@/utils/apiClient'

export const useDashboardStore = defineStore('dashboard', () => {
  // State
  // FIX BUG-3: окремі прапори щоб student/tutor не блокували один одного
  const isLoadingStudent = ref(false)
  const isLoadingTutor = ref(false)
  const isLoading = computed(() => isLoadingStudent.value || isLoadingTutor.value) // legacy compat
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

  // Snapshot state (R2: single-call dashboard pattern)
  const snapshot = ref<TutorDashboardSnapshot | null>(null)
  const isLoadingSnapshot = ref(false)

  // Legacy state (for backward compatibility)
  const tutorStudents = ref<unknown[]>([])
  const nextLessonAt = ref<string | null>(null)

  // Phase 28 B8: consolidated /v1/marketplace/me/ (INV-4: UI → store, not inline fetch)
  const isProfilePublished = ref(false)

  // Computed
  const hasUpcomingLessons = computed(() => upcomingLessons.value.length > 0)
  const hasTutor = computed(() => assignedTutor.value !== null)
  const hasActiveTutors = computed(() => activeTutors.value.length > 0)
  const nextLesson = computed(() => upcomingLessons.value[0] || null)

  // Actions
  async function fetchStudentDashboard() {
    if (isLoadingStudent.value) return
    isLoadingStudent.value = true
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
      isLoadingStudent.value = false
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
    if (isLoadingTutor.value) return
    isLoadingTutor.value = true
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
      isLoadingTutor.value = false
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

  /**
   * Fetch tutor dashboard via single snapshot endpoint.
   * Falls back to individual calls if /snapshot/ returns 404.
   * Syncs legacy state fields for backward compatibility.
   * Ref: UX_PRODUCT_VISION.md §R2.4
   */
  async function fetchTutorSnapshot() {
    if (isLoadingSnapshot.value) return
    isLoadingSnapshot.value = true
    error.value = null

    try {
      const data = await dashboardApi.getTutorSnapshot()
      snapshot.value = data
      // Sync legacy state so existing components still work
      todaysLessons.value = data.todays_lessons
      pendingBookingsCount.value = data.pending_inquiries_count
      if (data.stats) {
        tutorStats.value = data.stats
      }
    } catch (err: unknown) {
      const e = err as Error
      error.value = e.message || 'Failed to load dashboard'
      console.error('[Dashboard] Failed to fetch tutor snapshot:', err)
    } finally {
      isLoadingSnapshot.value = false
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
    snapshot.value = null
    error.value = null
    isProfilePublished.value = false
  }

  return {
    // State
    isLoading,
    isLoadingStudent,
    isLoadingTutor,
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

    // Snapshot (R2)
    snapshot,
    isLoadingSnapshot,

    // Phase 28 B8: marketplace me (legacy — Phase 29: useMarketplaceMeQuery)
    isProfilePublished,

    // Actions
    fetchStudentDashboard,
    fetchStudentActiveLessons,
    fetchStudentTeacher,
    fetchTutorDashboard,
    fetchTutorStats,
    fetchTutorSnapshot,
    reset,
  }
})
