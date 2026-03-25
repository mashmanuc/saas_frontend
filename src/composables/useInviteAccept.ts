/**
 * Composable for accepting tutor invites
 */
import { ref } from 'vue'
import { invitesApi } from '@/api/invites'
import type { InviteDTO } from '@/types/invites'
import { useToast } from '@/composables/useToast'
import { useI18n } from 'vue-i18n'
import { useRelationsStore } from '@/stores/relationsStore'

export function useInviteAccept(token: string) {
  const { t } = useI18n()
  const toast = useToast()
  const relationsStore = useRelationsStore()
  
  const isAccepting = ref(false)
  const result = ref<InviteDTO | null>(null)
  const error = ref<string | null>(null)
  
  /**
   * Accept invite
   * 
   * Structured error code mapping (NOT string matching)
   * Optimistic UX - no immediate redirect
   */
  async function accept(): Promise<void> {
    if (isAccepting.value) {
      return // Prevent double-click
    }
    
    isAccepting.value = true
    error.value = null
    
    try {
      const response = await invitesApi.acceptInvite(token)
      result.value = response
      
      // Refresh relations after successful accept
      await relationsStore.fetchRelations()
      
      // Success toast
      toast.success(
        t('invites.acceptSuccess', {
          tutorName: response.tutor_info?.full_name || '',
        })
      )
      
      // NO immediate redirect - show success state with viral hook
      // Navigation handled by user action (view profile / book lesson)
    } catch (err: any) {
      // Structured error code mapping (NOT string matching)
      const errorCode = err.response?.data?.code || 'UNKNOWN'
      error.value = errorCode
      
      // Map error codes to i18n keys
      const errorKey = `invites.errors.${errorCode.toLowerCase()}`
      toast.error(t(errorKey, t('invites.errors.unknown')))
    } finally {
      isAccepting.value = false
    }
  }
  
  /**
   * Reset state
   */
  function reset() {
    result.value = null
    error.value = null
  }
  
  return {
    isAccepting,
    result,
    error,
    accept,
    reset
  }
}
