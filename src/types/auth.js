/**
 * @typedef {Object} AuthPayload
 * @property {string} email
 * @property {string} password
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} [timezone]
 *
 * @typedef {Object} AuthResponse
 * @property {string} access
 * @property {string} refresh
 * @property {import('./user').UserDTO} user
 */

export const AUTH_ENDPOINTS = Object.freeze({
  LOGIN: '/auth/login/',
  REGISTER: '/auth/register/',
  REFRESH: '/auth/refresh/',
  LOGOUT: '/auth/logout/',
  CURRENT_USER: '/users/me/',
  INVITE_VALIDATE: '/auth/invite/validate/',
  INVITE_ACCEPT: '/auth/invite/accept/',
})
