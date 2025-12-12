// TASK F20: useFilters composable
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { marketplaceApi } from '../api/marketplace'
import type { SearchFilters, ExtendedFilterOptions } from '../api/marketplace'

export function useFilters() {
  const route = useRoute()
  const router = useRouter()

  // Default filter state
  const defaultFilters: SearchFilters = {
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

  // State
  const filters = ref<SearchFilters>({ ...defaultFilters })
  const filterOptions = ref<ExtendedFilterOptions | null>(null)
  const isLoadingOptions = ref(false)

  // Computed
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

  // Filtered subjects based on selected category
  const filteredSubjects = computed(() => {
    if (!filterOptions.value) return []
    if (!filters.value.category) return filterOptions.value.subjects
    return filterOptions.value.subjects.filter(
      (s) => s.category === filters.value.category
    )
  })

  // Load filter options
  const loadFilterOptions = async () => {
    if (filterOptions.value) return

    isLoadingOptions.value = true
    try {
      filterOptions.value = await marketplaceApi.getExtendedFilterOptions()
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

  // Set single filter
  const setFilter = <K extends keyof SearchFilters>(
    key: K,
    value: SearchFilters[K]
  ) => {
    filters.value[key] = value

    // Clear subject when category changes
    if (key === 'category' && value !== filters.value.category) {
      filters.value.subject = null
    }
  }

  // Set multiple filters
  const setFilters = (newFilters: Partial<SearchFilters>) => {
    filters.value = { ...filters.value, ...newFilters }
  }

  // Clear all filters (keep query)
  const clearFilters = () => {
    const query = filters.value.query
    filters.value = { ...defaultFilters, query }
  }

  // Reset all (including query)
  const resetAll = () => {
    filters.value = { ...defaultFilters }
  }

  // Sync filters to URL
  const syncToUrl = () => {
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

    router.replace({ query })
  }

  // Sync filters from URL
  const syncFromUrl = () => {
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
  }

  // Get API params from filters
  const getApiParams = () => {
    return {
      q: filters.value.query || undefined,
      subject: filters.value.subject || undefined,
      category: filters.value.category || undefined,
      country: filters.value.country || undefined,
      language: filters.value.language || undefined,
      min_price: filters.value.minPrice ?? undefined,
      max_price: filters.value.maxPrice ?? undefined,
      min_rating: filters.value.minRating ?? undefined,
      min_experience: filters.value.minExperience ?? undefined,
      has_video: filters.value.hasVideo || undefined,
      is_verified: filters.value.isVerified || undefined,
    }
  }

  // Initialize
  onMounted(() => {
    loadFilterOptions()
  })

  return {
    // State
    filters,
    filterOptions,
    isLoadingOptions,

    // Computed
    hasFilters,
    activeFiltersCount,
    filteredSubjects,

    // Actions
    loadFilterOptions,
    setFilter,
    setFilters,
    clearFilters,
    resetAll,
    syncToUrl,
    syncFromUrl,
    getApiParams,
  }
}
