import { ref, watch, type Ref } from 'vue'
import { learningContentApi } from '../api/learningContentApi'
import type { ContentItemSummary } from '../types/learningContent'

export interface LessonParticipant {
  id: number
  user: number
  role: 'TUTOR' | 'STUDENT'
  display_name: string
  joined_at: string
}

/**
 * Composable for lesson-specific content operations.
 * 
 * Fetches allowed content and participants for a given lesson.
 * Re-fetches when lessonId changes.
 */
export function useLessonContent(lessonId: Ref<number | null>) {
  const allowedContent = ref<ContentItemSummary[]>([])
  const participants = ref<LessonParticipant[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAllowedContent() {
    if (!lessonId.value) return
    isLoading.value = true
    error.value = null
    try {
      const data = await learningContentApi.getLessonAllowedItems(lessonId.value)
      allowedContent.value = Array.isArray(data) ? data : (data as Record<string, unknown>).results as ContentItemSummary[] ?? []
    } catch (e) {
      console.warn('[useLessonContent] Failed to fetch allowed content:', e)
      error.value = 'Помилка завантаження матеріалів'
      allowedContent.value = []
    } finally {
      isLoading.value = false
    }
  }

  async function fetchParticipants() {
    if (!lessonId.value) return
    try {
      const data = await learningContentApi.getLessonParticipants(lessonId.value)
      const arr = Array.isArray(data) ? data : (data as Record<string, unknown>).results ?? []
      participants.value = arr as LessonParticipant[]
    } catch (e) {
      console.warn('[useLessonContent] Failed to fetch participants:', e)
      participants.value = []
    }
  }

  watch(lessonId, (newId) => {
    if (newId) {
      fetchAllowedContent()
      fetchParticipants()
    } else {
      allowedContent.value = []
      participants.value = []
    }
  }, { immediate: true })

  return {
    allowedContent,
    participants,
    isLoading,
    error,
    fetchAllowedContent,
    fetchParticipants,
  }
}
