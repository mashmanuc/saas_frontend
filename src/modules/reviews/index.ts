// Reviews Module Exports

// Views
export { default as WriteReviewView } from './views/WriteReviewView.vue'
export { default as MyReviewsView } from './views/MyReviewsView.vue'
export { default as TutorReviewsView } from './views/TutorReviewsView.vue'

// Store
export { useReviewStore } from './stores/reviewStore'

// Composables
export { useReview } from './composables/useReview'
export { useRating } from './composables/useRating'

// API
export { reviewsApi } from './api/reviews'
export type {
  Review,
  ReviewResponse,
  TutorRating,
  ReviewInput,
  ReviewListParams,
  PaginatedResponse,
  CanReviewResponse,
  User,
  Booking,
} from './api/reviews'

// Display Components
export { default as ReviewCard } from './components/display/ReviewCard.vue'
export { default as ReviewList } from './components/display/ReviewList.vue'
export { default as RatingSummary } from './components/display/RatingSummary.vue'
export { default as RatingStars } from './components/display/RatingStars.vue'
export { default as RatingDistribution } from './components/display/RatingDistribution.vue'
export { default as ReviewResponseDisplay } from './components/display/ReviewResponse.vue'

// Form Components
export { default as ReviewForm } from './components/forms/ReviewForm.vue'
export { default as StarRating } from './components/forms/StarRating.vue'
export { default as DetailedRating } from './components/forms/DetailedRating.vue'
export { default as ResponseForm } from './components/forms/ResponseForm.vue'

// Action Components
export { default as HelpfulButton } from './components/actions/HelpfulButton.vue'
export { default as ReportButton } from './components/actions/ReportButton.vue'
export { default as ReviewActions } from './components/actions/ReviewActions.vue'

// Widget Components
export { default as ReviewPrompt } from './components/widgets/ReviewPrompt.vue'
export { default as TutorRatingBadge } from './components/widgets/TutorRatingBadge.vue'
