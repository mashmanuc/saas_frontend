import { computed, ref } from 'vue'
import { useOnboardingStore } from '@/modules/onboarding/stores/onboardingStore'

export interface ChecklistProgress {
  completed: number
  total: number
  percentage: number
  isComplete: boolean
  isDismissed: boolean
  currentStep: unknown
}

/**
 * Composable for checklist widget on dashboard.
 * Shows onboarding completion progress.
 * Reads reactive state from onboardingStore — does NOT define new API calls.
 *
 * Ref: UX_PRODUCT_VISION.md §R2.6
 */
export function useChecklistWidget() {
  const onboardingStore = useOnboardingStore()
  const isLoading = ref(false)

  const progress = computed<ChecklistProgress | null>(() => {
    const p = onboardingStore.progress
    if (!p) return null

    const completed = onboardingStore.completedCount
    const total = onboardingStore.totalSteps
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0

    return {
      completed,
      total,
      percentage,
      isComplete: onboardingStore.isCompleted,
      isDismissed: onboardingStore.isDismissed,
      currentStep: onboardingStore.currentStep,
    }
  })

  const shouldShow = computed(() => {
    const p = progress.value
    if (!p) return false
    return !p.isComplete && !p.isDismissed && p.total > 0
  })

  async function loadProgress() {
    isLoading.value = true
    try {
      await onboardingStore.loadProgress()
    } finally {
      isLoading.value = false
    }
  }

  return {
    progress,
    shouldShow,
    isLoading,
    loadProgress,
  }
}
