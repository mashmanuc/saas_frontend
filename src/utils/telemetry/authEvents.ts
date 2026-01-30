export const AUTH_EVENTS = {
  LOGIN_SUCCESS: 'auth_login_success',
  LOGIN_FAILED: 'auth_login_failed',
  LOGIN_RATE_LIMITED: 'auth_rate_limited',
  LOGOUT: 'auth_logout',
  
  MFA_REQUIRED: 'auth_mfa_required',
  MFA_SETUP_STARTED: 'mfa_setup_started',
  MFA_SETUP_COMPLETED: 'mfa_setup_completed',
  MFA_VERIFY_SUCCESS: 'mfa_verify_success',
  MFA_VERIFY_FAILED: 'mfa_verify_failed',
  MFA_CHALLENGE_FAILED: 'mfa_challenge_failed',
  MFA_DISABLED: 'mfa_disabled',
  MFA_BACKUP_CODES_REGENERATED: 'mfa_backup_codes_regenerated',
  
  ACCOUNT_LOCKED: 'auth_account_locked',
  UNLOCK_REQUESTED: 'auth_unlock_requested',
  UNLOCK_CONFIRMED: 'auth_unlock_confirmed',
  UNLOCK_FAILED: 'auth_unlock_failed',
  
  SESSION_EXPIRED: 'auth_session_expired',
  SESSION_REVOKED: 'auth_session_revoked',
  REFRESH_TOKEN_SUCCESS: 'auth_refresh_success',
  REFRESH_TOKEN_FAILED: 'auth_refresh_failed',
  
  PASSWORD_RESET_REQUESTED: 'auth_password_reset_requested',
  PASSWORD_RESET_COMPLETED: 'auth_password_reset_completed',
  
  EMAIL_VERIFICATION_SENT: 'auth_email_verification_sent',
  EMAIL_VERIFIED: 'auth_email_verified',
} as const

export type AuthEventType = typeof AUTH_EVENTS[keyof typeof AUTH_EVENTS]

export interface AuthEventPayload {
  event: AuthEventType
  userId?: string
  email?: string
  errorCode?: string
  errorMessage?: string
  requestId?: string
  timestamp?: number
  metadata?: Record<string, any>
}

export function logAuthEvent(payload: AuthEventPayload): void {
  const eventData = {
    ...payload,
    timestamp: payload.timestamp || Date.now(),
  }

  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', payload.event, {
      event_category: 'auth',
      event_label: payload.errorCode || payload.event,
      user_id: payload.userId,
      ...payload.metadata,
    })
  }

  console.log('[AUTH_TELEMETRY]', eventData)
}
