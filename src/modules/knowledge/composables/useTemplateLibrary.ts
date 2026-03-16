// Phase 14 A1.4: useTemplateLibrary — composable for template library with filters + cursor pagination
// Ref: AGENT_A_FE_CORE.md A1.4

import { ref, reactive, watch } from 'vue'
import { templateApi, type LessonTemplate, type TemplateFilters } from '../api/templateApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300

// ─── Composable ─────────────────────────────────────────────────────────────

export function useTemplateLibrary() {
  const templates = ref<LessonTemplate[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<number | null>(null)
  const totalCount = ref(0)

  const filters = reactive<TemplateFilters>({
    subject: undefined,
    difficulty_min: undefined,
    difficulty_max: undefined,
    sort: 'popular',
  })

  let abortController: AbortController | null = null
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * Load templates from API. If reset=true, clears existing list and loads from cursor=0.
   */
  async function loadTemplates(reset = false): Promise<void> {
    // Cancel any in-flight request
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    if (reset) {
      templates.value = []
      nextCursor.value = null
    }

    isLoading.value = true
    error.value = null

    try {
      const res = await templateApi.getTemplates({
        ...filters,
        cursor: reset ? undefined : (nextCursor.value ?? undefined),
      })

      if (reset) {
        templates.value = res.templates
      } else {
        templates.value = [...templates.value, ...res.templates]
      }

      nextCursor.value = res.next_cursor
      totalCount.value = res.total_count
    } catch (err: unknown) {
      // Ignore abort errors
      if ((err as Error)?.name === 'CanceledError' || (err as Error)?.name === 'AbortError') return

      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      error.value = message || 'Не вдалося завантажити шаблони'
      console.error('[useTemplateLibrary] Load failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Load next page (cursor pagination).
   */
  async function loadMore(): Promise<void> {
    if (nextCursor.value === null || isLoading.value) return
    await loadTemplates(false)
  }

  const hasMore = () => nextCursor.value !== null

  // ── Debounced watcher: reload on filter change ────────────────────────

  watch(
    () => ({
      subject: filters.subject,
      difficulty_min: filters.difficulty_min,
      difficulty_max: filters.difficulty_max,
      sort: filters.sort,
    }),
    () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        loadTemplates(true)
      }, DEBOUNCE_MS)
    },
    { deep: true },
  )

  return {
    templates,
    isLoading,
    error,
    filters,
    nextCursor,
    totalCount,
    loadTemplates,
    loadMore,
    hasMore,
  }
}
