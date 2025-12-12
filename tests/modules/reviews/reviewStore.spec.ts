// Unit tests for reviewStore (v0.22.0)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock reviews API
vi.mock('@/modules/reviews/api/reviews', () => ({
  reviewsApi: {
    canReview: vi.fn(),
    createReview: vi.fn(),
    getReview: vi.fn(),
    updateReview: vi.fn(),
    deleteReview: vi.fn(),
    getTutorReviews: vi.fn(),
    getMyReviews: vi.fn(),
    respondToReview: vi.fn(),
    updateResponse: vi.fn(),
    deleteResponse: vi.fn(),
    markHelpful: vi.fn(),
    unmarkHelpful: vi.fn(),
    reportReview: vi.fn(),
    getTutorRating: vi.fn(),
    getRatingSummary: vi.fn(),
  },
}))

import { useReviewStore } from '@/modules/reviews/stores/reviewStore'
import { reviewsApi } from '@/modules/reviews/api/reviews'

const mockReview = {
  id: 1,
  booking_id: 100,
  student: { id: 1, first_name: 'John', last_name: 'Doe' },
  tutor: { id: 2, first_name: 'Jane', last_name: 'Smith' },
  rating: 5,
  rating_communication: 5,
  rating_knowledge: 5,
  rating_punctuality: 4,
  title: 'Great tutor!',
  content: 'Very helpful and patient.',
  status: 'approved' as const,
  is_anonymous: false,
  helpful_count: 10,
  is_helpful_by_me: false,
  response: null,
  created_at: '2024-12-10T10:00:00Z',
  updated_at: '2024-12-10T10:00:00Z',
}

const mockRating = {
  average_rating: 4.8,
  total_reviews: 50,
  distribution: { 1: 1, 2: 2, 3: 3, 4: 10, 5: 34 },
  detailed: {
    communication: 4.9,
    knowledge: 4.8,
    punctuality: 4.7,
  },
  response_rate: 85,
}

describe('reviewStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('initial state', () => {
    it('should have empty reviews array', () => {
      const store = useReviewStore()
      expect(store.reviews).toEqual([])
    })

    it('should have null tutorRating', () => {
      const store = useReviewStore()
      expect(store.tutorRating).toBeNull()
    })

    it('should not be loading', () => {
      const store = useReviewStore()
      expect(store.isLoading).toBe(false)
    })

    it('should have sortBy as recent', () => {
      const store = useReviewStore()
      expect(store.sortBy).toBe('recent')
    })
  })

  describe('computed properties', () => {
    it('averageRating should return tutorRating average', () => {
      const store = useReviewStore()
      store.tutorRating = mockRating
      expect(store.averageRating).toBe(4.8)
    })

    it('totalReviews should return tutorRating total', () => {
      const store = useReviewStore()
      store.tutorRating = mockRating
      expect(store.totalReviews).toBe(50)
    })

    it('distribution should return rating distribution', () => {
      const store = useReviewStore()
      store.tutorRating = mockRating
      expect(store.distribution[5]).toBe(34)
    })

    it('canWriteReview should reflect eligibility', () => {
      const store = useReviewStore()
      store.eligibility = { can_review: true, eligible_bookings: [] }
      expect(store.canWriteReview).toBe(true)
    })
  })

  describe('checkEligibility action', () => {
    it('should check eligibility from API', async () => {
      const store = useReviewStore()
      const mockEligibility = {
        can_review: true,
        eligible_bookings: [{ id: 1, booking_id: 'BK-001' }],
      }
      ;(reviewsApi.canReview as any).mockResolvedValue(mockEligibility)

      const result = await store.checkEligibility(2)

      expect(reviewsApi.canReview).toHaveBeenCalledWith(2)
      expect(store.eligibility).toEqual(mockEligibility)
      expect(result).toEqual(mockEligibility)
    })
  })

  describe('loadTutorReviews action', () => {
    it('should load reviews from API', async () => {
      const store = useReviewStore()
      const mockResponse = {
        count: 2,
        next: null,
        previous: null,
        results: [mockReview, { ...mockReview, id: 2 }],
      }
      ;(reviewsApi.getTutorReviews as any).mockResolvedValue(mockResponse)

      await store.loadTutorReviews(2, true)

      expect(reviewsApi.getTutorReviews).toHaveBeenCalledWith(2, {
        page: 1,
        sort: 'recent',
      })
      expect(store.reviews).toHaveLength(2)
      expect(store.totalCount).toBe(2)
    })

    it('should append reviews when not reset', async () => {
      const store = useReviewStore()
      store.reviews = [mockReview]
      store.currentPage = 1

      const mockResponse = {
        count: 2,
        next: null,
        results: [{ ...mockReview, id: 2 }],
      }
      ;(reviewsApi.getTutorReviews as any).mockResolvedValue(mockResponse)

      await store.loadTutorReviews(2, false)

      expect(store.reviews).toHaveLength(2)
    })

    it('should set hasMore based on next', async () => {
      const store = useReviewStore()
      ;(reviewsApi.getTutorReviews as any).mockResolvedValue({
        count: 20,
        next: 'http://api/reviews?page=2',
        results: [mockReview],
      })

      await store.loadTutorReviews(2, true)

      expect(store.hasMore).toBe(true)
    })
  })

  describe('loadTutorRating action', () => {
    it('should load rating from API', async () => {
      const store = useReviewStore()
      ;(reviewsApi.getRatingSummary as any).mockResolvedValue(mockRating)

      await store.loadTutorRating(2)

      expect(reviewsApi.getRatingSummary).toHaveBeenCalledWith(2)
      expect(store.tutorRating).toEqual(mockRating)
    })
  })

  describe('loadMyReviews action', () => {
    it('should load my reviews from API', async () => {
      const store = useReviewStore()
      ;(reviewsApi.getMyReviews as any).mockResolvedValue([mockReview])

      await store.loadMyReviews()

      expect(store.myReviews).toHaveLength(1)
    })
  })

  describe('createReview action', () => {
    it('should create review and add to myReviews', async () => {
      const store = useReviewStore()
      ;(reviewsApi.createReview as any).mockResolvedValue(mockReview)

      const result = await store.createReview({
        booking_id: 100,
        tutor_id: 2,
        rating: 5,
        content: 'Great!',
      })

      expect(result).toEqual(mockReview)
      expect(store.myReviews).toContain(mockReview)
    })
  })

  describe('updateReview action', () => {
    it('should update review in lists', async () => {
      const store = useReviewStore()
      store.reviews = [mockReview]
      store.myReviews = [mockReview]

      const updated = { ...mockReview, content: 'Updated content' }
      ;(reviewsApi.updateReview as any).mockResolvedValue(updated)

      await store.updateReview(1, { content: 'Updated content' })

      expect(store.reviews[0].content).toBe('Updated content')
      expect(store.myReviews[0].content).toBe('Updated content')
    })
  })

  describe('deleteReview action', () => {
    it('should remove review from lists', async () => {
      const store = useReviewStore()
      store.reviews = [mockReview]
      store.myReviews = [mockReview]
      ;(reviewsApi.deleteReview as any).mockResolvedValue(undefined)

      await store.deleteReview(1)

      expect(store.reviews).toHaveLength(0)
      expect(store.myReviews).toHaveLength(0)
    })
  })

  describe('respondToReview action', () => {
    it('should add response to review', async () => {
      const store = useReviewStore()
      store.reviews = [{ ...mockReview, response: undefined }]

      const mockResponse = { id: 1, content: 'Thank you!', created_at: '2024-12-11' }
      ;(reviewsApi.respondToReview as any).mockResolvedValue(mockResponse)

      await store.respondToReview(1, 'Thank you!')

      expect(store.reviews[0].response).toEqual(mockResponse)
    })
  })

  describe('toggleHelpful action', () => {
    it('should mark as helpful', async () => {
      const store = useReviewStore()
      store.reviews = [{ ...mockReview, is_helpful_by_me: false, helpful_count: 10 }]
      ;(reviewsApi.markHelpful as any).mockResolvedValue(undefined)

      await store.toggleHelpful(1)

      expect(store.reviews[0].is_helpful_by_me).toBe(true)
      expect(store.reviews[0].helpful_count).toBe(11)
    })

    it('should unmark as helpful', async () => {
      const store = useReviewStore()
      store.reviews = [{ ...mockReview, is_helpful_by_me: true, helpful_count: 10 }]
      ;(reviewsApi.unmarkHelpful as any).mockResolvedValue(undefined)

      await store.toggleHelpful(1)

      expect(store.reviews[0].is_helpful_by_me).toBe(false)
      expect(store.reviews[0].helpful_count).toBe(9)
    })
  })

  describe('setSortBy action', () => {
    it('should update sortBy', () => {
      const store = useReviewStore()
      store.setSortBy('rating_high')
      expect(store.sortBy).toBe('rating_high')
    })
  })

  describe('setFilterRating action', () => {
    it('should update filterRating', () => {
      const store = useReviewStore()
      store.setFilterRating(5)
      expect(store.filterRating).toBe(5)
    })

    it('should clear filterRating with null', () => {
      const store = useReviewStore()
      store.filterRating = 5
      store.setFilterRating(null)
      expect(store.filterRating).toBeNull()
    })
  })

  describe('WebSocket handlers', () => {
    it('handleReviewCreated should add review', () => {
      const store = useReviewStore()
      store.handleReviewCreated(mockReview)

      expect(store.reviews).toContain(mockReview)
      expect(store.totalCount).toBe(1)
    })

    it('handleReviewCreated should not duplicate', () => {
      const store = useReviewStore()
      store.reviews = [mockReview]
      store.totalCount = 1

      store.handleReviewCreated(mockReview)

      expect(store.reviews).toHaveLength(1)
    })

    it('handleReviewUpdated should update review', () => {
      const store = useReviewStore()
      store.reviews = [mockReview]

      const updated = { ...mockReview, content: 'Updated' }
      store.handleReviewUpdated(updated)

      expect(store.reviews[0].content).toBe('Updated')
    })

    it('handleReviewDeleted should remove review', () => {
      const store = useReviewStore()
      store.reviews = [mockReview]
      store.totalCount = 1

      store.handleReviewDeleted(1)

      expect(store.reviews).toHaveLength(0)
      expect(store.totalCount).toBe(0)
    })
  })

  describe('$reset action', () => {
    it('should reset all state', () => {
      const store = useReviewStore()
      store.reviews = [mockReview]
      store.myReviews = [mockReview]
      store.tutorRating = mockRating
      store.sortBy = 'helpful'
      store.filterRating = 5

      store.$reset()

      expect(store.reviews).toEqual([])
      expect(store.myReviews).toEqual([])
      expect(store.tutorRating).toBeNull()
      expect(store.sortBy).toBe('recent')
      expect(store.filterRating).toBeNull()
    })
  })
})
