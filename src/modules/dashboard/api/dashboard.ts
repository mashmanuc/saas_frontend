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
  avatar_url: string | null
  headline: string | null
  subjects: string[]
  average_rating: number | null
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
  stats: {
    total_lessons: number
    upcoming_count: number
  }
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
  async getStudentDashboard(): Promise<StudentDashboardData> {
    const response = await apiClient.get('/api/v1/dashboard/student/')
    return response.data
  },

  async getStudentActiveLessons(): Promise<{ count: number; results: ActiveLesson[] }> {
    const response = await apiClient.get('/api/v1/dashboard/student/active-lessons/')
    return response.data
  },

  async getStudentTeacher(): Promise<{ tutor: AssignedTutor | null }> {
    const response = await apiClient.get('/api/v1/dashboard/student/teacher/')
    return response.data
  },

  async getStudentStats(): Promise<StudentStats> {
    const response = await apiClient.get('/api/v1/dashboard/student/stats/')
    return response.data
  },

  // Tutor endpoints
  async getTutorDashboard(): Promise<TutorDashboardData> {
    const response = await apiClient.get('/api/v1/dashboard/tutor/')
    return response.data
  },

  async getTutorUpcoming(): Promise<{ count: number; results: ActiveLesson[] }> {
    const response = await apiClient.get('/api/v1/dashboard/tutor/upcoming/')
    return response.data
  },

  async getTutorStudents(): Promise<{ count: number; results: unknown[] }> {
    const response = await apiClient.get('/api/v1/dashboard/tutor/students/')
    return response.data
  },

  async getTutorStats(): Promise<TutorStats> {
    const response = await apiClient.get('/api/v1/dashboard/tutor/stats/')
    return response.data
  },
}

export default dashboardApi
