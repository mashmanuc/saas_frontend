import { ref } from 'vue'
import { soloApi } from '../api/soloApi'
import type { ShareToken } from '../types/solo'

export function useSharing() {
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function createShareToken(
    sessionId: string,
    options: {
      expires_in_days?: number | null
      max_views?: number | null
      allow_download?: boolean
    }
  ): Promise<ShareToken | null> {
    isLoading.value = true
    error.value = null

    try {
      const response = await soloApi.createShare(sessionId, {
        expires_in_days: options.expires_in_days ?? undefined,
        max_views: options.max_views ?? undefined,
        allow_download: options.allow_download ?? false,
      })
      return response.data
    } catch (err) {
      error.value = 'Failed to create share link'
      console.error('[useSharing] createShareToken failed:', err)
      return null
    } finally {
      isLoading.value = false
    }
  }

  async function getShareToken(sessionId: string): Promise<ShareToken | null> {
    try {
      const response = await soloApi.getShare(sessionId)
      return response.data
    } catch {
      // No share exists
      return null
    }
  }

  async function revokeShareToken(sessionId: string): Promise<boolean> {
    isLoading.value = true
    error.value = null

    try {
      await soloApi.revokeShare(sessionId)
      return true
    } catch (err) {
      error.value = 'Failed to revoke share link'
      console.error('[useSharing] revokeShareToken failed:', err)
      return false
    } finally {
      isLoading.value = false
    }
  }

  return {
    isLoading,
    error,
    createShareToken,
    getShareToken,
    revokeShareToken,
  }
}
