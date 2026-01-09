import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock API
vi.mock('../../../src/modules/marketplace/api/marketplace', () => ({
  default: {
    getTutors: vi.fn(),
    getTutorProfile: vi.fn(),
    getMyProfile: vi.fn(),
    getTutorMeProfile: vi.fn(),
    updateTutorMeProfile: vi.fn(),
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
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
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
      expect(store.sortBy).toBe('recommended')
    })

    it('loads tutors', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
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
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors.mockResolvedValue({ count: 0, results: [] })

      const store = useMarketplaceStore()
      store.setFilters({ subject: 'math', min_rating: 4 })

      await vi.advanceTimersByTimeAsync(350)

      expect(store.filters).toEqual({ subject: 'math', min_rating: 4 })
      expect(marketplaceApi.getTutors).toHaveBeenCalledWith(
        { subject: 'math', min_rating: 4 },
        1,
        24,
        'recommended'
      )
    })

    it('changes sort order', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutors.mockResolvedValue({ count: 0, results: [] })

      const store = useMarketplaceStore()
      store.setSort('-hourly_rate')

      expect(store.sortBy).toBe('-hourly_rate')
    })

    it('loads more tutors', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
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
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
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
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
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
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutorProfile.mockRejectedValue(new Error('Not found'))

      const store = useMarketplaceStore()
      await store.loadProfile('invalid-slug')

      expect(store.currentProfile).toBeNull()
      expect(typeof store.error === 'string' && store.error.length > 0).toBe(true)
    })
  })

  describe('My Profile State', () => {
    it('loads own profile', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
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

      marketplaceApi.getTutorMeProfile.mockResolvedValue(mockProfile)

      const store = useMarketplaceStore()
      await store.loadMyProfile()

      expect(store.myProfile).toEqual(mockProfile)
    })

    it('computes isProfileComplete', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutorMeProfile.mockResolvedValue({
        media: { photo_url: 'photo.jpg' },
        headline: 'Top tutor',
        bio: 'Bio text',
        subjects: ['math'],
        languages: [{ code: 'en', level: 'native' }],
        pricing: { hourly_rate: 50 }
      })

      const store = useMarketplaceStore()
      await store.loadMyProfile()

      expect(store.isProfileComplete).toBe(true)
    })

    it('computes isProfileComplete as false when incomplete', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      marketplaceApi.getTutorMeProfile.mockResolvedValue({
        media: { photo_url: '' },
        headline: '',
        bio: '',
        subjects: [],
        languages: [],
        pricing: { hourly_rate: 0 }
      })

      const store = useMarketplaceStore()
      await store.loadMyProfile()

      expect(store.isProfileComplete).toBe(false)
    })

    it('updates profile', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      const updatedProfile = {
        id: 1,
        headline: 'Updated Headline',
        is_public: false
      }
      marketplaceApi.updateTutorMeProfile.mockResolvedValue(updatedProfile)
      marketplaceApi.getTutorMeProfile.mockResolvedValue(updatedProfile)

      const store = useMarketplaceStore()
      await store.updateProfile({ headline: 'Updated Headline' })

      expect(store.myProfile).toEqual(updatedProfile)
      expect(store.isSaving).toBe(false)
    })

    it('submits profile for review', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      const pendingProfile = { status: 'pending_review' }
      marketplaceApi.submitForReview.mockResolvedValue({})
      marketplaceApi.getTutorMeProfile.mockResolvedValue(pendingProfile)

      const store = useMarketplaceStore()
      await store.submitForReview()

      expect(store.myProfile.status).toBe('pending_review')
    })

    it('publishes profile', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
      const { useMarketplaceStore } = await import(
        '../../../src/modules/marketplace/stores/marketplaceStore'
      )

      const publishedProfile = { is_public: true }
      marketplaceApi.publishProfile.mockResolvedValue({})
      marketplaceApi.getTutorMeProfile.mockResolvedValue(publishedProfile)

      const store = useMarketplaceStore()
      await store.publishProfile()

      expect(store.myProfile.is_public).toBe(true)
    })
  })

  describe('Reset', () => {
    it('resets store state', async () => {
      const marketplaceApi = (await import('../../../src/modules/marketplace/api/marketplace')).default
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
