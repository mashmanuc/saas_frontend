// Unit tests for searchStore (v0.20.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock vue-router
vi.mock('vue-router', () => ({
  useRoute: () => ({
    query: {},
  }),
  useRouter: () => ({
    replace: vi.fn(),
  }),
}))

// Mock marketplace API
vi.mock('@/modules/marketplace/api/marketplace', () => ({
  default: {
    search: vi.fn(),
    getSearchSuggestions: vi.fn(),
    getExtendedFilterOptions: vi.fn(),
  },
}))

import { useSearchStore } from '@/modules/marketplace/stores/searchStore'
import marketplaceApi from '@/modules/marketplace/api/marketplace'

describe('searchStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have default filter values', () => {
      const store = useSearchStore()

      expect(store.filters.query).toBe('')
      expect(store.filters.subject).toBeNull()
      expect(store.filters.category).toBeNull()
      expect(store.filters.country).toBeNull()
      expect(store.filters.language).toBeNull()
      expect(store.filters.minPrice).toBeNull()
      expect(store.filters.maxPrice).toBeNull()
      expect(store.filters.minRating).toBeNull()
      expect(store.filters.hasVideo).toBe(false)
      expect(store.filters.isVerified).toBe(false)
    })

    it('should have empty results', () => {
      const store = useSearchStore()

      expect(store.results).toEqual([])
      expect(store.totalCount).toBe(0)
      expect(store.isLoading).toBe(false)
    })

    it('should have empty suggestions', () => {
      const store = useSearchStore()

      expect(store.suggestions).toEqual([])
      expect(store.isLoadingSuggestions).toBe(false)
    })
  })

  describe('computed properties', () => {
    it('hasMore should be true when results < totalCount', () => {
      const store = useSearchStore()
      store.results = [{ id: 1 }, { id: 2 }]
      store.totalCount = 10

      expect(store.hasMore).toBe(true)
    })

    it('hasMore should be false when results >= totalCount', () => {
      const store = useSearchStore()
      store.results = [{ id: 1 }, { id: 2 }]
      store.totalCount = 2

      expect(store.hasMore).toBe(false)
    })

    it('hasFilters should be false with default filters', () => {
      const store = useSearchStore()

      expect(store.hasFilters).toBe(false)
    })

    it('hasFilters should be true when any filter is set', () => {
      const store = useSearchStore()
      store.filters.subject = 'math'

      expect(store.hasFilters).toBe(true)
    })

    it('activeFiltersCount should count active filters', () => {
      const store = useSearchStore()
      store.filters.subject = 'math'
      store.filters.country = 'US'
      store.filters.hasVideo = true

      expect(store.activeFiltersCount).toBe(3)
    })
  })

  describe('search action', () => {
    it('should call API with correct parameters', async () => {
      const store = useSearchStore()
      const mockResponse = {
        count: 5,
        results: [{ id: 1 }, { id: 2 }],
        search_time_ms: 50,
      }

      marketplaceApi.search.mockResolvedValue(mockResponse)

      store.filters.query = 'math'
      store.filters.subject = 'algebra'
      await store.search()

      expect(marketplaceApi.search).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'math',
          subject: 'algebra',
          page: 1,
          page_size: 20,
        })
      )
    })

    it('should update results on successful search', async () => {
      const store = useSearchStore()
      const mockResults = [{ id: 1, name: 'Tutor 1' }]

      marketplaceApi.search.mockResolvedValue({
        count: 1,
        results: mockResults,
        search_time_ms: 30,
      })

      await store.search()

      expect(store.results).toEqual(mockResults)
      expect(store.totalCount).toBe(1)
      expect(store.searchTime).toBe(30)
    })

    it('should handle search errors', async () => {
      const store = useSearchStore()

      marketplaceApi.search.mockRejectedValue(new Error('Network error'))

      await store.search()

      expect(store.error).toBe('Network error')
      expect(store.results).toEqual([])
    })

    it('should reset results when reset=true', async () => {
      const store = useSearchStore()
      store.results = [{ id: 1 }]
      store.currentPage = 3

      marketplaceApi.search.mockResolvedValue({
        count: 0,
        results: [],
      })

      await store.search(true)

      expect(store.currentPage).toBe(1)
    })
  })

  describe('loadMore action', () => {
    it('should increment page and append results', async () => {
      const store = useSearchStore()
      store.results = [{ id: 1 }]
      store.totalCount = 10
      store.currentPage = 1

      marketplaceApi.search.mockResolvedValue({
        count: 10,
        results: [{ id: 2 }],
      })

      await store.loadMore()

      expect(store.currentPage).toBe(2)
      expect(store.results).toHaveLength(2)
    })

    it('should not load more when hasMore is false', async () => {
      const store = useSearchStore()
      store.results = [{ id: 1 }]
      store.totalCount = 1

      await store.loadMore()

      expect(marketplaceApi.search).not.toHaveBeenCalled()
    })

    it('should not load more when already loading', async () => {
      const store = useSearchStore()
      store.results = [{ id: 1 }]
      store.totalCount = 10
      store.isLoading = true

      await store.loadMore()

      expect(marketplaceApi.search).not.toHaveBeenCalled()
    })
  })

  describe('getSuggestions action', () => {
    it('should fetch suggestions for valid query', async () => {
      const store = useSearchStore()
      const mockSuggestions = [
        { type: 'subject', text: 'Mathematics' },
        { type: 'tutor', text: 'John Doe', slug: 'john-doe' },
      ]

      marketplaceApi.getSearchSuggestions.mockResolvedValue(mockSuggestions)

      await store.getSuggestions('math')

      expect(marketplaceApi.getSearchSuggestions).toHaveBeenCalledWith('math')
      expect(store.suggestions).toEqual(mockSuggestions)
    })

    it('should clear suggestions for short query', async () => {
      const store = useSearchStore()
      store.suggestions = [{ type: 'subject', text: 'Math' }]

      await store.getSuggestions('m')

      expect(store.suggestions).toEqual([])
      expect(marketplaceApi.getSearchSuggestions).not.toHaveBeenCalled()
    })
  })

  describe('filter actions', () => {
    it('setFilter should update single filter', () => {
      const store = useSearchStore()

      store.setFilter('subject', 'math')

      expect(store.filters.subject).toBe('math')
    })

    it('setFilters should update multiple filters', () => {
      const store = useSearchStore()

      store.setFilters({
        subject: 'math',
        country: 'US',
        minPrice: 20,
      })

      expect(store.filters.subject).toBe('math')
      expect(store.filters.country).toBe('US')
      expect(store.filters.minPrice).toBe(20)
    })

    it('clearFilters should reset filters but keep query', () => {
      const store = useSearchStore()
      store.filters.query = 'test'
      store.filters.subject = 'math'
      store.filters.hasVideo = true

      store.clearFilters()

      expect(store.filters.query).toBe('test')
      expect(store.filters.subject).toBeNull()
      expect(store.filters.hasVideo).toBe(false)
    })
  })

  describe('search history', () => {
    it('should load history from localStorage', () => {
      localStorage.setItem(
        'marketplace_search_history',
        JSON.stringify(['math', 'english'])
      )

      const store = useSearchStore()

      expect(store.searchHistory).toEqual(['math', 'english'])
    })

    it('should add to history on successful search', async () => {
      const store = useSearchStore()

      marketplaceApi.search.mockResolvedValue({
        count: 1,
        results: [{ id: 1 }],
      })

      store.filters.query = 'physics'
      await store.search()

      expect(store.searchHistory).toContain('physics')
    })

    it('should not duplicate history entries', async () => {
      const store = useSearchStore()
      store.searchHistory = ['math']

      marketplaceApi.search.mockResolvedValue({
        count: 1,
        results: [{ id: 1 }],
      })

      store.filters.query = 'math'
      await store.search()

      expect(store.searchHistory.filter((q) => q === 'math')).toHaveLength(1)
    })

    it('removeFromHistory should remove entry', () => {
      const store = useSearchStore()
      store.searchHistory = ['math', 'english', 'physics']

      store.removeFromHistory('english')

      expect(store.searchHistory).toEqual(['math', 'physics'])
    })

    it('clearSearchHistory should clear all history', () => {
      const store = useSearchStore()
      store.searchHistory = ['math', 'english']

      store.clearSearchHistory()

      expect(store.searchHistory).toEqual([])
    })
  })

  describe('$reset action', () => {
    it('should reset all state to defaults', () => {
      const store = useSearchStore()
      store.filters.query = 'test'
      store.filters.subject = 'math'
      store.results = [{ id: 1 }]
      store.totalCount = 10
      store.error = 'Some error'

      store.$reset()

      expect(store.filters.query).toBe('')
      expect(store.filters.subject).toBeNull()
      expect(store.results).toEqual([])
      expect(store.totalCount).toBe(0)
      expect(store.error).toBeNull()
    })
  })
})
