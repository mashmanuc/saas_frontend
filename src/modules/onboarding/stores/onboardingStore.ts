// F9: Onboarding Store
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { onboardingApi, OnboardingStep, OnboardingProgress } from '../api/onboarding'

export const useOnboardingStore = defineStore('onboarding', () => {
  // State
  const progress = ref<OnboardingProgress | null>(null)
  const steps = ref<OnboardingStep[]>([])
  const isLoading = ref(false)
  const isVisible = ref(false)
  const error = ref<string | null>(null)

  // Computed
  const currentStep = computed(() => progress.value?.current_step)

  const currentStepIndex = computed(() => {
    if (!currentStep.value) return -1
    return steps.value.findIndex((s) => s.slug === currentStep.value?.slug)
  })

  const completedSteps = computed(() => progress.value?.completed_steps || [])
  const skippedSteps = computed(() => progress.value?.skipped_steps || [])
  const progressPercentage = computed(() => progress.value?.progress_percentage || 0)

  const isCompleted = computed(() => progress.value?.is_completed || false)
  const isDismissed = computed(() => progress.value?.is_dismissed || false)

  const onboardingType = computed(() => progress.value?.onboarding_type || 'student')

  const shouldShowOnboarding = computed(
    () => !isCompleted.value && !isDismissed.value && progress.value !== null
  )

  const nextStep = computed(() => {
    if (!currentStep.value) return steps.value[0] || null
    const idx = currentStepIndex.value
    return steps.value[idx + 1] || null
  })

  const prevStep = computed(() => {
    const idx = currentStepIndex.value
    return idx > 0 ? steps.value[idx - 1] : null
  })

  const totalSteps = computed(() => steps.value.length)
  const completedCount = computed(() => completedSteps.value.length)

  // Actions
  async function loadProgress() {
    isLoading.value = true
    error.value = null
    try {
      progress.value = await onboardingApi.getProgress()
    } catch (e: any) {
      error.value = e.message || 'Failed to load progress'
    } finally {
      isLoading.value = false
    }
  }

  async function loadSteps() {
    try {
      steps.value = await onboardingApi.getSteps()
    } catch (e: any) {
      error.value = e.message || 'Failed to load steps'
    }
  }

  async function completeCurrentStep() {
    if (!currentStep.value) return
    isLoading.value = true
    try {
      progress.value = await onboardingApi.completeStep(currentStep.value.slug)
    } catch (e: any) {
      error.value = e.message || 'Failed to complete step'
    } finally {
      isLoading.value = false
    }
  }

  async function skipCurrentStep() {
    if (!currentStep.value) return
    isLoading.value = true
    try {
      progress.value = await onboardingApi.skipStep(currentStep.value.slug)
    } catch (e: any) {
      error.value = e.message || 'Failed to skip step'
    } finally {
      isLoading.value = false
    }
  }

  async function dismiss() {
    isLoading.value = true
    try {
      progress.value = await onboardingApi.dismissOnboarding()
      isVisible.value = false
    } catch (e: any) {
      error.value = e.message || 'Failed to dismiss'
    } finally {
      isLoading.value = false
    }
  }

  async function reset() {
    isLoading.value = true
    try {
      progress.value = await onboardingApi.resetOnboarding()
    } catch (e: any) {
      error.value = e.message || 'Failed to reset'
    } finally {
      isLoading.value = false
    }
  }

  function show() {
    isVisible.value = true
  }

  function hide() {
    isVisible.value = false
  }

  function goToStep(stepSlug: string) {
    const step = steps.value.find((s) => s.slug === stepSlug)
    if (step && progress.value) {
      progress.value.current_step = step
    }
  }

  function $reset() {
    progress.value = null
    steps.value = []
    isLoading.value = false
    isVisible.value = false
    error.value = null
  }

  return {
    // State
    progress,
    steps,
    isLoading,
    isVisible,
    error,

    // Computed
    currentStep,
    currentStepIndex,
    completedSteps,
    skippedSteps,
    progressPercentage,
    isCompleted,
    isDismissed,
    onboardingType,
    shouldShowOnboarding,
    nextStep,
    prevStep,
    totalSteps,
    completedCount,

    // Actions
    loadProgress,
    loadSteps,
    completeCurrentStep,
    skipCurrentStep,
    dismiss,
    reset,
    show,
    hide,
    goToStep,
    $reset,
  }
})
