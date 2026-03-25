/**
 * Composable for fetching invite details
 */
import { ref } from 'vue'
import { invitesApi } from '@/api/invites'
import type { InviteDTO } from '@/types/invites'

export function useInviteDetail(token: string) {
  const isLoading = ref(false)
  const invite = ref<InviteDTO | null>(null)
  const error = ref<string | null>(null)
  
  /**
   * Fetch invite details
   */
  async function fetch(): Promise<void> {
    isLoading.value = true
    error.value = null
    
    try {
      const result = await invitesApi.getInviteDetail(token)
      invite.value = result
    } catch (err: any) {
      const errorCode = err.response?.data?.code || 'UNKNOWN'
      error.value = errorCode
    } finally {
      isLoading.value = false
    }
  }
  
  /**
   * Refresh invite details
   */
  async function refresh(): Promise<void> {
    await fetch()
  }
  
  return {
    isLoading,
    invite,
    error,
    fetch,
    refresh
  }
}
