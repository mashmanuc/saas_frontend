/**
 * Composable for phone number validation (E.164 format).
 * Uses libphonenumber-js (Google libphonenumber port) — validates against
 * real ITU-T country numbering plans, not a hand-rolled regex.
 *
 * Phase 1: Student Contact Data
 * Docs: docs/FIRST_CONTACT/TZ_STUDENT_CONTACT_DATA_FIX_2026-02-04.md
 */
import { computed, Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isValidPhoneNumber } from 'libphonenumber-js'

export function usePhoneValidation(phone: Ref<string>) {
  const { t } = useI18n()

  const isValidFormat = computed(() => {
    if (!phone.value) return false
    return isValidPhoneNumber(phone.value)
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
    errorMessage,
  }
}
