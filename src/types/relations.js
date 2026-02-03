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
  TUTOR_RELATIONS: buildV1Url('/tutor/relations/'),
  TUTOR_RELATIONS_BULK_ACCEPT: buildV1Url('/tutor/relations/batch/accept/'),
  TUTOR_RELATIONS_BULK_ARCHIVE: buildV1Url('/tutor/relations/batch/archive/'),
  
  // Student endpoints (Flow: Tutor invites Student → Student accepts/declines)
  STUDENT_ACCEPT: (id) => buildV1Url(`/student/relations/${id}/accept/`),
  STUDENT_DECLINE: (id) => buildV1Url(`/student/relations/${id}/decline/`),
  
  // Tutor endpoints (Flow: Student requests Tutor → Tutor accepts)
  TUTOR_ACCEPT: (id) => buildV1Url(`/tutor/relations/${id}/accept/`),
  TUTOR_RESEND: (id) => buildV1Url(`/tutor/relations/${id}/resend/`),
  
  // Legacy aliases (deprecated, use role-specific endpoints)
  ACCEPT: (id) => buildV1Url(`/student/relations/${id}/accept/`),
  DECLINE: (id) => buildV1Url(`/student/relations/${id}/decline/`),
  RESEND: (id) => buildV1Url(`/tutor/relations/${id}/resend/`),
})
