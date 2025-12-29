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
}

export default dashboardApi
