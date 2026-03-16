// Phase 14 A2.2: useCloneTemplate — composable for cloning a template into a new WBSession
// POST /api/v1/knowledge/templates/{id}/clone/ → { session_id, session_name }
// Ref: AGENT_A_FE_CORE.md A2.2

import { ref } from 'vue'
import { templateApi, type CloneResult } from '../api/templateApi'
import { useToast } from '@/modules/winterboard/composables/useToast'

export function useCloneTemplate() {
  const isCloning = ref(false)
  const error = ref<string | null>(null)
  const { showToast } = useToast()

  /**
   * Clone a template into a new WBSession (board).
   * Returns CloneResult on success, null on error.
   */
  async function clone(templateId: string): Promise<CloneResult | null> {
    isCloning.value = true
    error.value = null
    try {
      const result = await templateApi.cloneTemplate(templateId)
      showToast('Дошку створено з шаблону!', 'success')
      return result
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      error.value = message || 'Не вдалося клонувати шаблон'
      showToast(error.value, 'error')
      console.error('[useCloneTemplate] Clone failed:', err)
      return null
    } finally {
      isCloning.value = false
    }
  }

  return { clone, isCloning, error }
}
