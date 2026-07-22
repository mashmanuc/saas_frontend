import api from '../../../utils/apiClient'

const authApi = {
  login(payload) {
    return api.post('/v1/auth/login', payload)
  },

  mfaVerify(payload) {
    return api.post('/v1/auth/mfa/verify', payload)
  },

  mfaSetup(payload) {
    return api.post('/v1/auth/mfa/setup', payload)
  },

  mfaConfirm(payload) {
    return api.post('/v1/auth/mfa/confirm', payload)
  },

  webauthnChallenge(sessionId) {
    return api.post('/v1/auth/webauthn/challenge', { session_id: sessionId })
  },

  webauthnVerify(payload) {
    return api.post('/v1/auth/webauthn/verify', payload)
  },

  webauthnRegister(payload) {
    return api.post('/v1/auth/webauthn/register', payload)
  },

  requestBackupCodesToken() {
    return api.post('/v1/auth/mfa/backup-codes/request/')
  },

  getBackupCodesWithToken(token) {
    return api.get(`/v1/auth/mfa/backup-codes/${token}/`)
  },

  getWebAuthnCredentials() {
    return api.get('/v1/auth/webauthn/credentials/')
  },

  revokeWebAuthnCredential(id) {
    return api.post(`/v1/auth/webauthn/credentials/${id}/revoke/`)
  },

  regenerateBackupCodes(payload) {
    return api.post('/v1/auth/mfa/backup-codes/regenerate/', payload)
  },

  getMfaStatus() {
    return api.get('/v1/auth/mfa/status/')
  },

  disableMfa(payload) {
    return api.post('/v1/auth/mfa/disable/', payload)
  },

  getSessions() {
    return api.get('/v1/me/sessions/')
  },

  revokeSession(id) {
    return api.post(`/v1/me/sessions/${id}/revoke`)
  },

  register(payload) {
    return api.post('/v1/auth/register', payload)
  },

  refresh() {
    return api.post('/v1/auth/refresh/', null, { meta: { skipLoader: true } })
  },

  csrf() {
    return api.post('/v1/auth/csrf', null, { meta: { skipLoader: true } })
  },

  logout(payload) {
    return api.post('/v1/auth/logout', payload)
  },

  getCurrentUser() {
    return api.get('/v1/me').then((res) => res?.user || res)
  },

  // Оновлення профілю поточного юзера (ім'я/прізвище/username/timezone/phone/
  // telegram). 2026-07-21: метод був ВІДСУТНІЙ → meStore.save() падав з
  // "authApi.updateMe is not a function" (юзер не міг змінити ім'я). Бекенд:
  // PATCH /v1/me (V1MeView, слеш опційний), приймає лише allowed_fields.
  updateMe(payload) {
    return api.patch('/v1/me', payload).then((res) => res?.user || res)
  },

  verifyEmail(payload) {
    return api.post('/v1/auth/verify-email', payload)
  },

  resendVerifyEmail(payload) {
    return api.post('/v1/auth/resend-verify-email', payload)
  },

  requestPasswordReset(payload) {
    return api.post('/v1/auth/request-password-reset', payload)
  },

  resetPassword(payload) {
    return api.post('/v1/auth/reset-password', payload)
  },

  changeEmail(payload) {
    return api.post('/v1/me/change-email', payload)
  },

  confirmEmailChange(payload) {
    return api.post('/v1/me/confirm-email-change', payload)
  },

  changePassword(payload) {
    return api.post('/v1/me/change-password', payload)
  },

  uploadAvatar(formData) {
    return api.post('/v1/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteAvatar() {
    return api.delete('/v1/me/avatar')
  },

  // Google OAuth — PR 1 backend, PR 2 FE
  // Plan: saas_docs/plans/GOOGLE_OAUTH_PLAN_2026-05-20.md
  google({ idToken }) {
    return api.post('/v1/auth/google', { id_token: idToken })
  },

  googleRegister({ registrationToken, role }) {
    return api.post('/v1/auth/google/register/', {
      registration_token: registrationToken,
      role,
    })
  },

  googleLink({ idToken }) {
    return api.post('/v1/auth/oauth/google/link/', { id_token: idToken })
  },

  oauthAccounts() {
    return api.get('/v1/auth/oauth/accounts/')
  },

  disconnectOauth(provider) {
    return api.delete(`/v1/auth/oauth/${provider}/`)
  },
}

export default authApi
