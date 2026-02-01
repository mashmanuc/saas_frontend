import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useMarketplaceStore } from '../marketplaceStore'
import marketplaceApi from '../../api/marketplace'

vi.mock('../../api/marketplace')

describe('marketplaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('loadTutors', () => {
    it('should load tutors successfully', async () => {
      const mockResponse = {
        results: [
          { id: 1, slug: 'tutor-1', headline: 'Math tutor' },
          { id: 2, slug: 'tutor-2', headline: 'Physics tutor' }
        ],
        count: 2,
        totalPages: 1
      }

      vi.mocked(marketplaceApi.getTutors).mockResolvedValue(mockResponse as any)

      const store = useMarketplaceStore()
      await store.loadTutors(true)

      expect(store.tutors).toHaveLength(2)
      expect(store.totalCount).toBe(2)
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('should handle load error', async () => {
      vi.mocked(marketplaceApi.getTutors).mockRejectedValue(new Error('Network error'))

      const store = useMarketplaceStore()
      await store.loadTutors(true)

      expect(store.tutors).toHaveLength(0)
      expect(store.error).toBeTruthy()
      expect(store.isLoading).toBe(false)
    })

    it('should append tutors when not resetting', async () => {
      const mockResponse1 = {
        results: [{ id: 1, slug: 'tutor-1', headline: 'Math tutor' }],
        count: 2,
        totalPages: 2
      }
      const mockResponse2 = {
        results: [{ id: 2, slug: 'tutor-2', headline: 'Physics tutor' }],
        count: 2,
        totalPages: 2
      }

      vi.mocked(marketplaceApi.getTutors)
        .mockResolvedValueOnce(mockResponse1 as any)
        .mockResolvedValueOnce(mockResponse2 as any)

      const store = useMarketplaceStore()
      await store.loadTutors(true)
      expect(store.tutors).toHaveLength(1)

      await store.loadMore()
      expect(store.tutors).toHaveLength(2)
    })
  })

  describe('setFilters', () => {
    it('should update filters and trigger reload', async () => {
      const mockResponse = {
        results: [],
        count: 0,
        totalPages: 0
      }

      vi.mocked(marketplaceApi.getTutors).mockResolvedValue(mockResponse as any)

      const store = useMarketplaceStore()
      store.setFilters({ subject: ['math'] })

      // Wait for debounced reload
      await new Promise(resolve => setTimeout(resolve, 350))

      expect(store.filters.subject).toEqual(['math'])
      expect(marketplaceApi.getTutors).toHaveBeenCalled()
    })

    it('should filter out short query strings', () => {
      const store = useMarketplaceStore()
      store.setFilters({ q: 'a' })

      expect(store.filters.q).toBeUndefined()
    })
  })

  describe('profile completeness', () => {
    it('should calculate missing sections correctly', () => {
      const store = useMarketplaceStore()
      store.myProfile = {
        headline: '',
        bio: '',
        subjects: [],
        languages: [],
        pricing: { hourly_rate: 0, currency: 'UAH' }
      } as any

      expect(store.missingProfileSections.length).toBeGreaterThan(0)
      expect(store.isProfileComplete).toBe(false)
    })

    it('should recognize complete profile', () => {
      const store = useMarketplaceStore()
      store.myProfile = {
        headline: 'Math tutor',
        bio: 'Experienced teacher',
        subjects: [{ code: 'math', title: 'Mathematics' }],
        languages: [{ code: 'en', name: 'English', level: 'native' }],
        pricing: { hourly_rate: 500, currency: 'UAH' },
        media: { photo_url: 'https://example.com/photo.jpg' }
      } as any

      expect(store.isProfileComplete).toBe(true)
      expect(store.canPublish).toBe(true)
    })
  })

  describe('publishProfile', () => {
    it('should publish profile successfully', async () => {
      vi.mocked(marketplaceApi.publishProfile).mockResolvedValue({} as any)
      vi.mocked(marketplaceApi.getTutorMeProfile).mockResolvedValue({
        is_published: true
      } as any)

      const store = useMarketplaceStore()
      await store.publishProfile()

      expect(marketplaceApi.publishProfile).toHaveBeenCalled()
      expect(store.myProfile?.is_published).toBe(true)
    })

    it('should handle publish error', async () => {
      vi.mocked(marketplaceApi.publishProfile).mockRejectedValue(new Error('Forbidden'))

      const store = useMarketplaceStore()
      await expect(store.publishProfile()).rejects.toThrow()
      expect(store.error).toBeTruthy()
    })
  })

  describe('loadFilterOptions', () => {
    it('should load filter options', async () => {
      const mockOptions = {
        subjects: [{ value: 'math', label: 'Mathematics', count: 10 }],
        countries: [{ value: 'UA', label: 'Ukraine', count: 50 }],
        languages: [{ value: 'en', label: 'English', count: 100 }],
        priceRange: { min: 100, max: 1000 }
      }

      vi.mocked(marketplaceApi.getFilterOptions).mockResolvedValue(mockOptions)

      const store = useMarketplaceStore()
      await store.loadFilterOptions()

      expect(store.filterOptions).toEqual(mockOptions)
      expect(store.isFilterOptionsLoading).toBe(false)
    })

    it('should be idempotent', async () => {
      const mockOptions = {
        subjects: [],
        countries: [],
        languages: [],
        priceRange: { min: 0, max: 0 },
        catalogVersion: 'v1',
        subjectTagMap: {}
      }

      vi.mocked(marketplaceApi.getFilterOptions).mockResolvedValue(mockOptions)

      const store = useMarketplaceStore()
      
      // First call should load
      await store.loadFilterOptions()
      expect(marketplaceApi.getFilterOptions).toHaveBeenCalledTimes(1)
      
      // Second call should skip (idempotent) because catalogVersion and subjectTagMap are set
      await store.loadFilterOptions()
      expect(marketplaceApi.getFilterOptions).toHaveBeenCalledTimes(1)
    })
  })
})
