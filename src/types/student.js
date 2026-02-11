/**
 * @typedef {'pending' | 'active' | 'inactive'} TutorStudentStatus
 *
 * @typedef {Object} StudentProfileDTO
 * @property {number} id
 * @property {string} email
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [display_name] - Privacy-safe name (format: "FirstName L.")
 * @property {string} [full_name] - Full name when contact access granted
 * @property {import('./user').UserRole} role
 * @property {string} [timezone]
 * @property {boolean} [is_self_learning]
 *
 * @typedef {Object} TutorStudentRelationDTO
 * @property {number} id
 * @property {StudentProfileDTO} student
 * @property {TutorStudentStatus} status
 * @property {string} [notes]
 * @property {string} relationship_start
 * @property {string | null} relationship_end
 * @property {string} created_at
 * @property {string} updated_at
 */

export const TUTOR_STUDENT_ENDPOINTS = Object.freeze({
  LIST: '/tutor/students/',
  INVITE: '/tutor/students/invite/',
})
