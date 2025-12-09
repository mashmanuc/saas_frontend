/**
 * @typedef {'invited' | 'active' | 'declined' | 'archived' | 'paused'} RelationStatus
 *
 * @typedef {Object} PublicUserDTO
 * @property {number} id
 * @property {string} email
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [avatar]
 * @property {string} [timezone]
 *
 * @typedef {Object} RelationDTO
 * @property {number} relation_id
 * @property {RelationStatus} status
 * @property {PublicUserDTO} tutor
 * @property {PublicUserDTO} [student]
 */

export const RELATION_ENDPOINTS = Object.freeze({
  STUDENT_RELATIONS: '/student/relations/',
  TUTOR_RELATIONS: '/tutor/relations/',
  ACCEPT: (id) => `/relations/${id}/accept/`,
  DECLINE: (id) => `/relations/${id}/decline/`,
  RESEND: (id) => `/relations/${id}/resend/`,
})
