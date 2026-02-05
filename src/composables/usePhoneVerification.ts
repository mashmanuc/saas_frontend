/**
 * Phone Verification Composable
 * 
 * Phase 2: Tutor KYC + OTP Verification
 * Docs: docs/FIRST_CONTACT/TZ_PHASE_2_TUTOR_KYC_OTP.md
 * 
 * Handles phone verification flow:
 * 1. Send OTP to user's phone
 * 2. Verify OTP code
 * 3. Track session state and expiry
 */

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import apiClient from '@/utils/apiClient'

interface VerificationSession {
  session_id: string
  expires_at: string
  phone_masked: string
}

interface VerificationSuccess {
  verified: boolean
  phone_verified_at: string
}

interface VerificationError {
  error: string
  message: string
}

export function usePhoneVerification() {
  const { t } = useI18n()
  
  // State
  const loading = ref(false)
  const error = ref<string | null>(null)
  const sessionId = ref<string | null>(null)
  const expiresAt = ref<string | null>(null)
  const phoneMasked = ref<string | null>(null)
  
  // Computed
  const hasActiveSession = computed(() => {
    if (!sessionId.value || !expiresAt.value) return false
    return new Date(expiresAt.value) > new Date()
  })
  
  const timeRemaining = computed(() => {
    if (!expiresAt.value) return null
    
    const now = new Date()
    const expiry = new Date(expiresAt.value)
    const diff = expiry.getTime() - now.getTime()
    
    if (diff <= 0) return t('phone_verification.expired')
    
    const minutes = Math.floor(diff / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  })
  
  /**
   * Send OTP code to user's phone
   */
  async function sendOTP(): Promise<boolean> {
    loading.value = true
    error.value = null
    
    try {
      const response = await apiClient.post('/v1/phone/send-otp')
      const data = response.data as VerificationSession
      
      sessionId.value = data.session_id
      expiresAt.value = data.expires_at
      phoneMasked.value = data.phone_masked
      
      return true
    } catch (err: any) {
      const errorData = err.response?.data as VerificationError
      error.value = handleError(errorData)
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Verify OTP code
   */
  async function verifyOTP(code: string): Promise<boolean> {
    if (!sessionId.value) {
      error.value = t('phone_verification.errors.no_session')
      return false
    }
    
    loading.value = true
    error.value = null
    
    try {
      await apiClient.post<VerificationSuccess>('/v1/phone/verify-otp', {
        session_id: sessionId.value,
        code
      })
      
      // Clear session after successful verification
      sessionId.value = null
      expiresAt.value = null
      phoneMasked.value = null
      
      return true
    } catch (err: any) {
      const errorData = err.response?.data as VerificationError
      error.value = handleError(errorData)
      return false
    } finally {
      loading.value = false
    }
  }
  
  /**
   * Reset verification state
   */
  function reset() {
    loading.value = false
    error.value = null
    sessionId.value = null
    expiresAt.value = null
    phoneMasked.value = null
  }
  
  /**
   * Handle API errors
   */
  function handleError(errorData?: VerificationError): string {
    if (!errorData) {
      return t('phone_verification.errors.unknown')
    }
    
    const errorCode = errorData.error
    const errorKey = `phone_verification.errors.${errorCode}`
    
    // Try to get translated error message
    const translated = t(errorKey)
    
    // If translation exists, use it; otherwise use server message
    if (translated !== errorKey) {
      return translated
    }
    
    return errorData.message || t('phone_verification.errors.unknown')
  }
  
  return {
    // State
    loading,
    error,
    sessionId,
    expiresAt,
    phoneMasked,
    
    // Computed
    hasActiveSession,
    timeRemaining,
    
    // Methods
    sendOTP,
    verifyOTP,
    reset
  }
}
