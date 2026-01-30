import apiClient from '@/utils/apiClient'

export interface MFASetupPayload {
  method: 'totp'
}

export interface MFASetupResponse {
  qr_svg: string
  secret_hint: string
  backup_codes: string[]
}

export interface MFAConfirmPayload {
  otp: string
}

export interface MFAVerifyPayload {
  otp: string
  session_id: string
}

export interface MFAVerifyResponse {
  access: string
}

export interface MFADisablePayload {
  password: string
}

export interface BackupCodesResponse {
  codes: string[]
}

const mfaApi = {
  setup(payload: MFASetupPayload): Promise<MFASetupResponse> {
    return apiClient.post('/v1/auth/mfa/setup', payload)
  },

  confirm(payload: MFAConfirmPayload): Promise<{ status: string }> {
    return apiClient.post('/v1/auth/mfa/confirm', payload)
  },

  verify(payload: MFAVerifyPayload): Promise<MFAVerifyResponse> {
    return apiClient.post('/v1/auth/mfa/verify', payload)
  },

  disable(payload: MFADisablePayload): Promise<{ status: string }> {
    return apiClient.post('/v1/auth/mfa/disable', payload)
  },

  regenerateBackupCodes(): Promise<BackupCodesResponse> {
    return apiClient.post('/v1/auth/mfa/backup-codes/regenerate')
  },

  getBackupCodes(): Promise<BackupCodesResponse> {
    return apiClient.get('/v1/auth/mfa/backup-codes/')
  },

  requestBackupCodesToken(): Promise<{ token: string }> {
    return apiClient.post('/v1/auth/mfa/backup-codes/request/')
  },

  getBackupCodesWithToken(token: string): Promise<BackupCodesResponse> {
    return apiClient.get(`/v1/auth/mfa/backup-codes/${token}/`)
  },
}

export default mfaApi
