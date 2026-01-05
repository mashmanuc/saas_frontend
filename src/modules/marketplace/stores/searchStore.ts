// TASK F1: Search Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import marketplaceApi from '../api/marketplace'
import type {
  SearchFilters,
  ExtendedFilterOptions,
  Suggestion,
  TutorListItem,
} from '../api/marketplace'

const SEARCH_HISTORY_KEY = 'marketplace_search_history'
const MAX_HISTORY_ITEMS = 10

export const useSearchStore = defineStore('search', () => {
  const route = useRoute()
  const router = useRouter()

  // Search state
  const filters = ref<SearchFilters>({
    query: '',
    subject: null,
    category: null,
    country: null,
    language: null,
    minPrice: null,
    maxPrice: null,
    minRating: null,
    minExperience: null,
    hasVideo: false,
    isVerified: false,
  })

  // Results state
  const results = ref<TutorListItem[]>([])
  const totalCount = ref(0)
  const currentPage = ref(1)
  const pageSize = ref(20)
  const isLoading = ref(false)
  const searchTime = ref(0)
  const error = ref<string | null>(null)

  // Suggestions state
  const suggestions = ref<Suggestion[]>([])
  const isLoadingSuggestions = ref(false)

  // Filter options
  const filterOptions = ref<ExtendedFilterOptions | null>(null)
  const isLoadingOptions = ref(false)
  const filtersCacheExpired = ref(false)
  const filtersCacheLastUpdated = ref<number | null>(null)

  // Search history
  const searchHistory = ref<string[]>([])

  // Sort
  const sortBy = ref('-relevance')

  // Computed
  const hasMore = computed(() => results.value.length < totalCount.value)

  const hasFilters = computed(() => {
    return !!(
      filters.value.subject ||
      filters.value.category ||
      filters.value.country ||
      filters.value.language ||
      filters.value.minPrice !== null ||
      filters.value.maxPrice !== null ||
      filters.value.minRating !== null ||
      filters.value.minExperience !== null ||
      filters.value.hasVideo ||
      filters.value.isVerified
    )
  })

  const activeFiltersCount = computed(() => {
    let count = 0
    if (filters.value.subject) count++
    if (filters.value.category) count++
    if (filters.value.country) count++
    if (filters.value.language) count++
    if (filters.value.minPrice !== null || filters.value.maxPrice !== null) count++
    if (filters.value.minRating !== null) count++
    if (filters.value.minExperience !== null) count++
    if (filters.value.hasVideo) count++
    if (filters.value.isVerified) count++
    return count
  })

  // Actions
  async function search(reset: boolean = true): Promise<void> {
    if (reset) {
      currentPage.value = 1
      results.value = []
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await marketplaceApi.search({
        q: filters.value.query || undefined,
        subject: filters.value.subject,
        category: filters.value.category,
        country: filters.value.country,
        language: filters.value.language,
        min_price: filters.value.minPrice,
        max_price: filters.value.maxPrice,
        min_rating: filters.value.minRating,
        min_experience: filters.value.minExperience,
        has_video: filters.value.hasVideo || undefined,
        is_verified: filters.value.isVerified || undefined,
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
      if (filters.value.query && !searchHistory.value.includes(filters.value.query)) {
        searchHistory.value.unshift(filters.value.query)
        searchHistory.value = searchHistory.value.slice(0, MAX_HISTORY_ITEMS)
        saveSearchHistory()
      }
    } catch (e: any) {
      error.value = e.message || 'Search failed'
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await search(false)
  }

  async function getSuggestions(q: string): Promise<void> {
    if (!q || q.length < 2) {
      suggestions.value = []
      return
    }

    isLoadingSuggestions.value = true

    try {
      suggestions.value = await marketplaceApi.getSearchSuggestions(q)
    } catch {
      suggestions.value = []
    } finally {
      isLoadingSuggestions.value = false
    }
  }

  async function loadFilterOptions(forceRefresh: boolean = false): Promise<void> {
    if (filterOptions.value && !forceRefresh) return

    isLoadingOptions.value = true

    try {
      filterOptions.value = await marketplaceApi.getExtendedFilterOptions()
      filtersCacheLastUpdated.value = Date.now()
      filtersCacheExpired.value = false
    } catch {
      // Fallback to empty options
      filterOptions.value = {
        categories: [],
        subjects: [],
        countries: [],
        languages: [],
        priceRange: { min: 0, max: 200, avg: 25 },
        experienceRange: { min: 0, max: 30 },
      }
    } finally {
      isLoadingOptions.value = false
    }
  }

  function checkFiltersCacheExpiry(): void {
    const EXT_FILTERS_CACHE_KEY = 'marketplace_ext_filters_cache_v38'
    try {
      const raw = localStorage.getItem(EXT_FILTERS_CACHE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      const expiresAt = typeof parsed?.expiresAt === 'number' ? parsed.expiresAt : null
      if (expiresAt && expiresAt < Date.now()) {
        filtersCacheExpired.value = true
        filtersCacheLastUpdated.value = expiresAt
      }
    } catch {
      // ignore
    }
  }

  async function refreshFilters(): Promise<void> {
    await loadFilterOptions(true)
  }

  function setFilter<K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ): void {
    filters.value[key] = value
    syncFiltersToUrl()
    search(true)
  }

  function setFilters(newFilters: Partial<SearchFilters>): void {
    filters.value = { ...filters.value, ...newFilters }
    syncFiltersToUrl()
    search(true)
  }

  function clearFilters(): void {
    filters.value = {
      query: filters.value.query, // Keep query
      subject: null,
      category: null,
      country: null,
      language: null,
      minPrice: null,
      maxPrice: null,
      minRating: null,
      minExperience: null,
      hasVideo: false,
      isVerified: false,
    }
    syncFiltersToUrl()
    search(true)
  }

  function setSort(sort: string): void {
    sortBy.value = sort
    search(true)
  }

  // URL sync
  function syncFiltersToUrl(): void {
    const query: Record<string, string> = {}

    if (filters.value.query) query.q = filters.value.query
    if (filters.value.subject) query.subject = filters.value.subject
    if (filters.value.category) query.category = filters.value.category
    if (filters.value.country) query.country = filters.value.country
    if (filters.value.language) query.language = filters.value.language
    if (filters.value.minPrice !== null) query.min_price = String(filters.value.minPrice)
    if (filters.value.maxPrice !== null) query.max_price = String(filters.value.maxPrice)
    if (filters.value.minRating !== null) query.min_rating = String(filters.value.minRating)
    if (filters.value.minExperience !== null) query.min_experience = String(filters.value.minExperience)
    if (filters.value.hasVideo) query.has_video = '1'
    if (filters.value.isVerified) query.is_verified = '1'
    if (sortBy.value !== '-relevance') query.sort = sortBy.value

    router.replace({ query })
  }

  function syncFiltersFromUrl(): void {
    const q = route.query

    filters.value = {
      query: (q.q as string) || '',
      subject: (q.subject as string) || null,
      category: (q.category as string) || null,
      country: (q.country as string) || null,
      language: (q.language as string) || null,
      minPrice: q.min_price ? Number(q.min_price) : null,
      maxPrice: q.max_price ? Number(q.max_price) : null,
      minRating: q.min_rating ? Number(q.min_rating) : null,
      minExperience: q.min_experience ? Number(q.min_experience) : null,
      hasVideo: q.has_video === '1',
      isVerified: q.is_verified === '1',
    }

    sortBy.value = (q.sort as string) || '-relevance'
  }

  // Search history
  function loadSearchHistory(): void {
    try {
      const saved = localStorage.getItem(SEARCH_HISTORY_KEY)
      if (saved) {
        searchHistory.value = JSON.parse(saved)
      }
    } catch {
      searchHistory.value = []
    }
  }

  function saveSearchHistory(): void {
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(searchHistory.value))
  }

  function clearSearchHistory(): void {
    searchHistory.value = []
    saveSearchHistory()
  }

  function removeFromHistory(query: string): void {
    searchHistory.value = searchHistory.value.filter((q) => q !== query)
    saveSearchHistory()
  }

  // Initialize
  loadSearchHistory()
  checkFiltersCacheExpiry()

  // Reset store
  function $reset(): void {
    filters.value = {
      query: '',
      subject: null,
      category: null,
      country: null,
      language: null,
      minPrice: null,
      maxPrice: null,
      minRating: null,
      minExperience: null,
      hasVideo: false,
      isVerified: false,
    }
    results.value = []
    totalCount.value = 0
    currentPage.value = 1
    isLoading.value = false
    searchTime.value = 0
    error.value = null
    suggestions.value = []
    sortBy.value = '-relevance'
  }

  return {
    // State
    filters,
    results,
    totalCount,
    currentPage,
    pageSize,
    isLoading,
    searchTime,
    error,
    suggestions,
    isLoadingSuggestions,
    filterOptions,
    isLoadingOptions,
    filtersCacheExpired,
    filtersCacheLastUpdated,
    searchHistory,
    sortBy,

    // Computed
    hasMore,
    hasFilters,
    activeFiltersCount,

    // Actions
    search,
    loadMore,
    getSuggestions,
    loadFilterOptions,
    refreshFilters,
    setFilter,
    setFilters,
    clearFilters,
    setSort,
    syncFiltersFromUrl,
    syncFiltersToUrl,
    clearSearchHistory,
    removeFromHistory,
    $reset,
  }
})
