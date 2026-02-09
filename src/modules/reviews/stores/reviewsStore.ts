import { defineStore } from 'pinia'
import { reviewsApi, type Review, type ReviewStats, type CanReviewResponse, type CreateReviewInput, type UpdateReviewInput, type ReviewFilters } from '../api/reviewsApi'

interface ReviewsState {
  // Tutor reviews
  tutorReviews: Review[]
  tutorStats: ReviewStats | null
  tutorTags: string[]
  
  // User's reviews
  myReviews: Review[]
  reviewsAboutMe: Review[]
  pendingReviews: Array<{
    tutor_id: number
    tutor_name: string
    tutor_avatar?: string
    completed_lesson_date: string
    can_review_until: string
  }>
  
  // Review eligibility
  canReviewData: Map<number, CanReviewResponse>
  
  // Pagination
  reviewsCount: number
  reviewsHasMore: boolean
  myReviewsCount: number
  myReviewsHasMore: boolean
  
  // UI state
  loading: boolean
  error: string | null
  submitting: boolean
  
  // Cache
  lastFetch: Map<string, number>
}

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export const useReviewsStore = defineStore('reviews', {
  state: (): ReviewsState => ({
    tutorReviews: [],
    tutorStats: null,
    tutorTags: [],
    myReviews: [],
    reviewsAboutMe: [],
    pendingReviews: [],
    canReviewData: new Map(),
    reviewsCount: 0,
    reviewsHasMore: false,
    myReviewsCount: 0,
    myReviewsHasMore: false,
    loading: false,
    error: null,
    submitting: false,
    lastFetch: new Map()
  }),

  getters: {
    getAverageRating: (state): number => 
      state.tutorStats?.average_rating || 0,
    
    getTotalReviews: (state): number => 
      state.tutorStats?.total_reviews || 0,
    
    getRatingDistribution: (state): ReviewStats['distribution'] => 
      state.tutorStats?.distribution || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    
    getVerifiedCount: (state): number => 
      state.tutorStats?.verified_count || 0,
    
    hasError: (state): boolean => !!state.error,
    
    canReviewTutor: (state) => (tutorId: number): CanReviewResponse | undefined => 
      state.canReviewData.get(tutorId),
    
    getPendingReviewCount: (state): number => 
      state.pendingReviews.length
  },

  actions: {
    /**
     * Check if user can review a tutor
     */
    async checkCanReview(tutorId: number, force: boolean = false): Promise<CanReviewResponse> {
      const cached = this.canReviewData.get(tutorId)
      
      if (!force && cached) {
        return cached
      }

      try {
        const response = await reviewsApi.canReview(tutorId)
        this.canReviewData.set(tutorId, response)
        return response
      } catch (error: any) {
        this.error = error.message || 'Failed to check review eligibility'
        throw error
      }
    },

    /**
     * Fetch reviews for a tutor
     */
    async fetchTutorReviews(
      tutorId: number, 
      filters?: ReviewFilters, 
      page: number = 1,
      append: boolean = false
    ): Promise<void> {
      const cacheKey = `tutor-${tutorId}-${JSON.stringify(filters)}-${page}`
      const cached = this.lastFetch.get(cacheKey)
      
      if (!append && cached && Date.now() - cached < CACHE_DURATION) {
        return
      }

      this.loading = true
      this.error = null

      try {
        const response = await reviewsApi.getTutorReviews(tutorId, filters, page)
        
        if (append) {
          this.tutorReviews.push(...response.results)
        } else {
          this.tutorReviews = response.results
        }
        
        this.reviewsCount = response.count
        this.reviewsHasMore = !!response.next
        this.lastFetch.set(cacheKey, Date.now())
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch reviews'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch tutor review stats
     */
    async fetchTutorStats(tutorId: number, force: boolean = false): Promise<void> {
      const cacheKey = `stats-${tutorId}`
      const cached = this.lastFetch.get(cacheKey)
      
      if (!force && cached && Date.now() - cached < CACHE_DURATION) {
        return
      }

      try {
        this.tutorStats = await reviewsApi.getTutorStats(tutorId)
        this.lastFetch.set(cacheKey, Date.now())
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch stats'
        throw error
      }
    },

    /**
     * Fetch tutor tags/strengths
     */
    async fetchTutorTags(tutorId: number): Promise<void> {
      try {
        const response = await reviewsApi.getTutorTags(tutorId)
        this.tutorTags = response.tags
      } catch (error: any) {
        this.tutorTags = []
      }
    },

    /**
     * Create a new review
     */
    async createReview(data: CreateReviewInput): Promise<Review> {
      this.submitting = true
      this.error = null

      try {
        const review = await reviewsApi.createReview(data)
        
        // Optimistic update
        this.tutorReviews.unshift(review)
        this.reviewsCount++
        
        // Update eligibility
        this.canReviewData.set(data.tutor_id, {
          can_review: false,
          reason: 'already_reviewed',
          existing_review_id: review.id
        })
        
        // Remove from pending
        this.pendingReviews = this.pendingReviews.filter(
          p => p.tutor_id !== data.tutor_id
        )
        
        return review
      } catch (error: any) {
        this.error = error.message || 'Failed to submit review'
        throw error
      } finally {
        this.submitting = false
      }
    },

    /**
     * Update an existing review
     */
    async updateReview(reviewId: number, data: UpdateReviewInput): Promise<Review> {
      this.submitting = true
      this.error = null

      try {
        const updated = await reviewsApi.updateReview(reviewId, data)
        
        // Update in tutorReviews
        const index = this.tutorReviews.findIndex(r => r.id === reviewId)
        if (index !== -1) {
          this.tutorReviews[index] = updated
        }
        
        // Update in myReviews
        const myIndex = this.myReviews.findIndex(r => r.id === reviewId)
        if (myIndex !== -1) {
          this.myReviews[myIndex] = updated
        }
        
        return updated
      } catch (error: any) {
        this.error = error.message || 'Failed to update review'
        throw error
      } finally {
        this.submitting = false
      }
    },

    /**
     * Delete a review
     */
    async deleteReview(reviewId: number, tutorId: number): Promise<void> {
      try {
        await reviewsApi.deleteReview(reviewId)
        
        // Remove from lists
        this.tutorReviews = this.tutorReviews.filter(r => r.id !== reviewId)
        this.myReviews = this.myReviews.filter(r => r.id !== reviewId)
        this.reviewsCount = Math.max(0, this.reviewsCount - 1)
        
        // Reset eligibility
        this.canReviewData.delete(tutorId)
      } catch (error: any) {
        this.error = error.message || 'Failed to delete review'
        throw error
      }
    },

    /**
     * Fetch current user's reviews
     */
    async fetchMyReviews(page: number = 1, append: boolean = false): Promise<void> {
      this.loading = true

      try {
        const response = await reviewsApi.getMyReviews(page)
        
        if (append) {
          this.myReviews.push(...response.results)
        } else {
          this.myReviews = response.results
        }
        
        this.myReviewsCount = response.count
        this.myReviewsHasMore = !!response.next
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch my reviews'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Fetch reviews about current tutor
     */
    async fetchReviewsAboutMe(
      filters?: { has_response?: boolean; sort_by?: string },
      page: number = 1,
      append: boolean = false
    ): Promise<void> {
      this.loading = true

      try {
        const response = await reviewsApi.getReviewsAboutMe(filters, page)
        
        if (append) {
          this.reviewsAboutMe.push(...response.results)
        } else {
          this.reviewsAboutMe = response.results
        }
        
        this.reviewsCount = response.count
        this.reviewsHasMore = !!response.next
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch reviews'
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Respond to a review (tutor only)
     */
    async respondToReview(reviewId: number, text: string): Promise<void> {
      this.submitting = true

      try {
        const updated = await reviewsApi.respondToReview(reviewId, text)
        
        // Update in reviewsAboutMe
        const index = this.reviewsAboutMe.findIndex(r => r.id === reviewId)
        if (index !== -1) {
          this.reviewsAboutMe[index] = updated
        }
        
        // Update in tutorReviews
        const tutorIndex = this.tutorReviews.findIndex(r => r.id === reviewId)
        if (tutorIndex !== -1) {
          this.tutorReviews[tutorIndex] = updated
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to respond to review'
        throw error
      } finally {
        this.submitting = false
      }
    },

    /**
     * Mark review as helpful
     */
    async markHelpful(reviewId: number): Promise<void> {
      try {
        const response = await reviewsApi.markHelpful(reviewId)
        
        // Update in tutorReviews
        const review = this.tutorReviews.find(r => r.id === reviewId)
        if (review) {
          review.helpful_count = response.helpful_count
          review.has_user_marked_helpful = true
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to mark helpful'
        throw error
      }
    },

    /**
     * Unmark review as helpful
     */
    async unmarkHelpful(reviewId: number): Promise<void> {
      try {
        const response = await reviewsApi.unmarkHelpful(reviewId)
        
        const review = this.tutorReviews.find(r => r.id === reviewId)
        if (review) {
          review.helpful_count = response.helpful_count
          review.has_user_marked_helpful = false
        }
      } catch (error: any) {
        this.error = error.message || 'Failed to unmark helpful'
        throw error
      }
    },

    /**
     * Report a review
     */
    async reportReview(
      reviewId: number,
      reason: 'inaccurate' | 'offensive' | 'fake' | 'other',
      comment?: string
    ): Promise<void> {
      try {
        await reviewsApi.reportReview(reviewId, reason, comment)
      } catch (error: any) {
        this.error = error.message || 'Failed to report review'
        throw error
      }
    },

    /**
     * Fetch pending reviews
     */
    async fetchPendingReviews(): Promise<void> {
      try {
        const response = await reviewsApi.getPendingReviews()
        this.pendingReviews = response.pending
      } catch (error: any) {
        this.error = error.message || 'Failed to fetch pending reviews'
        throw error
      }
    },

    /**
     * Reset store state
     */
    $reset() {
      this.tutorReviews = []
      this.tutorStats = null
      this.tutorTags = []
      this.myReviews = []
      this.reviewsAboutMe = []
      this.pendingReviews = []
      this.canReviewData.clear()
      this.reviewsCount = 0
      this.reviewsHasMore = false
      this.myReviewsCount = 0
      this.myReviewsHasMore = false
      this.loading = false
      this.error = null
      this.submitting = false
      this.lastFetch.clear()
    }
  }
})
