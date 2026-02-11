// F1: Reviews API Client
import apiClient from '@/utils/apiClient'

// Types
export interface User {
  id: number
  first_name: string
  last_name: string
  display_name?: string  // P0.1: Privacy-safe name (format: "FirstName L.")
  full_name?: string     // P0.1: Full name when contact access granted
  avatar?: string
}

export interface Booking {
  id: number
  booking_id: string
  tutor: User
  subject: string
  date: string
  status: string
}

export interface ReviewResponse {
  id: number
  content: string
  created_at: string
}

export interface Review {
  id: number
  booking_id: number
  student: User
  tutor: User
  rating: number
  rating_communication?: number
  rating_knowledge?: number
  rating_punctuality?: number
  title: string
  content: string
  status: 'pending' | 'approved' | 'rejected' | 'hidden'
  is_anonymous: boolean
  helpful_count: number
  is_helpful_by_me: boolean
  response?: ReviewResponse
  created_at: string
  updated_at: string
}

export interface TutorRating {
  average_rating: number
  total_reviews: number
  distribution: Record<number, number>
  detailed: {
    communication: number
    knowledge: number
    punctuality: number
  }
  response_rate: number
}

export interface ReviewInput {
  booking_id: number
  tutor_id: number
  rating: number
  rating_communication?: number
  rating_knowledge?: number
  rating_punctuality?: number
  title?: string
  content: string
  is_anonymous?: boolean
}

export interface ReviewListParams {
  page?: number
  page_size?: number
  sort?: 'recent' | 'rating_high' | 'rating_low' | 'helpful'
  rating?: number
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface CanReviewResponse {
  can_review: boolean
  reason?: string
  eligible_bookings: Booking[]
}

export const reviewsApi = {
  // Check eligibility
  canReview: (tutorId: number): Promise<CanReviewResponse> =>
    apiClient.get(`/reviews/can-review/${tutorId}/`),

  // CRUD
  createReview: (data: ReviewInput): Promise<Review> =>
    apiClient.post('/reviews/', data),

  getReview: (id: number): Promise<Review> =>
    apiClient.get(`/reviews/${id}/`),

  updateReview: (id: number, data: Partial<ReviewInput>): Promise<Review> =>
    apiClient.patch(`/reviews/${id}/`, data),

  deleteReview: (id: number): Promise<void> =>
    apiClient.delete(`/reviews/${id}/`),

  // Lists
  getTutorReviews: (
    tutorId: number,
    params?: ReviewListParams
  ): Promise<PaginatedResponse<Review>> =>
    apiClient.get(`/reviews/tutor/${tutorId}/`, { params }),

  getMyReviews: (): Promise<Review[]> =>
    apiClient.get('/reviews/my/'),

  // Response
  respondToReview: (reviewId: number, content: string): Promise<ReviewResponse> =>
    apiClient.post(`/reviews/${reviewId}/respond/`, { content }),

  updateResponse: (reviewId: number, content: string): Promise<ReviewResponse> =>
    apiClient.patch(`/reviews/${reviewId}/respond/`, { content }),

  deleteResponse: (reviewId: number): Promise<void> =>
    apiClient.delete(`/reviews/${reviewId}/respond/`),

  // Helpful
  markHelpful: (reviewId: number): Promise<void> =>
    apiClient.post(`/reviews/${reviewId}/helpful/`),

  unmarkHelpful: (reviewId: number): Promise<void> =>
    apiClient.delete(`/reviews/${reviewId}/helpful/`),

  // Report
  reportReview: (
    reviewId: number,
    reason: string,
    details?: string
  ): Promise<void> =>
    apiClient.post(`/reviews/${reviewId}/report/`, { reason, details }),

  // Rating
  getTutorRating: (tutorId: number): Promise<TutorRating> =>
    apiClient.get(`/ratings/${tutorId}/`),

  getRatingSummary: (tutorId: number): Promise<TutorRating> =>
    apiClient.get(`/ratings/${tutorId}/summary/`),
}
