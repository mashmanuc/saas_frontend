import apiClient from '@/api/client'

export interface Review {
  id: number
  tutor_id: number
  student_id: number
  student_name?: string
  student_avatar?: string
  rating: 1 | 2 | 3 | 4 | 5
  text: string
  is_anonymous: boolean
  is_verified: boolean
  helpful_count: number
  tutor_response?: {
    text: string
    created_at: string
  }
  created_at: string
  updated_at: string
  can_edit: boolean
  can_delete: boolean
  has_user_marked_helpful: boolean
}

export interface ReviewStats {
  average_rating: number
  total_reviews: number
  distribution: {
    5: number
    4: number
    3: number
    2: number
    1: number
  }
  verified_count: number
}

export interface CanReviewResponse {
  can_review: boolean
  reason?: 'already_reviewed' | 'no_completed_lessons' | 'too_soon' | 'blocked'
  existing_review_id?: number
  next_review_date?: string
}

export interface CreateReviewInput {
  tutor_id: number
  rating: 1 | 2 | 3 | 4 | 5
  text: string
  is_anonymous?: boolean
}

export interface UpdateReviewInput {
  rating?: 1 | 2 | 3 | 4 | 5
  text?: string
  is_anonymous?: boolean
}

export interface PaginatedReviewsResponse {
  results: Review[]
  count: number
  next: string | null
  previous: string | null
}

export interface ReviewFilters {
  rating?: 1 | 2 | 3 | 4 | 5
  is_verified?: boolean
  has_response?: boolean
  sort_by?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful'
}

export const reviewsApi = {
  /**
   * Check if current user can review a tutor
   */
  canReview: (tutorId: number): Promise<CanReviewResponse> =>
    apiClient.get(`/v1/reviews/can-review/${tutorId}/`),

  /**
   * Get reviews for a tutor with optional filters
   */
  getTutorReviews: (
    tutorId: number,
    filters?: ReviewFilters,
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedReviewsResponse> =>
    apiClient.get(`/v1/reviews/tutor/${tutorId}/`, {
      params: {
        ...filters,
        page,
        page_size: pageSize
      }
    }),

  /**
   * Get review statistics for a tutor
   */
  getTutorStats: (tutorId: number): Promise<ReviewStats> =>
    apiClient.get(`/v1/reviews/tutor/${tutorId}/stats/`),

  /**
   * Get tags/strengths for a tutor based on reviews
   */
  getTutorTags: (tutorId: number): Promise<{ tags: string[] }> =>
    apiClient.get(`/v1/reviews/tutor/${tutorId}/tags/`),

  /**
   * Create a new review
   */
  createReview: (data: CreateReviewInput): Promise<Review> =>
    apiClient.post('/v1/reviews/', data),

  /**
   * Update an existing review (within 24h)
   */
  updateReview: (reviewId: number, data: UpdateReviewInput): Promise<Review> =>
    apiClient.patch(`/v1/reviews/${reviewId}/`, data),

  /**
   * Delete a review
   */
  deleteReview: (reviewId: number): Promise<void> =>
    apiClient.delete(`/v1/reviews/${reviewId}/`),

  /**
   * Get current user's reviews (as student)
   */
  getMyReviews: (
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedReviewsResponse> =>
    apiClient.get('/v1/reviews/my/', {
      params: { page, page_size: pageSize }
    }),

  /**
   * Get reviews about current user (as tutor)
   */
  getReviewsAboutMe: (
    filters?: { has_response?: boolean; sort_by?: string },
    page: number = 1,
    pageSize: number = 10
  ): Promise<PaginatedReviewsResponse> =>
    apiClient.get('/v1/reviews/about-me/', {
      params: { ...filters, page, page_size: pageSize }
    }),

  /**
   * Respond to a review (tutor only)
   */
  respondToReview: (reviewId: number, text: string): Promise<Review> =>
    apiClient.post(`/v1/reviews/${reviewId}/respond/`, { text }),

  /**
   * Mark review as helpful
   */
  markHelpful: (reviewId: number): Promise<{ helpful_count: number }> =>
    apiClient.post(`/v1/reviews/${reviewId}/helpful/`),

  /**
   * Unmark review as helpful
   */
  unmarkHelpful: (reviewId: number): Promise<{ helpful_count: number }> =>
    apiClient.delete(`/v1/reviews/${reviewId}/helpful/`),

  /**
   * Report a review
   */
  reportReview: (
    reviewId: number,
    reason: 'inaccurate' | 'offensive' | 'fake' | 'other',
    comment?: string
  ): Promise<void> =>
    apiClient.post(`/v1/reviews/${reviewId}/report/`, { reason, comment }),

  /**
   * Get pending reviews (tutors waiting for review from student)
   */
  getPendingReviews: (): Promise<{
    pending: Array<{
      tutor_id: number
      tutor_name: string
      tutor_avatar?: string
      completed_lesson_date: string
      can_review_until: string
    }>
  }> =>
    apiClient.get('/v1/reviews/pending/')
}
