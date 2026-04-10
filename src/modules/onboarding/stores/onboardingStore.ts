// F9: Onboarding Store — thin layer over Resource Controller
//
// ІНВАРІАНТ: 1 resource → 1 truth → 1 запит → контрольований lifecycle
// UI ніколи не вирішує коли фетчити — тільки resource layer.
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { createResource } from '@/core/resource'
import { onboardingApi, OnboardingStep, OnboardingProgress } from '../api/onboarding'

export const useOnboardingStore = defineStore('onboarding', () => {
  // ── Resource Controller: progress ─────────────────────────────────────────
  // Єдина контрольна точка для GET /onboarding/progress/
  const progressResource = createResource<OnboardingProgress>({
    key: 'onboarding.progress',
    fetcher: () => onboardingApi.getProgress(),
    ttl: 5 * 60 * 1000, // 5 хв
  })

  // Thin reactive aliases — backward compat для існуючих компонентів
  const progress = computed(() => progressResource.data.value)
  const progressLoaded = computed(() => progressResource.loaded.value)
  const isVisible = ref(false)

  // Steps (простий ресурс, без складної логіки)
  const stepsResource = createResource<OnboardingStep[]>({
    key: 'onboarding.steps',
    fetcher: () => onboardingApi.getSteps(),
    ttl: 10 * 60 * 1000, // 10 хв — steps рідко міняються
  })
  const steps = computed(() => stepsResource.data.value ?? [])

  // ── Computed (derived from progress) ──────────────────────────────────────
  const isLoading = computed(() =>
    progressResource.status.value === 'loading' || stepsResource.status.value === 'loading'
  )
  const error = computed(() => progressResource.error.value ?? stepsResource.error.value ?? null)

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

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Завантажити progress через resource controller */
  async function loadProgress(force = false): Promise<void> {
    await progressResource.load({ force })
  }

  /** Завантажити steps через resource controller */
  async function loadSteps(force = false): Promise<void> {
    await stepsResource.load({ force })
  }

  // Mutation actions — optimistic update via resource.set() + invalidate
  async function completeCurrentStep() {
    if (!currentStep.value) return
    try {
      const result = await onboardingApi.completeStep(currentStep.value.slug)
      progressResource.set(result)
    } catch (e: unknown) {
      console.warn('[onboarding] completeStep failed:', e instanceof Error ? e.message : e)
    }
  }

  async function skipCurrentStep() {
    if (!currentStep.value) return
    try {
      const result = await onboardingApi.skipStep(currentStep.value.slug)
      progressResource.set(result)
    } catch (e: unknown) {
      console.warn('[onboarding] skipStep failed:', e instanceof Error ? e.message : e)
    }
  }

  async function dismiss() {
    try {
      const result = await onboardingApi.dismissOnboarding()
      progressResource.set(result)
      isVisible.value = false
    } catch (e: unknown) {
      console.warn('[onboarding] dismiss failed:', e instanceof Error ? e.message : e)
    }
  }

  async function reset() {
    try {
      const result = await onboardingApi.resetOnboarding()
      progressResource.set(result)
    } catch (e: unknown) {
      console.warn('[onboarding] reset failed:', e instanceof Error ? e.message : e)
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
      progressResource.set({
        ...progress.value,
        current_step: step,
      })
    }
  }

  function $reset() {
    progressResource.reset()
    stepsResource.reset()
    isVisible.value = false
  }

  return {
    // State (reactive aliases)
    progress,
    progressLoaded,
    steps,
    isLoading,
    isVisible,
    error,

    // Resource controllers (для прямого доступу)
    progressResource,
    stepsResource,

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
