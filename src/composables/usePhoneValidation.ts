/**
 * Composable for phone number validation (E.164 format).
 * 
 * Phase 1: Student Contact Data
 * Docs: docs/FIRST_CONTACT/TZ_STUDENT_CONTACT_DATA_FIX_2026-02-04.md
 */
import { computed, Ref } from 'vue'
import { useI18n } from 'vue-i18n'

export function usePhoneValidation(phone: Ref<string>) {
  const { t } = useI18n()
  
  const isValidFormat = computed(() => {
    if (!phone.value) return false
    
    // E.164 format: +[country code][number]
    // + followed by 1-15 digits, starting with 1-9
    const pattern = /^\+[1-9]\d{1,14}$/
    return pattern.test(phone.value)
  })
  
  const errorMessage = computed(() => {
    if (!phone.value) {
      return t('users.profile.phoneHint')
    }
    if (!isValidFormat.value) {
      return t('users.profile.phoneHint')
    }
    return null
  })
  
  return {
    isValidFormat,
    errorMessage
  }
}
