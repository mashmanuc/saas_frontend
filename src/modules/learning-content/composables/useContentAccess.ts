import { ref } from 'vue'
import apiClient from '@/utils/apiClient'

export interface ContentAccessResult {
  has_access: boolean
  access_type: string
  reason: string | null
}

export function useContentAccess() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function checkAccess(contentId: number): Promise<ContentAccessResult | null> {
    loading.value = true
    error.value = null
    try {
      const res = await apiClient.get(`/v1/content/${contentId}/access-check/`)
      return res as unknown as ContentAccessResult
    } catch (e: any) {
      error.value = e.message || 'Access check failed'
      return null
    } finally {
      loading.value = false
    }
  }

  return { checkAccess, loading, error }
}
