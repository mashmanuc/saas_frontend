import api from '../../../utils/apiClient'
import { TUTOR_STUDENT_ENDPOINTS } from '../../../types/student'

const studentsApi = {
  /**
   * @param {Object} [params]
   * @returns {Promise<Array|{results: Array, next_lesson_at?: string}>}
   */
  getList(params = {}) {
    return api.get(TUTOR_STUDENT_ENDPOINTS.LIST, { params })
  },
}

export default studentsApi
