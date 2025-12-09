import apiClient from '../utils/apiClient'
import { RELATION_ENDPOINTS } from '../types/relations'

const relationsApi = {
  /**
   * Отримати всі зв'язки студента (invited, active, declined тощо).
   * @param {object} [params]
   * @returns {Promise<Array|{results: Array}>}
   */
  getStudentRelations(params = {}) {
    return apiClient.get(RELATION_ENDPOINTS.STUDENT_RELATIONS, { params })
  },

  /**
   * Отримати список зв'язків тьютора з можливістю фільтрації.
   * @param {object} [params]
   * @returns {Promise<Array|{results: Array}>}
   */
  getTutorRelations(params = {}) {
    return apiClient.get(RELATION_ENDPOINTS.TUTOR_RELATIONS, { params })
  },

  acceptRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.ACCEPT(relationId))
  },

  declineRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.DECLINE(relationId))
  },

  resendRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.RESEND(relationId))
  },
}

export default relationsApi
