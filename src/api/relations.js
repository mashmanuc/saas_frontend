import apiClient from '../utils/apiClient'
import { RELATION_ENDPOINTS } from '../types/relations'

const relationsApi = {
  /**
   * Отримати всі зв'язки студента (invited, active, declined тощо).
   * @param {object} [params]
   * @returns {Promise<Array|{results: Array}>}
   */
  getStudentRelations(params = {}) {
    return apiClient.get(RELATION_ENDPOINTS.STUDENT_RELATIONS, { params, meta: { skipLoader: true } })
  },

  /**
   * Отримати список зв'язків тьютора з cursor-пагінацією та статус-фільтром.
   * @param {{ status?: string, cursor?: string }} [params]
   * @returns {Promise<{results: Array, cursor?: string|null, has_more?: boolean, summary?: object}>}
   */
  getTutorRelations(params = {}) {
    return apiClient.get(RELATION_ENDPOINTS.TUTOR_RELATIONS, { params, meta: { skipLoader: true } })
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
   * Get accept availability for tutor (SSOT F.2)
   * Returns grace_token required for onboarding accepts
   */
  async getTutorAcceptAvailability() {
    // PR-FE-3 (2026-04-26): Removed double `/api/` prefix (baseURL already /api).
    return apiClient.get('/tutor/accept-availability/')
  },

  /**
   * Tutor accepts student request
   * Flow: Student requests Tutor → Tutor accepts
   * SSOT F.2: Requires grace_token for onboarding accepts
   */
  async tutorAcceptRelation(relationId, graceToken = null) {
    const payload = graceToken ? { grace_token: graceToken } : {}
    return apiClient.post(RELATION_ENDPOINTS.TUTOR_ACCEPT(relationId), payload)
  },

  /**
   * Restore archived relation back to active
   * v0.88.3: Archive management
   */
  tutorRestoreRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.TUTOR_RESTORE(relationId))
  },

  /**
   * Hide relation from tutor view (soft delete)
   * v0.88.3: Archive management - hides without data loss
   */
  tutorHideRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.TUTOR_HIDE(relationId))
  },

  // Legacy methods (deprecated, use role-specific methods)
  acceptRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.ACCEPT(relationId))
  },

  declineRelation(relationId) {
    return apiClient.post(RELATION_ENDPOINTS.DECLINE(relationId))
  },
}

export default relationsApi
