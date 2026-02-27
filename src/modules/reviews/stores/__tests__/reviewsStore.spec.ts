import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useReviewsStore } from '../reviewsStore'
import * as reviewsApi from '../../api/reviewsApi'
import type { Review } from '../../api/reviewsApi'

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
          { 
            id: 1, 
            tutor_id: 123, 
            student_id: 456,
            rating: 5, 
            text: 'Great tutor!', 
            is_anonymous: false,
            is_verified: true,
            helpful_count: 0,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
            can_edit: false,
            can_delete: false,
            has_user_marked_helpful: false
          } as Review
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
      const mockReview: Review = {
        id: 1,
        tutor_id: 123,
        student_id: 456,
        rating: 5,
        text: 'Excellent!',
        is_anonymous: false,
        is_verified: false,
        helpful_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        can_edit: true,
        can_delete: true,
        has_user_marked_helpful: false
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
