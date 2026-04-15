/**
 * Dashboard API client.
 */
import apiClient from '@/utils/apiClient'

// Types
export interface ActiveLesson {
  id: number
  scheduled_at: string
  duration_minutes: number
  status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled'
  tutor_name: string | null
  tutor_avatar: string | null
  student_name: string | null
  student_avatar: string | null
  classroom_session_id: string | null
  can_join: boolean
  notes: string | null
}

export interface AssignedTutor {
  id: number
  full_name: string
  email?: string
  avatar_url: string | null
  timezone?: string
  headline: string | null
  subjects: string[]
  average_rating: number | null
  // Collaboration stats (Platform Expansion Law)
  collaboration_status?: 'active' | 'invited' | 'paused' | 'archived'
  lesson_count?: number
  last_activity_at?: string | null
  next_available_slot?: string | null
  // Phase 1 v0.87.1: relation_id для відкриття чату
  relation_id?: number | null
}

export interface StudentStats {
  total_lessons: number
  upcoming_lessons: number
  total_hours: number
  this_month_lessons: number
}

export interface TutorStats {
  total_lessons: number
  total_students: number
  this_month_lessons: number
  pending_bookings: number
}

export interface StudentDashboardData {
  upcoming_lessons: ActiveLesson[]
  assigned_tutor: AssignedTutor | null
  stats: StudentStats
  // Platform Expansion: support for multiple tutors
  active_tutors?: AssignedTutor[]
}

export interface TutorDashboardData {
  todays_lessons: ActiveLesson[]
  pending_bookings_count: number
  week_lessons_count: number
  profile_status: string
}

/**
 * Aggregated snapshot for tutor dashboard (single-call pattern).
 * Ref: UX_PRODUCT_VISION.md §R2.4
 * Extensible: нові поля додаються без зміни контракту.
 */
export interface TutorDashboardSnapshot {
  greeting_name: string
  todays_lessons: ActiveLesson[]
  stats: TutorStats
  pending_inquiries_count: number
  unread_messages_count: number
  profile_status: 'draft' | 'published' | 'suspended'
}

/**
 * Phase 29 (Activation) — Hero Primary CTA.
 * Ref: saas_docs/plans/DASHBOARD_ACTIVATION_PLAN.md §3.4
 *
 * Backend обчислює priority-based CTA. Frontend лише рендерить.
 */
export type PrimaryCtaType =
  | 'join_lesson'
  | 'answer_inquiry'
  | 'resume_draft'
  | 'resume_last_lesson'
  | 'create_lesson'
  | 'prepare_lesson' // student
  | 'find_tutor' // student

export type UrgencyLevel = 'high' | 'medium' | 'low'

export interface PrimaryCta {
  type: PrimaryCtaType
  title_key: string
  title_params: Record<string, string | number>
  subtitle: string | null
  label_key: string
  action_url: string
  urgency: UrgencyLevel
  metadata: Record<string, unknown>
}

export interface DashboardSecondary {
  today_lessons_remaining?: Array<{
    booking_id: string
    time: string | null
    student_name: string
  }>
  pending_inquiries_count?: number
  draft_lessons?: Array<{ id: string; title: string; updated_at: string | null }>
  upcoming_count?: number
  last_completed_lesson?: {
    booking_id: string
    counterpart_name: string
    completed_at: string | null
  } | null
}

export interface DashboardBanners {
  trial_days_left?: number
  profile_published?: boolean
}

/**
 * Phase 29: розширена форма snapshot — додано primary_cta / secondary / banners.
 * Старі поля (todays_lessons, stats, etc.) збережено для backward-compat.
 */
export interface DashboardSnapshotV2 extends Partial<TutorDashboardSnapshot> {
  primary_cta: PrimaryCta
  secondary: DashboardSecondary
  banners: DashboardBanners
}

// API
export const dashboardApi = {
  // Student endpoints
  getStudentDashboard(): Promise<StudentDashboardData> {
    return apiClient.get('/v1/dashboard/student/')
  },

  getStudentActiveLessons(): Promise<{ count: number; results: ActiveLesson[] }> {
    return apiClient.get('/v1/dashboard/student/active-lessons/')
  },

  getStudentTeacher(): Promise<{ tutor: AssignedTutor | null }> {
    return apiClient.get('/v1/dashboard/student/teacher/')
  },

  getStudentStats(): Promise<StudentStats> {
    return apiClient.get('/v1/dashboard/student/stats/')
  },

  // Tutor endpoints
  getTutorDashboard(): Promise<TutorDashboardData> {
    return apiClient.get('/v1/dashboard/tutor/')
  },

  getTutorUpcoming(): Promise<{ count: number; results: ActiveLesson[] }> {
    return apiClient.get('/v1/dashboard/tutor/upcoming/')
  },

  getTutorStudents(): Promise<{ count: number; results: unknown[] }> {
    return apiClient.get('/v1/dashboard/tutor/students/')
  },

  getTutorStats(): Promise<TutorStats> {
    return apiClient.get('/v1/dashboard/tutor/stats/')
  },

  /**
   * Single snapshot endpoint for tutor dashboard.
   * Falls back to individual calls if snapshot endpoint doesn't exist (404).
   * Ref: UX_PRODUCT_VISION.md §R2.4
   */
  async getTutorSnapshot(): Promise<TutorDashboardSnapshot> {
    try {
      return await apiClient.get('/v1/dashboard/tutor/snapshot/')
    } catch (err: unknown) {
      // as any cast: apiClient errors have response property but TS doesn't know the shape
      const httpErr = err as { response?: { status?: number } }
      if (httpErr?.response?.status === 404) {
        // Fallback: збираємо з окремих endpoints
        const [dashboard, stats] = await Promise.all([
          apiClient.get('/v1/dashboard/tutor/') as Promise<TutorDashboardData>,
          (apiClient.get('/v1/dashboard/tutor/stats/') as Promise<TutorStats>).catch(() => null),
        ])
        return {
          greeting_name: '',
          todays_lessons: dashboard.todays_lessons || [],
          stats: stats || { total_lessons: 0, total_students: 0, this_month_lessons: 0, pending_bookings: 0 },
          pending_inquiries_count: dashboard.pending_bookings_count || 0,
          unread_messages_count: 0,
          // as cast: profile_status from TutorDashboardData is string, snapshot expects union type
          profile_status: (dashboard.profile_status as TutorDashboardSnapshot['profile_status']) || 'draft',
        }
      }
      throw err
    }
  },
}

export default dashboardApi
