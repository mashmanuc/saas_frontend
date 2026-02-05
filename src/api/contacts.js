import apiClient from '@/utils/apiClient'

const CONTACTS_ENDPOINTS = Object.freeze({
  UNLOCK: '/api/v1/contact-unlock/',
  CHECK: '/api/v1/contact-unlock/check/',
  REVOKE: '/api/v1/contacts/revoke/',
  DETAIL: (studentId) => `/api/v1/contacts/${studentId}/`,
  // Phase 1 v0.87: New contact-access endpoints
  ACCESS_BY_RELATION: (relationId) => `/api/v1/contact-access/by-relation/${relationId}/`,
  ACCESS_CHECK: (studentId) => `/api/v1/contact-access/check/${studentId}/`,
})

export const contactsApi = {
  /**
   * Unlock контактів через inquiry (тільки для тьютора)
   * v0.87.0: Використовує inquiry_id замість student_id
   * @param {string} inquiryId - UUID inquiry
   * @param {boolean} forceUnlock - Force unlock для QA (тільки для staff)
   * @returns {Promise<{unlocked: boolean, was_already_unlocked: boolean, contacts: object}>}
   */
  unlockContacts(inquiryId, forceUnlock = false) {
    return apiClient.post(CONTACTS_ENDPOINTS.UNLOCK, { 
      inquiry_id: inquiryId,
      force_unlock: forceUnlock 
    })
  },

  /**
   * Перевірити можливість unlock контактів (pre-flight check)
   * @param {string} inquiryId - UUID inquiry
   * @returns {Promise<{can_unlock: boolean, reason?: string}>}
   */
  checkCanUnlock(inquiryId) {
    return apiClient.get(CONTACTS_ENDPOINTS.CHECK, { params: { inquiry_id: inquiryId } })
  },

  /**
   * Revoke доступу до контактів
   * @param {number} studentId - ID студента
   * @param {string} reason - Причина відкликання
   * @returns {Promise<{revoked: boolean}>}
   */
  revokeContacts(studentId, reason = '') {
    return apiClient.post(CONTACTS_ENDPOINTS.REVOKE, {
      student_id: studentId,
      reason,
    })
  },

  /**
   * Отримати контакти студента (якщо є доступ)
   * @param {number} studentId - ID студента
   * @returns {Promise<{contacts: {phone: string, telegram: string, email: string}}>}
   */
  getContacts(studentId) {
    return apiClient.get(CONTACTS_ENDPOINTS.DETAIL(studentId))
  },

  /**
   * Phase 1 v0.87: Отримати контакти студента через relation ID
   * @param {number} relationId - ID relation (TutorStudentRelation)
   * @returns {Promise<{relation_id: number, student_id: number, status: string, contacts: object, unlocked_at: string, can_open_chat: boolean}>}
   */
  getContactsByRelation(relationId) {
    return apiClient.get(CONTACTS_ENDPOINTS.ACCESS_BY_RELATION(relationId))
  },

  /**
   * Phase 1 v0.87: Перевірити доступ до контактів студента (lightweight check)
   * @param {number} studentId - ID студента
   * @returns {Promise<{has_access: boolean, relation_id: number|null, unlocked_at: string|null}>}
   */
  checkContactAccess(studentId) {
    return apiClient.get(CONTACTS_ENDPOINTS.ACCESS_CHECK(studentId))
  },
}

export default contactsApi
