import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock API
vi.mock('../../../src/modules/marketplace/api/marketplace', () => ({
  marketplaceApi: {
    getTutors: vi.fn(),
    getTutorProfile: vi.fn(),
    getMyProfile: vi.fn(),
    createProfile: vi.fn(),
    updateProfile: vi.fn(),
    submitForReview: vi.fn(),
    publishProfile: vi.fn(),
    unpublishProfile: vi.fn(),
    uploadPhoto: vi.fn(),
    getFilterOptions: vi.fn(),
  },
}))

describe('MarketplaceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('Catalog State', () => {
    it('initializes with default state', async () => {
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )
      const store = useMarketplaceStore()

      expect(store.tutors).toEqual([])
      expect(store.totalCount).toBe(0)
      expect(store.currentPage).toBe(1)
      expect(store.isLoading).toBe(false)
      expect(store.filters).toEqual({})
      expect(store.sortBy).toBe('-average_rating')
    })

    it('loads tutors', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors.mockResolvedValue({
        count: 2,
        results: [
          { id: 1, slug: 'tutor-1', full_name: 'Tutor 1' },
          { id: 2, slug: 'tutor-2', full_name: 'Tutor 2' },
        ],
      })

      const store = useMarketplaceStore()
      await store.loadTutors(true)

      expect(store.tutors).toHaveLength(2)
      expect(store.totalCount).toBe(2)
      expect(store.isLoading).toBe(false)
    })

    it('applies filters', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors.mockResolvedValue({ count: 0, results: [] })

      const store = useMarketplaceStore()
      store.setFilters({ subject: 'math', min_rating: 4 })

      expect(store.filters).toEqual({ subject: 'math', min_rating: 4 })
      expect(marketplaceApi.getTutors).toHaveBeenCalledWith(
        { subject: 'math', min_rating: 4 },
        1,
        20,
        '-average_rating'
      )
    })

    it('changes sort order', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors.mockResolvedValue({ count: 0, results: [] })

      const store = useMarketplaceStore()
      store.setSort('-hourly_rate')

      expect(store.sortBy).toBe('-hourly_rate')
    })

    it('loads more tutors', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors
        .mockResolvedValueOnce({
          count: 40,
          results: Array(20).fill({ id: 1, slug: 'tutor' }),
        })
        .mockResolvedValueOnce({
          count: 40,
          results: Array(20).fill({ id: 2, slug: 'tutor' }),
        })

      const store = useMarketplaceStore()
      await store.loadTutors(true)
      expect(store.tutors).toHaveLength(20)

      await store.loadMore()
      expect(store.tutors).toHaveLength(40)
      expect(store.currentPage).toBe(2)
    })

    it('computes hasMore correctly', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors.mockResolvedValue({
        count: 5,
        results: Array(5).fill({ id: 1 }),
      })

      const store = useMarketplaceStore()
      await store.loadTutors(true)

      expect(store.hasMore).toBe(false)
    })
  })

  describe('Profile State', () => {
    it('loads tutor profile', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      const mockProfile = {
        id: 1,
        slug: 'john-doe',
        user: { id: 1, full_name: 'John Doe' },
        headline: 'Math Tutor',
        bio: 'Experienced tutor',
        subjects: [],
        badges: [],
      }

      marketplaceApi.getTutorProfile.mockResolvedValue(mockProfile)

      const store = useMarketplaceStore()
      await store.loadProfile('john-doe')

      expect(store.currentProfile).toEqual(mockProfile)
      expect(store.isLoadingProfile).toBe(false)
    })

    it('handles profile not found', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutorProfile.mockRejectedValue(new Error('Not found'))

      const store = useMarketplaceStore()
      await store.loadProfile('invalid-slug')

      expect(store.currentProfile).toBeNull()
      expect(store.error).toBe('Not found')
    })
  })

  describe('My Profile State', () => {
    it('loads own profile', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      const mockProfile = {
        id: 1,
        slug: 'my-profile',
        status: 'draft',
        photo: '',
        bio: '',
        subjects: [],
        hourly_rate: 0,
      }

      marketplaceApi.getMyProfile.mockResolvedValue(mockProfile)

      const store = useMarketplaceStore()
      await store.loadMyProfile()

      expect(store.myProfile).toEqual(mockProfile)
    })

    it('computes isProfileComplete', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getMyProfile.mockResolvedValue({
        photo: 'photo.jpg',
        bio: 'Bio text',
        subjects: [{ id: 1, name: 'Math' }],
        hourly_rate: 50,
      })

      const store = useMarketplaceStore()
      await store.loadMyProfile()

      expect(store.isProfileComplete).toBe(true)
    })

    it('computes isProfileComplete as false when incomplete', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getMyProfile.mockResolvedValue({
        photo: '',
        bio: '',
        subjects: [],
        hourly_rate: 0,
      })

      const store = useMarketplaceStore()
      await store.loadMyProfile()

      expect(store.isProfileComplete).toBe(false)
    })

    it('updates profile', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      const updatedProfile = {
        id: 1,
        headline: 'Updated Headline',
        bio: 'Updated bio',
      }

      marketplaceApi.updateProfile.mockResolvedValue(updatedProfile)

      const store = useMarketplaceStore()
      await store.updateProfile({ headline: 'Updated Headline' })

      expect(store.myProfile).toEqual(updatedProfile)
      expect(store.isSaving).toBe(false)
    })

    it('submits profile for review', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.submitForReview.mockResolvedValue({
        status: 'pending_review',
      })

      const store = useMarketplaceStore()
      await store.submitForReview()

      expect(store.myProfile.status).toBe('pending_review')
    })

    it('publishes profile', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.publishProfile.mockResolvedValue({
        is_public: true,
      })

      const store = useMarketplaceStore()
      await store.publishProfile()

      expect(store.myProfile.is_public).toBe(true)
    })
  })

  describe('Reset', () => {
    it('resets store state', async () => {
      const { marketplaceApi } = await import(
        '../../../src/modules/marketplace/api/marketplace'
      )
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors.mockResolvedValue({
        count: 1,
        results: [{ id: 1 }],
      })

      const store = useMarketplaceStore()
      await store.loadTutors(true)
      store.setFilters({ subject: 'math' })

      store.$reset()

      expect(store.tutors).toEqual([])
      expect(store.filters).toEqual({})
      expect(store.currentProfile).toBeNull()
      expect(store.myProfile).toBeNull()
    })
  })
})
