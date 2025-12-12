// F22: useRating composable
import { computed, onMounted, watch } from 'vue'
import { useReviewStore } from '../stores/reviewStore'

export function useRating(tutorId: number) {
  const store = useReviewStore()

  const rating = computed(() => store.tutorRating)
  const average = computed(() => store.averageRating)
  const total = computed(() => store.totalReviews)
  const isLoading = computed(() => store.isLoading)

  const distribution = computed(
    () => rating.value?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  )

  const detailed = computed(() => rating.value?.detailed || null)

  const responseRate = computed(() => rating.value?.response_rate || 0)

  // Percentage distribution for charts
  const distributionPercentages = computed(() => {
    const result: Record<number, number> = {}
    const totalReviews = total.value || 1

    for (let i = 1; i <= 5; i++) {
      result[i] = ((distribution.value[i] || 0) / totalReviews) * 100
    }

    return result
  })

  // Rating tier (excellent, good, average, poor)
  const ratingTier = computed(() => {
    const avg = average.value
    if (avg >= 4.5) return 'excellent'
    if (avg >= 4.0) return 'good'
    if (avg >= 3.0) return 'average'
    if (avg > 0) return 'poor'
    return 'none'
  })

  // Human-readable rating label
  const ratingLabel = computed(() => {
    switch (ratingTier.value) {
      case 'excellent':
        return 'Excellent'
      case 'good':
        return 'Very Good'
      case 'average':
        return 'Average'
      case 'poor':
        return 'Below Average'
      default:
        return 'No Reviews'
    }
  })

  // Load rating on mount
  onMounted(() => {
    if (tutorId) {
      store.loadTutorRating(tutorId)
    }
  })

  // Reload if tutorId changes
  watch(
    () => tutorId,
    (newId) => {
      if (newId) {
        store.loadTutorRating(newId)
      }
    }
  )

  return {
    // State
    rating,
    average,
    total,
    isLoading,

    // Computed
    distribution,
    distributionPercentages,
    detailed,
    responseRate,
    ratingTier,
    ratingLabel,
  }
}
