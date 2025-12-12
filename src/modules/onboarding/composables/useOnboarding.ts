// F31: useOnboarding Composable
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useOnboardingStore } from '../stores/onboardingStore'
import type { OnboardingStep } from '../api/onboarding'

export function useOnboarding() {
  const router = useRouter()
  const { t } = useI18n()
  const store = useOnboardingStore()

  const {
    progress,
    steps,
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
    isLoading,
    isVisible,
    error,
  } = storeToRefs(store)

  onMounted(async () => {
    await store.loadProgress()
    await store.loadSteps()

    if (store.shouldShowOnboarding) {
      store.show()
    }
  })

  async function completeAndNext() {
    await store.completeCurrentStep()

    if (store.isCompleted) {
      store.hide()
      router.push('/dashboard')
    }
  }

  async function skipAndNext() {
    await store.skipCurrentStep()
  }

  function navigateToStep(step: OnboardingStep) {
    if (step.action_type === 'navigate') {
      router.push(step.action_target)
    }
  }

  function startOnboarding() {
    store.show()
    router.push('/onboarding')
  }

  async function dismissOnboarding() {
    await store.dismiss()
    router.push('/dashboard')
  }

  async function resetOnboarding() {
    await store.reset()
    router.push('/onboarding')
  }

  return {
    // State
    progress,
    steps,
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
    isLoading,
    isVisible,
    error,

    // Actions
    completeAndNext,
    skipAndNext,
    navigateToStep,
    startOnboarding,
    dismissOnboarding,
    resetOnboarding,

    // Store actions
    loadProgress: store.loadProgress,
    loadSteps: store.loadSteps,
    completeCurrentStep: store.completeCurrentStep,
    skipCurrentStep: store.skipCurrentStep,
    dismiss: store.dismiss,
    reset: store.reset,
    show: store.show,
    hide: store.hide,
    goToStep: store.goToStep,
  }
}
