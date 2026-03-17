// Phase 13 A3.2: usePublishLesson — composable for publishing a lesson to Knowledge domain
// Authenticated endpoint — uses apiClient with auth token
// Ref: AGENT_A_FE_CORE.md A3.2

import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import apiClient from '@/utils/apiClient'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PublishLessonData {
  title: string
  description?: string
  subject_tag?: string
  slug?: string
  visibility?: 'demo' | 'public'
}

export interface PublishedLesson {
  id: string
  title: string
  slug: string
  tutor_slug: string
  status: string
  visibility: string
  created_at: string
}

// ─── Composable ─────────────────────────────────────────────────────────────

export function usePublishLesson() {
  const isPublishing = ref(false)
  const publishedLesson = ref<PublishedLesson | null>(null)
  const error = ref<string | null>(null)

  /**
   * Publish a WBSession as a public KnowledgeLesson.
   * POST /api/v1/knowledge/my-lessons/publish/
   */
  async function publish(sessionId: string, data: PublishLessonData): Promise<void> {
    isPublishing.value = true
    error.value = null
    try {
      const result = await apiClient.post<PublishedLesson>('/v1/knowledge/my-lessons/publish/', {
        session_id: sessionId,
        ...data,
      })
      publishedLesson.value = result
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const { t } = useI18n()
      error.value = message || t('knowledge.publish.error', 'Не вдалося опублікувати урок')
      console.error('[usePublishLesson] Publish failed:', err)
    } finally {
      isPublishing.value = false
    }
  }

  /**
   * Full public URL for the published lesson.
   */
  const publicUrl = computed<string | null>(() => {
    if (!publishedLesson.value) return null
    return `/lesson/${publishedLesson.value.tutor_slug}/${publishedLesson.value.slug}`
  })

  /**
   * Full absolute URL for sharing (with origin).
   */
  const publicAbsoluteUrl = computed<string | null>(() => {
    if (!publicUrl.value) return null
    return `${window.location.origin}${publicUrl.value}`
  })

  /**
   * FIX-4: Unpublish — set lesson status to 'draft'.
   * POST /api/v1/knowledge/my-lessons/{id}/unpublish/
   */
  async function unpublish(lessonId: string): Promise<void> {
    isPublishing.value = true
    error.value = null
    try {
      await apiClient.post(`/v1/knowledge/my-lessons/${lessonId}/unpublish/`)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const { t } = useI18n()
      error.value = message || t('knowledge.publish.unpublishError', 'Не вдалося зняти з публікації')
      throw err
    } finally {
      isPublishing.value = false
    }
  }

  /**
   * FIX-4: Republish — set lesson status back to 'public'.
   * POST /api/v1/knowledge/my-lessons/{id}/republish/
   */
  async function republish(lessonId: string): Promise<void> {
    isPublishing.value = true
    error.value = null
    try {
      await apiClient.post(`/v1/knowledge/my-lessons/${lessonId}/republish/`)
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      const { t } = useI18n()
      error.value = message || t('knowledge.publish.republishError', 'Не вдалося опублікувати урок')
      throw err
    } finally {
      isPublishing.value = false
    }
  }

  function reset(): void {
    publishedLesson.value = null
    error.value = null
    isPublishing.value = false
  }

  return {
    publish,
    unpublish,
    republish,
    isPublishing,
    publishedLesson,
    publicUrl,
    publicAbsoluteUrl,
    error,
    reset,
  }
}
