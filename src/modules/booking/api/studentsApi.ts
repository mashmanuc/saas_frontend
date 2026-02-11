import apiClient from '@/utils/apiClient'

export interface StudentListItem {
  student_id: number
  email: string
  first_name: string
  last_name: string
  display_name?: string  // P0.1: Privacy-safe name (format: "FirstName L.")
  full_name?: string     // P0.1: Full name when contact access granted
  membership_id?: number
  avatar?: string
  timezone?: string
}

export interface StudentsListResponse {
  count: number
  results: StudentListItem[]
}

const MY_STUDENTS_V032_PATH = '/api/classroom/my-students/'
const MY_STUDENTS_LEGACY_PATH = '/v1/tutor/students/'

function getData<T>(request: Promise<any>): Promise<T> {
  return request.then((res: any) => (res?.data ?? res) as T)
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

    return getData<StudentsListResponse>(
      apiClient
        .get(MY_STUDENTS_V032_PATH, { params })
        .catch((err: any) => {
          const status = err?.response?.status
          if (status === 404) {
            return apiClient.get(MY_STUDENTS_LEGACY_PATH, { params })
          }
          throw err
        })
    )
  },

  /**
   * Get a single student by ID
   */
  getStudent(id: number): Promise<StudentListItem> {
    return getData<StudentListItem>(
      apiClient
        .get(`${MY_STUDENTS_V032_PATH}${id}/`)
        .catch((err: any) => {
          const status = err?.response?.status
          if (status === 404) {
            return apiClient.get(`${MY_STUDENTS_LEGACY_PATH}${id}/`)
          }
          throw err
        })
    )
  },
}
