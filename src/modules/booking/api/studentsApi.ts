import apiClient from '@/utils/apiClient'

export interface StudentListItem {
  id: number
  email: string
  first_name: string
  last_name: string
  avatar?: string
  timezone?: string
}

export interface StudentsListResponse {
  count: number
  results: StudentListItem[]
}

/**
 * API for tutor's student list
 */
export const studentsApi = {
  /**
   * Search students connected to the current tutor
   * @param query - Search term (email or name)
   * @param limit - Max results
   */
  listStudents(query?: string, limit = 10): Promise<StudentsListResponse> {
    const params: Record<string, unknown> = { limit }
    if (query) {
      params.q = query
    }
    return apiClient.get('/v1/tutor/students/', { params })
  },

  /**
   * Get a single student by ID
   */
  getStudent(id: number): Promise<StudentListItem> {
    return apiClient.get(`/v1/tutor/students/${id}/`)
  },
}
