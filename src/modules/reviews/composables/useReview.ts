// F21: useReview composable
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReviewStore } from '../stores/reviewStore'
import type { ReviewInput } from '../api/reviews'

export function useReview(reviewId?: number) {
  const store = useReviewStore()
  const router = useRouter()

  const review = computed(() =>
    reviewId
      ? store.reviews.find((r) => r.id === reviewId) ||
        store.myReviews.find((r) => r.id === reviewId) ||
        store.currentReview
      : null
  )

  const isLoading = computed(() => store.isLoading)
  const error = computed(() => store.error)

  // Can edit within 24 hours and not rejected
  const canEdit = computed(() => {
    if (!review.value) return false
    if (review.value.status === 'rejected') return false

    const created = new Date(review.value.created_at)
    const now = new Date()
    const hoursDiff = (now.getTime() - created.getTime()) / (1000 * 60 * 60)
    return hoursDiff <= 24
  })

  // Can delete same as edit
  const canDelete = computed(() => canEdit.value)

  // Has tutor response
  const hasResponse = computed(() => !!review.value?.response)

  // Time since created
  const timeSinceCreated = computed(() => {
    if (!review.value) return null

    const created = new Date(review.value.created_at)
    const now = new Date()
    const diffMs = now.getTime() - created.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffHours / 24)

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    }
    if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    }
    return 'Just now'
  })

  // Actions
  async function submitReview(data: ReviewInput) {
    const review = await store.createReview(data)
    router.push(`/tutors/${data.tutor_id}`)
    return review
  }

  async function editReview(data: Partial<ReviewInput>) {
    if (!reviewId) return
    return store.updateReview(reviewId, data)
  }

  async function removeReview() {
    if (!reviewId) return
    await store.deleteReview(reviewId)
    router.back()
  }

  async function toggleHelpful() {
    if (!reviewId) return
    await store.toggleHelpful(reviewId)
  }

  async function reportReview(reason: string, details?: string) {
    if (!reviewId) return
    await store.reportReview(reviewId, reason, details)
  }

  // Load review on mount if ID provided
  onMounted(() => {
    if (reviewId && !review.value) {
      store.loadReview(reviewId)
    }
  })

  return {
    // State
    review,
    isLoading,
    error,

    // Computed
    canEdit,
    canDelete,
    hasResponse,
    timeSinceCreated,

    // Actions
    submitReview,
    editReview,
    removeReview,
    toggleHelpful,
    reportReview,
  }
}
