// TASK F19: useSearch composable
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import marketplaceApi from '../api/marketplace'
import type { SearchFilters, TutorListItem, Suggestion } from '../api/marketplace'

const SEARCH_HISTORY_KEY = 'marketplace_search_history'
const MAX_HISTORY_ITEMS = 10

export function useSearch() {
  const route = useRoute()
  const router = useRouter()

  // State
  const query = ref('')
  const results = ref<TutorListItem[]>([])
  const totalCount = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const searchTime = ref(0)

  // Suggestions
  const suggestions = ref<Suggestion[]>([])
  const isLoadingSuggestions = ref(false)

  // History
  const searchHistory = ref<string[]>([])

  // Sorting
  const sortBy = ref('-relevance')

  // Computed
  const hasMore = computed(() => results.value.length < totalCount.value)
  const isEmpty = computed(() => !isLoading.value && results.value.length === 0)

  // Load history from localStorage
  const loadHistory = () => {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (saved) {
        searchHistory.value = JSON.parse(saved)
      }
    } catch {
      searchHistory.value = []
    }
  }

  // Save history to localStorage
  const saveHistory = () => {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
  }

  // Add to history
  const addToHistory = (q: string) => {
    if (!q || searchHistory.value.includes(q)) return
    searchHistory.value.unshift(q)
    searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY_ITEMS)
    saveHistory()
  }

  // Remove from history
  const removeFromHistory = (q: string) => {
    searchHistory.value = searchHistory.value.filter((item) => item !== q)
    saveHistory()
  }

  // Clear history
  const clearHistory = () => {
    searchHistory.value = []
    saveHistory()
  }

  // Search
  const search = async (filters?: Partial<SearchFilters>, reset = true) => {
    if (reset) {
      currentPage.value = 1
      results.value = []
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await marketplaceApi.search({
        q: query.value || undefined,
        ...filters,
        page: currentPage.value,
        page_size: pageSize.value,
        ordering: sortBy.value,
      })

      if (reset) {
        results.value = response.results
      } else {
        results.value = [...results.value, ...response.results]
      }

      totalCount.value = response.count
      searchTime.value = response.search_time_ms || 0

      // Add to history
      if (query.value) {
        addToHistory(query.value)
      }
    } catch (e: any) {
      error.value = e.message || 'Search failed'
    } finally {
      isLoading.value = false
    }
  }

  // Load more
  const loadMore = async (filters?: Partial<SearchFilters>) => {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await search(filters, false)
  }

  // Get suggestions
  let suggestionsTimeout: ReturnType<typeof setTimeout> | null = null

  const getSuggestions = async (q: string) => {
    if (suggestionsTimeout) {
      clearTimeout(suggestionsTimeout)
    }

    if (!q || q.length < 2) {
      suggestions.value = []
      return
    }

    suggestionsTimeout = setTimeout(async () => {
      isLoadingSuggestions.value = true
      try {
        suggestions.value = await marketplaceApi.getSearchSuggestions(q)
      } catch {
        suggestions.value = []
      } finally {
        isLoadingSuggestions.value = false
      }
    }, 300)
  }

  // Sync with URL
  const syncFromUrl = () => {
    query.value = (route.query.q as string) || ''
    sortBy.value = (route.query.sort as string) || '-relevance'
  }

  const syncToUrl = () => {
    const urlQuery: Record<string, string> = {}
    if (query.value) urlQuery.q = query.value
    if (sortBy.value !== '-relevance') urlQuery.sort = sortBy.value
    router.replace({ query: urlQuery })
  }

  // Set sort
  const setSort = (sort: string) => {
    sortBy.value = sort
    syncToUrl()
    search()
  }

  // Initialize
  onMounted(() => {
    loadHistory()
    syncFromUrl()
  })

  // Cleanup
  onUnmounted(() => {
    if (suggestionsTimeout) {
      clearTimeout(suggestionsTimeout)
    }
  })

  return {
    // State
    query,
    results,
    totalCount,
    currentPage,
    isLoading,
    error,
    searchTime,
    suggestions,
    isLoadingSuggestions,
    searchHistory,
    sortBy,

    // Computed
    hasMore,
    isEmpty,

    // Actions
    search,
    loadMore,
    getSuggestions,
    setSort,
    addToHistory,
    removeFromHistory,
    clearHistory,
    syncFromUrl,
    syncToUrl,
  }
}
