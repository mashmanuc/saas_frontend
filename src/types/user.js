/**
 * @typedef {'superadmin' | 'admin' | 'tutor' | 'student'} UserRole
 *
 * @typedef {Object} UserDTO
 * @property {number} id
 * @property {string} email
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [display_name] - Privacy-safe name (format: "FirstName L.")
 * @property {string} [full_name] - Full name when contact access granted
 * @property {UserRole} role
 * @property {string} [timezone]
 * @property {boolean} [is_self_learning]
 */

export const USER_ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  STAFF: 'staff',
  TUTOR: 'tutor',
  STUDENT: 'student',
})

export const USER_SAMPLE = Object.freeze({
  id: 1,
  email: 'user@example.com',
  first_name: 'Ім\u2019я',
  last_name: 'Прізвище',
  role: USER_ROLES.STUDENT,
  timezone: 'Europe/Kyiv',
  is_self_learning: true,
})
