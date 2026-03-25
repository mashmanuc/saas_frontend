/**
 * Composable for creating tutor invites
 */
import { ref } from 'vue'
import { invitesApi } from '@/api/invites'
import type { InviteDTO } from '@/types/invites'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'

export function useInviteCreate() {
  const { t } = useI18n()
  const toast = useToast()
  
  const isCreating = ref(false)
  const invite = ref<InviteDTO | null>(null)
  const error = ref<string | null>(null)
  
  /**
   * Create new invite
   */
  async function create(): Promise<InviteDTO | null> {
    isCreating.value = true
    error.value = null
    
    try {
      const result = await invitesApi.createInvite()
      invite.value = result
      
      toast.success(t('invites.createSuccess'))
      
      return result
    } catch (err: any) {
      const errorCode = err.response?.data?.code || 'UNKNOWN'
      error.value = errorCode
      
      // Map error codes to i18n keys
      const errorKey = `invites.errors.${errorCode.toLowerCase()}`
      toast.error(t(errorKey, t('invites.errors.unknown')))
      
      return null
    } finally {
      isCreating.value = false
    }
  }
  
  /**
   * Reset state
   */
  function reset() {
    invite.value = null
    error.value = null
  }
  
  return {
    isCreating,
    invite,
    error,
    create,
    reset
  }
}
