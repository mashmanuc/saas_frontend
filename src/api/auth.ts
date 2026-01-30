import apiClient from '@/utils/apiClient'

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  access?: string
  user?: any
  mfa_required?: boolean
  webauthn_required?: boolean
  session_id?: string
}

export interface RefreshResponse {
  access: string
}

export interface UnlockRequestPayload {
  email: string
}

export interface UnlockConfirmPayload {
  token: string
}

export interface PasswordResetRequestPayload {
  email: string
}

export interface PasswordResetConfirmPayload {
  token: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  role: string
  first_name?: string
  last_name?: string
}

const authApi = {
  login(payload: LoginPayload): Promise<LoginResponse> {
    return apiClient.post('/v1/auth/login', payload)
  },

  refresh(): Promise<RefreshResponse> {
    return apiClient.post('/v1/auth/refresh')
  },

  csrf(): Promise<{ csrf: string }> {
    return apiClient.post('/v1/auth/csrf')
  },

  logout(payload?: any): Promise<void> {
    return apiClient.post('/v1/auth/logout', payload)
  },

  getCurrentUser(): Promise<any> {
    return apiClient.get('/v1/me').then((res: any) => res?.user || res)
  },

  register(payload: RegisterPayload): Promise<any> {
    return apiClient.post('/v1/auth/register', payload)
  },

  requestPasswordReset(payload: PasswordResetRequestPayload): Promise<any> {
    return apiClient.post('/v1/auth/request-password-reset', payload)
  },

  resetPassword(payload: PasswordResetConfirmPayload): Promise<any> {
    return apiClient.post('/v1/auth/reset-password', payload)
  },

  verifyEmail(payload: { token: string }): Promise<any> {
    return apiClient.post('/v1/auth/verify-email', payload)
  },

  resendVerifyEmail(payload: { email: string }): Promise<any> {
    return apiClient.post('/v1/auth/resend-verify-email', payload)
  },

  requestAccountUnlock(payload: UnlockRequestPayload): Promise<{ status: string }> {
    return apiClient.post('/v1/auth/request-account-unlock', payload)
  },

  confirmAccountUnlock(payload: UnlockConfirmPayload): Promise<{ status: string }> {
    return apiClient.post('/v1/auth/confirm-account-unlock', payload)
  },

  changeEmail(payload: { new_email: string; password: string }): Promise<any> {
    return apiClient.post('/v1/me/change-email', payload)
  },

  confirmEmailChange(payload: { token: string }): Promise<any> {
    return apiClient.post('/v1/me/confirm-email-change', payload)
  },

  changePassword(payload: { old_password: string; new_password: string }): Promise<any> {
    return apiClient.post('/v1/me/change-password', payload)
  },

  uploadAvatar(formData: FormData): Promise<any> {
    return apiClient.post('/v1/me/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },

  deleteAvatar(): Promise<any> {
    return apiClient.delete('/v1/me/avatar')
  },

  validateInvite(token: string): Promise<any> {
    return apiClient.get('/auth/invite/validate/', {
      params: { token },
    })
  },

  acceptInvite(payload: any): Promise<any> {
    return apiClient.post('/auth/invite/accept/', payload)
  },
}

export default authApi
