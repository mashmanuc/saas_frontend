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
   * Отримати список зв'язків тьютора з cursor-пагінацією та статус-фільтром.
   * @param {{ status?: string, cursor?: string }} [params]
   * @returns {Promise<{results: Array, cursor?: string|null, has_more?: boolean, summary?: object}>}
   */
  getTutorRelations(params = {}) {
    return apiClient.get(RELATION_ENDPOINTS.TUTOR_RELATIONS, { params })
  },

  bulkAcceptTutorRelations(ids = []) {
    return apiClient.post(RELATION_ENDPOINTS.TUTOR_RELATIONS_BULK_ACCEPT, { ids })
  },

  bulkArchiveTutorRelations(ids = []) {
    return apiClient.post(RELATION_ENDPOINTS.TUTOR_RELATIONS_BULK_ARCHIVE, { ids })
  },

  /**
   * Student accepts tutor invitation
   * Flow: Tutor invites Student → Student accepts
   */
  studentAcceptRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.STUDENT_ACCEPT(relationId))
  },

  /**
   * Student declines tutor invitation
   * Flow: Tutor invites Student → Student declines
   */
  studentDeclineRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.STUDENT_DECLINE(relationId))
  },

  /**
   * Tutor accepts student request
   * Flow: Student requests Tutor → Tutor accepts
   */
  tutorAcceptRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.TUTOR_ACCEPT(relationId))
  },

  /**
   * Tutor resends invitation
   */
  tutorResendRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.TUTOR_RESEND(relationId))
  },

  // Legacy methods (deprecated, use role-specific methods)
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
