import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useReviewsStore } from '../reviewsStore'
import * as reviewsApi from '../../api/reviewsApi'

vi.mock('../../api/reviewsApi')

describe('reviewsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('state', () => {
    it('should initialize with default state', () => {
      const store = useReviewsStore()
      
      expect(store.tutorReviews).toEqual([])
      expect(store.tutorStats).toBeNull()
      expect(store.myReviews).toEqual([])
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })
  })

  describe('fetchTutorReviews', () => {
    it('should fetch tutor reviews', async () => {
      const mockReviews = {
        results: [
          { id: 1, tutor_id: 123, rating: 5, text: 'Great tutor!', is_verified: true }
        ],
        count: 1,
        next: null,
        previous: null
      }
      
      vi.mocked(reviewsApi.reviewsApi.getTutorReviews).mockResolvedValue(mockReviews)
      
      const store = useReviewsStore()
      await store.fetchTutorReviews(123)
      
      expect(store.tutorReviews).toEqual(mockReviews.results)
      expect(store.reviewsCount).toBe(1)
    })
  })

  describe('createReview', () => {
    it('should create review and update state', async () => {
      const mockReview = { 
        id: 1, 
        tutor_id: 123, 
        rating: 5, 
        text: 'Excellent!',
        is_verified: false
      }
      
      vi.mocked(reviewsApi.reviewsApi.createReview).mockResolvedValue(mockReview)
      
      const store = useReviewsStore()
      const result = await store.createReview({
        tutor_id: 123,
        rating: 5,
        text: 'Excellent!'
      })
      
      expect(result).toEqual(mockReview)
      expect(store.tutorReviews[0]).toEqual(mockReview)
    })
  })
})
