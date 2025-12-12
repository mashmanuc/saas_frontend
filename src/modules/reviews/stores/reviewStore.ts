// F2: Review Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  reviewsApi,
  Review,
  TutorRating,
  ReviewInput,
  ReviewListParams,
  CanReviewResponse,
} from '../api/reviews'

export const useReviewStore = defineStore('reviews', () => {
  // State
  const reviews = ref<Review[]>([])
  const myReviews = ref<Review[]>([])
  const currentReview = ref<Review | null>(null)
  const tutorRating = ref<TutorRating | null>(null)
  const eligibility = ref<CanReviewResponse | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  // Pagination
  const hasMore = ref(false)
  const currentPage = ref(1)
  const totalCount = ref(0)
  const sortBy = ref<'recent' | 'rating_high' | 'rating_low' | 'helpful'>('recent')
  const filterRating = ref<number | null>(null)

  // Computed
  const averageRating = computed(() => tutorRating.value?.average_rating || 0)
  const totalReviews = computed(() => tutorRating.value?.total_reviews || 0)

  const distribution = computed(() =>
    tutorRating.value?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  )

  const detailedRatings = computed(() => tutorRating.value?.detailed || null)

  const canWriteReview = computed(() => eligibility.value?.can_review || false)
  const eligibleBookings = computed(() => eligibility.value?.eligible_bookings || [])

  // Actions
  async function checkEligibility(tutorId: number): Promise<CanReviewResponse> {
    try {
      eligibility.value = await reviewsApi.canReview(tutorId)
      return eligibility.value
    } catch (e: any) {
      error.value = e.message || 'Failed to check eligibility'
      throw e
    }
  }

  async function loadTutorReviews(tutorId: number, reset = false): Promise<void> {
    if (reset) {
      reviews.value = []
      currentPage.value = 1
    }

    isLoading.value = true
    error.value = null

    try {
      const params: ReviewListParams = {
        page: currentPage.value,
        sort: sortBy.value,
      }

      if (filterRating.value) {
        params.rating = filterRating.value
      }

      const response = await reviewsApi.getTutorReviews(tutorId, params)

      if (reset) {
        reviews.value = response.results
      } else {
        reviews.value.push(...response.results)
      }

      totalCount.value = response.count
      hasMore.value = !!response.next
    } catch (e: any) {
      error.value = e.message || 'Failed to load reviews'
    } finally {
      isLoading.value = false
    }
  }

  async function loadMoreReviews(tutorId: number): Promise<void> {
    if (!hasMore.value || isLoading.value) return
    currentPage.value++
    await loadTutorReviews(tutorId, false)
  }

  async function loadTutorRating(tutorId: number): Promise<void> {
    try {
      tutorRating.value = await reviewsApi.getRatingSummary(tutorId)
    } catch (e: any) {
      error.value = e.message || 'Failed to load rating'
    }
  }

  async function loadMyReviews(): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      myReviews.value = await reviewsApi.getMyReviews()
    } catch (e: any) {
      error.value = e.message || 'Failed to load my reviews'
    } finally {
      isLoading.value = false
    }
  }

  async function loadReview(id: number): Promise<void> {
    isLoading.value = true
    error.value = null

    try {
      currentReview.value = await reviewsApi.getReview(id)
    } catch (e: any) {
      error.value = e.message || 'Failed to load review'
    } finally {
      isLoading.value = false
    }
  }

  async function createReview(data: ReviewInput): Promise<Review> {
    isLoading.value = true
    error.value = null

    try {
      const review = await reviewsApi.createReview(data)
      myReviews.value.unshift(review)
      return review
    } catch (e: any) {
      error.value = e.message || 'Failed to create review'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function updateReview(
    id: number,
    data: Partial<ReviewInput>
  ): Promise<Review> {
    isLoading.value = true
    error.value = null

    try {
      const review = await reviewsApi.updateReview(id, data)
      updateReviewInList(review)
      return review
    } catch (e: any) {
      error.value = e.message || 'Failed to update review'
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function deleteReview(id: number): Promise<void> {
    try {
      await reviewsApi.deleteReview(id)
      reviews.value = reviews.value.filter((r) => r.id !== id)
      myReviews.value = myReviews.value.filter((r) => r.id !== id)
      if (currentReview.value?.id === id) {
        currentReview.value = null
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete review'
      throw e
    }
  }

  async function respondToReview(reviewId: number, content: string): Promise<void> {
    try {
      const response = await reviewsApi.respondToReview(reviewId, content)
      const review = reviews.value.find((r) => r.id === reviewId)
      if (review) {
        review.response = response
      }
      if (currentReview.value?.id === reviewId) {
        currentReview.value.response = response
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to respond to review'
      throw e
    }
  }

  async function updateResponse(reviewId: number, content: string): Promise<void> {
    try {
      const response = await reviewsApi.updateResponse(reviewId, content)
      const review = reviews.value.find((r) => r.id === reviewId)
      if (review) {
        review.response = response
      }
      if (currentReview.value?.id === reviewId) {
        currentReview.value.response = response
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to update response'
      throw e
    }
  }

  async function deleteResponse(reviewId: number): Promise<void> {
    try {
      await reviewsApi.deleteResponse(reviewId)
      const review = reviews.value.find((r) => r.id === reviewId)
      if (review) {
        review.response = undefined
      }
      if (currentReview.value?.id === reviewId) {
        currentReview.value.response = undefined
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to delete response'
      throw e
    }
  }

  async function toggleHelpful(reviewId: number): Promise<void> {
    const review = reviews.value.find((r) => r.id === reviewId)
    if (!review) return

    try {
      if (review.is_helpful_by_me) {
        await reviewsApi.unmarkHelpful(reviewId)
        review.helpful_count--
        review.is_helpful_by_me = false
      } else {
        await reviewsApi.markHelpful(reviewId)
        review.helpful_count++
        review.is_helpful_by_me = true
      }
    } catch (e: any) {
      error.value = e.message || 'Failed to toggle helpful'
    }
  }

  async function reportReview(
    reviewId: number,
    reason: string,
    details?: string
  ): Promise<void> {
    try {
      await reviewsApi.reportReview(reviewId, reason, details)
    } catch (e: any) {
      error.value = e.message || 'Failed to report review'
      throw e
    }
  }

  function updateReviewInList(review: Review): void {
    const index = reviews.value.findIndex((r) => r.id === review.id)
    if (index !== -1) {
      reviews.value[index] = review
    }

    const myIndex = myReviews.value.findIndex((r) => r.id === review.id)
    if (myIndex !== -1) {
      myReviews.value[myIndex] = review
    }

    if (currentReview.value?.id === review.id) {
      currentReview.value = review
    }
  }

  function setSortBy(sort: typeof sortBy.value): void {
    sortBy.value = sort
  }

  function setFilterRating(rating: number | null): void {
    filterRating.value = rating
  }

  function $reset(): void {
    reviews.value = []
    myReviews.value = []
    currentReview.value = null
    tutorRating.value = null
    eligibility.value = null
    isLoading.value = false
    error.value = null
    hasMore.value = false
    currentPage.value = 1
    totalCount.value = 0
    sortBy.value = 'recent'
    filterRating.value = null
  }

  // WebSocket handlers
  function handleReviewCreated(review: Review): void {
    if (!reviews.value.find((r) => r.id === review.id)) {
      reviews.value.unshift(review)
      totalCount.value++
    }
  }

  function handleReviewUpdated(review: Review): void {
    updateReviewInList(review)
  }

  function handleReviewDeleted(reviewId: number): void {
    reviews.value = reviews.value.filter((r) => r.id !== reviewId)
    myReviews.value = myReviews.value.filter((r) => r.id !== reviewId)
    totalCount.value = Math.max(0, totalCount.value - 1)
  }

  return {
    // State
    reviews,
    myReviews,
    currentReview,
    tutorRating,
    eligibility,
    isLoading,
    error,
    hasMore,
    currentPage,
    totalCount,
    sortBy,
    filterRating,

    // Computed
    averageRating,
    totalReviews,
    distribution,
    detailedRatings,
    canWriteReview,
    eligibleBookings,

    // Actions
    checkEligibility,
    loadTutorReviews,
    loadMoreReviews,
    loadTutorRating,
    loadMyReviews,
    loadReview,
    createReview,
    updateReview,
    deleteReview,
    respondToReview,
    updateResponse,
    deleteResponse,
    toggleHelpful,
    reportReview,
    setSortBy,
    setFilterRating,
    $reset,

    // WebSocket handlers
    handleReviewCreated,
    handleReviewUpdated,
    handleReviewDeleted,
  }
})
