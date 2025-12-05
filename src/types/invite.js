/**
 * @typedef {Object} InviteValidateResponse
 * @property {boolean} is_valid
 * @property {string} email
 * @property {string} [first_name]
 * @property {string} [last_name]
 * @property {string} role
 *
 * @typedef {Object} InviteAcceptPayload
 * @property {string} token
 * @property {string} password
 * @property {string} [first_name]
 * @property {string} [last_name]
 */

export const INVITE_ENDPOINTS = Object.freeze({
  VALIDATE: '/auth/invite/validate/',
  ACCEPT: '/auth/invite/accept/',
})
