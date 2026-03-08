import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { learningContentApi } from '../api/learningContentApi'
import type { ContentItemSummary } from '../types/learningContent'

export type LessonRuntimeStatus = 'idle' | 'loading' | 'active' | 'completed' | 'error'

export const useLessonRuntimeStore = defineStore('lessonRuntime', () => {
  // ─── State ─────────────────────────────────────────────────
  const lessonId = ref<number | null>(null)
  const status = ref<LessonRuntimeStatus>('idle')
  const lessonStatus = ref<string | null>(null) // 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | ...
  const allowedContent = ref<ContentItemSummary[]>([])
  const participants = ref<unknown[]>([])
  const error = ref<string | null>(null)
  const isLoading = ref(false)

  // ─── Getters ───────────────────────────────────────────────
  const isActive = computed(() => lessonStatus.value === 'IN_PROGRESS')
  const isCompleted = computed(() => lessonStatus.value === 'COMPLETED')
  const hasAllowedContent = computed(() => allowedContent.value.length > 0)
  const allowedContentIds = computed(() => new Set(allowedContent.value.map(c => c.id)))

  // ─── Actions ───────────────────────────────────────────────

  /** Initialize store with lesson context (called when opening classroom) */
  async function init(id: number): Promise<void> {
    lessonId.value = id
    status.value = 'loading'
    isLoading.value = true
    error.value = null
    try {
      // Fetch allowed content + participants in parallel
      const [contentRes, participantsRes] = await Promise.all([
        learningContentApi.getLessonAllowedItems(id).catch(() => []),
        learningContentApi.getLessonParticipants(id).catch(() => []),
      ])
      allowedContent.value = contentRes as ContentItemSummary[]
      participants.value = participantsRes
      status.value = 'active'
    } catch (err) {
      console.error('[LessonRuntime] init failed:', err)
      error.value = 'Failed to load lesson data'
      status.value = 'error'
    } finally {
      isLoading.value = false
    }
  }

  /** Start lesson (tutor only) — triggers snapshot on backend */
  async function startLesson(): Promise<boolean> {
    if (!lessonId.value) return false
    isLoading.value = true
    error.value = null
    try {
      await learningContentApi.startLesson(lessonId.value)
      lessonStatus.value = 'IN_PROGRESS'
      // Re-fetch allowed content (now snapshot exists)
      const content = await learningContentApi.getLessonAllowedItems(lessonId.value)
      allowedContent.value = content as ContentItemSummary[]
      status.value = 'active'
      return true
    } catch (err) {
      console.error('[LessonRuntime] startLesson failed:', err)
      error.value = 'Failed to start lesson'
      return false
    } finally {
      isLoading.value = false
    }
  }

  /** Complete lesson (tutor only) */
  async function completeLesson(): Promise<boolean> {
    if (!lessonId.value) return false
    isLoading.value = true
    error.value = null
    try {
      await learningContentApi.completeLesson(lessonId.value)
      lessonStatus.value = 'COMPLETED'
      status.value = 'completed'
      return true
    } catch (err) {
      console.error('[LessonRuntime] completeLesson failed:', err)
      error.value = 'Failed to complete lesson'
      return false
    } finally {
      isLoading.value = false
    }
  }

  /** Live-append content to lesson (used by useBoardClipboard after paste/upload) */
  async function addContent(contentItemId: number): Promise<boolean> {
    if (!lessonId.value || !isActive.value) return false
    try {
      const res = await learningContentApi.addAllowedContent(lessonId.value, contentItemId)
      if (res.created) {
        // Re-fetch to get fresh list (avoid manually constructing ContentItemSummary)
        const content = await learningContentApi.getLessonAllowedItems(lessonId.value)
        allowedContent.value = content as ContentItemSummary[]
      }
      return true
    } catch (err) {
      console.warn('[LessonRuntime] addContent failed:', err)
      return false
    }
  }

  /** Reset store (called when leaving classroom) */
  function $reset(): void {
    lessonId.value = null
    status.value = 'idle'
    lessonStatus.value = null
    allowedContent.value = []
    participants.value = []
    error.value = null
    isLoading.value = false
  }

  return {
    // State
    lessonId,
    status,
    lessonStatus,
    allowedContent,
    participants,
    error,
    isLoading,
    // Getters
    isActive,
    isCompleted,
    hasAllowedContent,
    allowedContentIds,
    // Actions
    init,
    startLesson,
    completeLesson,
    addContent,
    $reset,
  }
})
