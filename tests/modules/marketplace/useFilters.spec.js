// Unit tests for useFilters composable (v0.20.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ref } from 'vue'

// Mock vue-router
const mockReplace = vi.fn()
const mockQuery = ref({})

vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: mockQuery.value,
  }),
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

// Mock marketplace API
vi.mock('@/modules/marketplace/api/marketplace', () => ({
  marketplaceApi: {
    getExtendedFilterOptions: vi.fn(),
  },
}))

import { useFilters } from '@/modules/marketplace/composables/useFilters'
import { marketplaceApi } from '@/modules/marketplace/api/marketplace'

describe('useFilters composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockQuery.value = {}
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have default filter values', () => {
      const { filters } = useFilters()

      expect(filters.value.query).toBe('')
      expect(filters.value.subject).toBeNull()
      expect(filters.value.category).toBeNull()
      expect(filters.value.country).toBeNull()
      expect(filters.value.language).toBeNull()
      expect(filters.value.minPrice).toBeNull()
      expect(filters.value.maxPrice).toBeNull()
      expect(filters.value.minRating).toBeNull()
      expect(filters.value.minExperience).toBeNull()
      expect(filters.value.hasVideo).toBe(false)
      expect(filters.value.isVerified).toBe(false)
    })

    it('should have null filterOptions initially', () => {
      const { filterOptions } = useFilters()

      expect(filterOptions.value).toBeNull()
    })
  })

  describe('computed properties', () => {
    it('hasFilters should be false with default filters', () => {
      const { hasFilters } = useFilters()

      expect(hasFilters.value).toBe(false)
    })

    it('hasFilters should be true when any filter is set', () => {
      const { filters, hasFilters } = useFilters()
      filters.value.subject = 'math'

      expect(hasFilters.value).toBe(true)
    })

    it('activeFiltersCount should count active filters', () => {
      const { filters, activeFiltersCount } = useFilters()
      filters.value.subject = 'math'
      filters.value.country = 'US'
      filters.value.hasVideo = true

      expect(activeFiltersCount.value).toBe(3)
    })

    it('activeFiltersCount should count price as one filter', () => {
      const { filters, activeFiltersCount } = useFilters()
      filters.value.minPrice = 10
      filters.value.maxPrice = 50

      expect(activeFiltersCount.value).toBe(1)
    })
  })

  describe('setFilter action', () => {
    it('should update single filter', () => {
      const { filters, setFilter } = useFilters()

      setFilter('subject', 'math')

      expect(filters.value.subject).toBe('math')
    })

    it('should clear subject when category changes', () => {
      const { filters, setFilter } = useFilters()
      filters.value.subject = 'algebra'
      filters.value.category = 'math'

      setFilter('category', 'science')

      expect(filters.value.subject).toBeNull()
    })
  })

  describe('setFilters action', () => {
    it('should update multiple filters', () => {
      const { filters, setFilters } = useFilters()

      setFilters({
        subject: 'math',
        country: 'US',
        minPrice: 20,
      })

      expect(filters.value.subject).toBe('math')
      expect(filters.value.country).toBe('US')
      expect(filters.value.minPrice).toBe(20)
    })

    it('should preserve existing filters', () => {
      const { filters, setFilters } = useFilters()
      filters.value.query = 'test'

      setFilters({ subject: 'math' })

      expect(filters.value.query).toBe('test')
      expect(filters.value.subject).toBe('math')
    })
  })

  describe('clearFilters action', () => {
    it('should reset filters but keep query', () => {
      const { filters, clearFilters } = useFilters()
      filters.value.query = 'test'
      filters.value.subject = 'math'
      filters.value.hasVideo = true

      clearFilters()

      expect(filters.value.query).toBe('test')
      expect(filters.value.subject).toBeNull()
      expect(filters.value.hasVideo).toBe(false)
    })
  })

  describe('resetAll action', () => {
    it('should reset all filters including query', () => {
      const { filters, resetAll } = useFilters()
      filters.value.query = 'test'
      filters.value.subject = 'math'

      resetAll()

      expect(filters.value.query).toBe('')
      expect(filters.value.subject).toBeNull()
    })
  })

  describe('URL sync', () => {
    it('syncToUrl should update router query', () => {
      const { filters, syncToUrl } = useFilters()
      filters.value.query = 'math'
      filters.value.subject = 'algebra'
      filters.value.minPrice = 20

      syncToUrl()

      expect(mockReplace).toHaveBeenCalledWith({
        query: expect.objectContaining({
          q: 'math',
          subject: 'algebra',
          min_price: '20',
        }),
      })
    })

    it('syncToUrl should not include null values', () => {
      const { filters, syncToUrl } = useFilters()
      filters.value.query = 'math'
      filters.value.subject = null

      syncToUrl()

      expect(mockReplace).toHaveBeenCalledWith({
        query: {
          q: 'math',
        },
      })
    })

    it('syncFromUrl should read from route query', () => {
      mockQuery.value = {
        q: 'physics',
        subject: 'mechanics',
        min_price: '30',
        has_video: '1',
      }

      const { filters, syncFromUrl } = useFilters()
      syncFromUrl()

      expect(filters.value.query).toBe('physics')
      expect(filters.value.subject).toBe('mechanics')
      expect(filters.value.minPrice).toBe(30)
      expect(filters.value.hasVideo).toBe(true)
    })
  })

  describe('getApiParams', () => {
    it('should return API-compatible params', () => {
      const { filters, getApiParams } = useFilters()
      filters.value.query = 'math'
      filters.value.subject = 'algebra'
      filters.value.minPrice = 20
      filters.value.hasVideo = true

      const params = getApiParams()

      expect(params).toEqual({
        q: 'math',
        subject: 'algebra',
        category: undefined,
        country: undefined,
        language: undefined,
        min_price: 20,
        max_price: undefined,
        min_rating: undefined,
        min_experience: undefined,
        has_video: true,
        is_verified: undefined,
      })
    })

    it('should convert null to undefined', () => {
      const { filters, getApiParams } = useFilters()
      filters.value.minPrice = null

      const params = getApiParams()

      expect(params.min_price).toBeUndefined()
    })
  })

  describe('loadFilterOptions', () => {
    it('should fetch filter options from API', async () => {
      const mockOptions = {
        categories: [{ slug: 'math', name: 'Mathematics' }],
        subjects: [{ slug: 'algebra', name: 'Algebra', category: 'math' }],
        countries: [{ code: 'US', name: 'United States', count: 100 }],
        languages: [{ code: 'en', name: 'English', count: 200 }],
        priceRange: { min: 10, max: 100, avg: 30 },
        experienceRange: { min: 0, max: 20 },
      }

      marketplaceApi.getExtendedFilterOptions.mockResolvedValue(mockOptions)

      const { filterOptions, loadFilterOptions } = useFilters()
      await loadFilterOptions()

      expect(filterOptions.value).toEqual(mockOptions)
    })

    it('should not refetch if options already loaded', async () => {
      const mockOptions = { categories: [] }
      marketplaceApi.getExtendedFilterOptions.mockResolvedValue(mockOptions)

      const { filterOptions, loadFilterOptions } = useFilters()
      filterOptions.value = mockOptions

      await loadFilterOptions()

      expect(marketplaceApi.getExtendedFilterOptions).not.toHaveBeenCalled()
    })

    it('should set fallback options on error', async () => {
      marketplaceApi.getExtendedFilterOptions.mockRejectedValue(
        new Error('Network error')
      )

      const { filterOptions, loadFilterOptions } = useFilters()
      await loadFilterOptions()

      expect(filterOptions.value).toEqual({
        categories: [],
        subjects: [],
        countries: [],
        languages: [],
        priceRange: { min: 0, max: 200, avg: 25 },
        experienceRange: { min: 0, max: 30 },
      })
    })
  })

  describe('filteredSubjects', () => {
    it('should filter subjects by selected category', async () => {
      const mockOptions = {
        categories: [],
        subjects: [
          { slug: 'algebra', name: 'Algebra', category: 'math', tutor_count: 10 },
          { slug: 'physics', name: 'Physics', category: 'science', tutor_count: 5 },
        ],
        countries: [],
        languages: [],
        priceRange: { min: 0, max: 100, avg: 30 },
        experienceRange: { min: 0, max: 20 },
      }

      marketplaceApi.getExtendedFilterOptions.mockResolvedValue(mockOptions)

      const { filters, filterOptions, filteredSubjects, loadFilterOptions } =
        useFilters()
      await loadFilterOptions()

      filters.value.category = 'math'

      expect(filteredSubjects.value).toHaveLength(1)
      expect(filteredSubjects.value[0].slug).toBe('algebra')
    })

    it('should return all subjects when no category selected', async () => {
      const mockOptions = {
        categories: [],
        subjects: [
          { slug: 'algebra', name: 'Algebra', category: 'math', tutor_count: 10 },
          { slug: 'physics', name: 'Physics', category: 'science', tutor_count: 5 },
        ],
        countries: [],
        languages: [],
        priceRange: { min: 0, max: 100, avg: 30 },
        experienceRange: { min: 0, max: 20 },
      }

      marketplaceApi.getExtendedFilterOptions.mockResolvedValue(mockOptions)

      const { filterOptions, filteredSubjects, loadFilterOptions } = useFilters()
      await loadFilterOptions()

      expect(filteredSubjects.value).toHaveLength(2)
    })
  })
})
