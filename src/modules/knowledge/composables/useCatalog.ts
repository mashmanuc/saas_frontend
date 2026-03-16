// Phase 15 A1.3: useCatalog — composable for catalog search with filters + cursor pagination
// Ref: AGENT_A_FE_CORE.md A1.3

import { ref, reactive, watch } from 'vue'
import {
  catalogApi,
  type SubjectCategory,
  type CatalogSearchResult,
  type CatalogFilters,
} from '../api/catalogApi'

// ─── Constants ──────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300

// ─── Composable ─────────────────────────────────────────────────────────────

export function useCatalog() {
  const categories = ref<SubjectCategory[]>([])
  const lessons = ref<CatalogSearchResult[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const nextCursor = ref<number | null>(null)
  const totalCount = ref(0)

  const filters = reactive<CatalogFilters>({
    query: undefined,
    category: undefined,
    min_rating: undefined,
    sort: 'popular',
  })

  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null

  // ── Categories ──────────────────────────────────────────────────────────

  async function loadCategories(): Promise<void> {
    try {
      categories.value = await catalogApi.getCategories()
    } catch (err) {
      console.error('[useCatalog] Failed to load categories:', err)
    }
  }

  // ── Search ──────────────────────────────────────────────────────────────

  async function searchLessons(reset = false): Promise<void> {
    if (abortController) {
      abortController.abort()
    }
    abortController = new AbortController()

    if (reset) {
      lessons.value = []
      nextCursor.value = null
    }

    isLoading.value = true
    error.value = null

    try {
      const res = await catalogApi.search({
        ...filters,
        cursor: reset ? undefined : (nextCursor.value ?? undefined),
      })

      if (reset) {
        lessons.value = res.lessons
      } else {
        lessons.value = [...lessons.value, ...res.lessons]
      }

      nextCursor.value = res.next_cursor
      totalCount.value = res.total
    } catch (err: unknown) {
      if ((err as Error)?.name === 'CanceledError' || (err as Error)?.name === 'AbortError') return

      const message = (err as { status?: number })?.status
        ? `Помилка сервера: ${(err as { status: number }).status}`
        : 'Не вдалося завантажити уроки'
      error.value = message
      console.error('[useCatalog] Search failed:', err)
    } finally {
      isLoading.value = false
    }
  }

  // ── Load more ───────────────────────────────────────────────────────────

  async function loadMore(): Promise<void> {
    if (nextCursor.value === null || isLoading.value) return
    await searchLessons(false)
  }

  const hasMore = () => nextCursor.value !== null

  // ── Debounced watcher on filter changes ─────────────────────────────────

  watch(
    () => ({
      query: filters.query,
      category: filters.category,
      min_rating: filters.min_rating,
      sort: filters.sort,
    }),
    () => {
      if (debounceTimer) clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        searchLessons(true)
      }, DEBOUNCE_MS)
    },
    { deep: true },
  )

  return {
    categories,
    lessons,
    isLoading,
    error,
    filters,
    nextCursor,
    totalCount,
    loadCategories,
    searchLessons,
    loadMore,
    hasMore,
  }
}
