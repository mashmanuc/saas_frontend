<script setup lang="ts">
// F11: Onboarding View
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useOnboardingStore } from '../stores/onboardingStore'
import OnboardingProgress from '../components/progress/OnboardingProgress.vue'
import WelcomeStep from '../components/steps/WelcomeStep.vue'
import ProfileStep from '../components/steps/ProfileStep.vue'
import PreferencesStep from '../components/steps/PreferencesStep.vue'
import FirstActionStep from '../components/steps/FirstActionStep.vue'
import CompletionStep from '../components/steps/CompletionStep.vue'
import Button from '@/ui/Button.vue'

const router = useRouter()
const { t } = useI18n()
const store = useOnboardingStore()

const {
  steps,
  currentStep,
  currentStepIndex,
  progressPercentage,
  nextStep,
  prevStep,
  isLoading,
  isCompleted,
} = storeToRefs(store)

onMounted(async () => {
  await store.loadProgress()
  await store.loadSteps()
})

const currentStepComponent = computed(() => {
  if (!currentStep.value) return WelcomeStep

  const componentMap: Record<string, any> = {
    welcome: WelcomeStep,
    profile: ProfileStep,
    preferences: PreferencesStep,
    'first-action': FirstActionStep,
    completion: CompletionStep,
  }

  return componentMap[currentStep.value.slug] || WelcomeStep
})

async function handleComplete() {
  await store.completeCurrentStep()

  if (isCompleted.value) {
    router.push('/dashboard')
  }
}

async function handleSkip() {
  await store.skipCurrentStep()
}

function goBack() {
  if (prevStep.value) {
    store.goToStep(prevStep.value.slug)
  }
}

async function handleDismiss() {
  await store.dismiss()
  router.push('/dashboard')
}
</script>

<template>
  <div class="onboarding-view">
    <OnboardingProgress
      :steps="steps"
      :current-index="currentStepIndex"
      :percentage="progressPercentage"
    />

    <div class="onboarding-content">
      <Transition name="slide" mode="out-in">
        <component
          :is="currentStepComponent"
          :key="currentStep?.slug || 'welcome'"
          :step="currentStep"
          @complete="handleComplete"
          @skip="handleSkip"
        />
      </Transition>
    </div>

    <div class="onboarding-actions">
      <Button v-if="prevStep" variant="ghost" @click="goBack">
        {{ t('common.back') }}
      </Button>

      <div class="actions-right">
        <Button
          v-if="currentStep?.is_skippable"
          variant="outline"
          :disabled="isLoading"
          @click="handleSkip"
        >
          {{ t('onboarding.skip') }}
        </Button>

        <Button
          variant="primary"
          :disabled="isLoading"
          :loading="isLoading"
          @click="handleComplete"
        >
          {{ nextStep ? t('common.next') : t('onboarding.finish') }}
        </Button>
      </div>
    </div>

    <button class="dismiss-link" @click="handleDismiss">
      {{ t('onboarding.dismissForNow') }}
    </button>
  </div>
</template>

<style scoped>
.onboarding-view {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  padding: 24px;
  background: var(--color-bg-secondary, #f5f5f5);
}

.onboarding-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48px 0;
}

.onboarding-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 600px;
  margin: 0 auto;
  width: 100%;
}

.actions-right {
  display: flex;
  gap: 12px;
}

.dismiss-link {
  display: block;
  margin: 24px auto 0;
  padding: 0;
  background: none;
  border: none;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
  cursor: pointer;
}

.dismiss-link:hover {
  text-decoration: underline;
}

/* Transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
