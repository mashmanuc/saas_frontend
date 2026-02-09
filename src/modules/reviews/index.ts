/**
 * Reviews Module - Public API
 * 
 * Domain: Reviews & Ratings (DOMAIN-09)
 * 
 * This module provides components, stores, and API clients for managing
 * tutor reviews, ratings, and review-related functionality.
 */

// Store
export { useReviewsStore } from './stores/reviewsStore'

// API
export { reviewsApi } from './api/reviewsApi'
export type {
  Review,
  ReviewStats,
  CanReviewResponse,
  CreateReviewInput,
  UpdateReviewInput,
  PaginatedReviewsResponse,
  ReviewFilters
} from './api/reviewsApi'

// Components
export { default as ReviewCard } from './components/ReviewCard.vue'
export { default as ReviewForm } from './components/ReviewForm.vue'
export { default as ReviewsList } from './components/ReviewsList.vue'
export { default as TutorRatingWidget } from './components/TutorRatingWidget.vue'

// Views
export { default as TutorReviewsView } from './views/TutorReviewsView.vue'
export { default as MyReviewsView } from './views/MyReviewsView.vue'

// Routes configuration for router integration
export const reviewsRoutes = [
  {
    path: 'reviews/my',
    name: 'my-reviews',
    component: () => import('./views/MyReviewsView.vue'),
    meta: {
      requiresAuth: true,
      roles: ['STUDENT']
    }
  }
]

// Public route (accessible without auth)
export const reviewsPublicRoute = {
  path: '/tutor/:tutorId/reviews',
  name: 'tutor-reviews',
  component: () => import('./views/TutorReviewsView.vue'),
  meta: { requiresAuth: false }
}
