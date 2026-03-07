import { ref, onMounted } from 'vue'
import lessonsApi from '@/api/lessons'
import type { LessonHistoryItem } from '@/modules/lessons/types/lessonTypes'

/**
 * Composable for Lesson History (Ризик #3: Tutor value after lesson).
 * 
 * Loads the tutor's lesson list from GET /lessons/my/.
 */
export function useLessonHistory() {
  const lessons = ref<LessonHistoryItem[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  async function load() {
    isLoading.value = true
    error.value = null
    try {
      const res = await lessonsApi.listMyLessons()
      const data = res?.data ?? res
      lessons.value = Array.isArray(data)
        ? data
        : data?.results ?? []
    } catch (e) {
      console.warn('[useLessonHistory] Failed to load lessons:', e)
      error.value = 'Помилка завантаження уроків'
      lessons.value = []
    } finally {
      isLoading.value = false
    }
  }

  const cloningId = ref<number | null>(null)
  const cloneError = ref<string | null>(null)

  async function cloneLesson(lessonId: number) {
    cloningId.value = lessonId
    cloneError.value = null
    try {
      const res = await lessonsApi.cloneLesson(lessonId)
      await load()
      return res?.data ?? res
    } catch (e: unknown) {
      console.warn('[useLessonHistory] Clone failed:', e)
      cloneError.value = 'clone_failed'
      return null
    } finally {
      cloningId.value = null
    }
  }

  onMounted(load)

  return { lessons, isLoading, error, reload: load, cloningId, cloneError, cloneLesson }
}
