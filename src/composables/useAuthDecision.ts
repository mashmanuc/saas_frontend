import { computed, type ComputedRef } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'

export interface AuthDecision {
  status: 'SUCCESS' | 'MFA_REQUIRED' | 'ACCOUNT_LOCKED' | 'ERROR'
  code?: string
  warnings?: string[]
  challenge?: string
  lockedUntil?: string
}

export interface AuthDecisionUI {
  needsMfa: boolean
  isLocked: boolean
  hasWarnings: boolean
  warnings: string[]
  lockedUntil: string | null
  canRequestUnlock: boolean
  showVerifyEmailCta: boolean
  showRateLimitMessage: boolean
}

export function useAuthDecision(): {
  decision: ComputedRef<AuthDecisionUI>
  isAccountLocked: ComputedRef<boolean>
  needsMfaVerification: ComputedRef<boolean>
  hasEmailVerificationWarning: ComputedRef<boolean>
  isRateLimited: ComputedRef<boolean>
} {
  const authStore = useAuthStore()

  const decision = computed<AuthDecisionUI>(() => {
    const errorCode = authStore.lastErrorCode
    const error = authStore.error

    const needsMfa = errorCode === 'mfa_required'
    const isLocked = errorCode === 'account_locked'
    const isRateLimited = errorCode === 'rate_limited'
    const hasEmailWarning = errorCode === 'email_not_verified'

    const warnings: string[] = []
    if (hasEmailWarning && error) {
      warnings.push(error)
    }

    return {
      needsMfa,
      isLocked,
      hasWarnings: warnings.length > 0,
      warnings,
      lockedUntil: isLocked ? extractLockedUntil(error) : null,
      canRequestUnlock: isLocked,
      showVerifyEmailCta: hasEmailWarning,
      showRateLimitMessage: isRateLimited,
    }
  })

  const isAccountLocked = computed(() => authStore.lastErrorCode === 'account_locked')
  const needsMfaVerification = computed(() => authStore.lastErrorCode === 'mfa_required')
  const hasEmailVerificationWarning = computed(() => authStore.lastErrorCode === 'email_not_verified')
  const isRateLimited = computed(() => authStore.lastErrorCode === 'rate_limited')

  return {
    decision,
    isAccountLocked,
    needsMfaVerification,
    hasEmailVerificationWarning,
    isRateLimited,
  }
}

function extractLockedUntil(errorMessage: string | null): string | null {
  if (!errorMessage) return null
  const match = errorMessage.match(/до\s+(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/i)
  if (match && match[1]) {
    return match[1]
  }
  return null
}
