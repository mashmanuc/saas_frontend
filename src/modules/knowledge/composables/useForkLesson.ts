// Phase 14 A2.1: useForkLesson — composable for forking a public lesson
// POST /api/v1/knowledge/my-lessons/{lessonId}/fork/ → new KnowledgeLesson
// Ref: AGENT_A_FE_CORE.md A2.1

import { ref } from 'vue'
import { templateApi, type ForkResult } from '../api/templateApi'
import { useToast } from '@/modules/winterboard/composables/useToast'

export function useForkLesson() {
  const isForking = ref(false)
  const error = ref<string | null>(null)
  const { showToast } = useToast()

  /**
   * Fork a public lesson into current tutor's account.
   * Returns ForkResult on success, null on error.
   */
  async function fork(lessonId: string): Promise<ForkResult | null> {
    isForking.value = true
    error.value = null
    try {
      const result = await templateApi.forkLesson(lessonId)
      showToast('Урок форкнуто!', 'success')
      return result
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      error.value = message || 'Не вдалося форкнути урок'
      showToast(error.value, 'error')
      console.error('[useForkLesson] Fork failed:', err)
      return null
    } finally {
      isForking.value = false
    }
  }

  return { fork, isForking, error }
}
