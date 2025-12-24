import { buildV1Url } from '../config/apiPrefixes'

/**
 * @typedef {'all' | 'invited' | 'active' | 'archived'} TutorRelationFilter
 *
 * @typedef {'invited' | 'active' | 'archived'} RelationStatus
 *
 * @typedef {Object} PublicUserDTO
 * @property {number} id
 * @property {string} email
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [avatar]
 * @property {string} [timezone]
 *
 * @typedef {Object} TutorRelationDTO
 * @property {number} id
 * @property {RelationStatus} status
 * @property {PublicUserDTO} student
 * @property {string|null} invited_at
 * @property {string|null} accepted_at
 * @property {number} lesson_count
 * @property {string|null} recent_activity
 * @property {string} [notes]
 *
 * @typedef {Object} TutorRelationsResponse
 * @property {TutorRelationDTO[]} results
 * @property {string|null} cursor
 * @property {boolean} has_more
 * @property {{ total: number, invited: number, active: number, archived: number }} [summary]
 */

export const RELATION_ENDPOINTS = Object.freeze({
  STUDENT_RELATIONS: buildV1Url('/student/relations/'),
  // Legacy endpoint (not in v1 namespace yet)
  TUTOR_RELATIONS: '/api/tutor/relations/',
  TUTOR_RELATIONS_BULK_ACCEPT: buildV1Url('/tutor/relations/batch/accept/'),
  TUTOR_RELATIONS_BULK_ARCHIVE: buildV1Url('/tutor/relations/batch/archive/'),
  // Student accepts/declines tutor invitation
  ACCEPT: (id) => buildV1Url(`/student/relations/${id}/accept/`),
  DECLINE: (id) => buildV1Url(`/student/relations/${id}/decline/`),
  // Tutor resends invitation
  RESEND: (id) => buildV1Url(`/tutor/relations/${id}/resend/`),
})
