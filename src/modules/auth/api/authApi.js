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

  webauthnChallenge(payload) {
    return api.post('/v1/auth/webauthn/challenge', payload)
  },

  webauthnVerify(payload) {
    return api.post('/v1/auth/webauthn/verify', payload)
  },

  webauthnRegister(payload) {
    return api.post('/v1/auth/webauthn/register', payload)
  },

  getWebAuthnCredentials() {
    return api.get('/v1/auth/webauthn/credentials/')
  },

  revokeWebAuthnCredential(id) {
    return api.post(`/v1/auth/webauthn/credentials/${id}/revoke/`)
  },

  getBackupCodes() {
    return api.get('/v1/auth/mfa/backup-codes/')
  },

  regenerateBackupCodes() {
    return api.post('/v1/auth/mfa/backup-codes/regenerate')
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
    return api.post('/v1/auth/refresh')
  },

  csrf() {
    return api.post('/v1/auth/csrf')
  },

  logout(payload) {
    return api.post('/v1/auth/logout', payload)
  },

  getCurrentUser() {
    return api.get('/v1/me').then((res) => res?.user || res)
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

  validateInvite(token) {
    return api.get('/auth/invite/validate/', {
      params: { token },
    })
  },

  acceptInvite(payload) {
    return api.post('/auth/invite/accept/', payload)
  },
}

export default authApi
