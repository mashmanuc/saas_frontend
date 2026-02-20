<script setup lang="ts">
// F13: Tutor Onboarding View
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useOnboardingStore } from '../stores/onboardingStore'
import OnboardingProgress from '../components/progress/OnboardingProgress.vue'
import OnboardingStep from '../components/steps/OnboardingStep.vue'
import Button from '@/ui/Button.vue'

const router = useRouter()
const { t } = useI18n()
const store = useOnboardingStore()

const { steps, currentStep, currentStepIndex, progressPercentage, isLoading } = storeToRefs(store)

// Form data for tutor onboarding
const formData = ref({
  headline: '',
  bio: '',
  photo: null as File | null,
  subjects: [] as { id: number; price: number }[],
  availability: {} as Record<string, string[]>,
})

onMounted(async () => {
  await store.loadProgress()
  await store.loadSteps()
})

async function handleNext() {
  await store.completeCurrentStep()
  if (store.isCompleted) {
    router.push('/tutor/dashboard')
  }
}

async function handleSkip() {
  await store.skipCurrentStep()
}

function goToVerification() {
  router.push('/verification')
}

function goToAvailability() {
  router.push('/tutor/availability')
}
</script>

<template>
  <div class="tutor-onboarding">
    <OnboardingProgress
      :steps="steps"
      :current-index="currentStepIndex"
      :percentage="progressPercentage"
    />

    <div class="onboarding-content">
      <!-- Welcome Step -->
      <OnboardingStep
        v-if="currentStep?.slug === 'welcome'"
        :step="currentStep"
      >
        <div class="welcome-content">
          <h1>{{ t('onboarding.tutor.welcome.greeting') }}</h1>
          <p>{{ t('onboarding.tutor.welcome.intro') }}</p>
          <ul class="benefits-list">
            <li>{{ t('onboarding.tutor.welcome.benefit1') }}</li>
            <li>{{ t('onboarding.tutor.welcome.benefit2') }}</li>
            <li>{{ t('onboarding.tutor.welcome.benefit3') }}</li>
          </ul>
        </div>
      </OnboardingStep>

      <!-- Profile Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'profile'"
        :step="currentStep"
      >
        <div class="profile-form">
          <div class="form-group">
            <label>{{ t('onboarding.tutor.profile.headline') }}</label>
            <input
              v-model="formData.headline"
              type="text"
              :placeholder="t('onboarding.tutor.profile.headlinePlaceholder')"
            />
          </div>
          <div class="form-group">
            <label>{{ t('onboarding.tutor.profile.bio') }}</label>
            <textarea
              v-model="formData.bio"
              rows="4"
              :placeholder="t('onboarding.tutor.profile.bioPlaceholder')"
            />
          </div>
          <div class="form-group">
            <label>{{ t('onboarding.tutor.profile.photo') }}</label>
            <input type="file" accept="image/*" />
          </div>
        </div>
      </OnboardingStep>

      <!-- Subjects & Pricing Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'subjects'"
        :step="currentStep"
      >
        <div class="subjects-form">
          <p>{{ t('onboarding.tutor.subjects.description') }}</p>
          <div class="subject-list">
            <div class="subject-item">
              <select>
                <option value="">{{ t('onboarding.tutor.subjects.select') }}</option>
                <option value="math">Mathematics</option>
                <option value="english">English</option>
                <option value="physics">Physics</option>
              </select>
              <input type="number" :placeholder="t('onboarding.tutor.subjects.price')" />
            </div>
          </div>
          <Button variant="outline" size="sm">
            + {{ t('onboarding.tutor.subjects.addMore') }}
          </Button>
        </div>
      </OnboardingStep>

      <!-- Availability Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'availability'"
        :step="currentStep"
      >
        <div class="availability-step">
          <p>{{ t('onboarding.tutor.availability.description') }}</p>
          <Button variant="primary" @click="goToAvailability">
            {{ t('onboarding.tutor.availability.setup') }}
          </Button>
        </div>
      </OnboardingStep>

      <!-- Verification Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'verification'"
        :step="currentStep"
      >
        <div class="verification-step">
          <p>{{ t('onboarding.tutor.verification.description') }}</p>
          <Button variant="primary" @click="goToVerification">
            {{ t('onboarding.tutor.verification.start') }}
          </Button>
        </div>
      </OnboardingStep>

      <!-- Completion Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'completion'"
        :step="currentStep"
      >
        <div class="completion-content">
          <div class="celebration">🎉</div>
          <h2>{{ t('onboarding.tutor.completion.congrats') }}</h2>
          <p>{{ t('onboarding.tutor.completion.message') }}</p>
        </div>
      </OnboardingStep>
    </div>

    <div class="onboarding-actions">
      <Button
        v-if="currentStep?.is_skippable"
        variant="outline"
        @click="handleSkip"
      >
        {{ t('onboarding.skip') }}
      </Button>
      <Button variant="primary" :disabled="isLoading" :loading="isLoading" @click="handleNext">
        {{ t('common.next') }}
      </Button>
    </div>
  </div>
</template>

<style scoped>
.tutor-onboarding {
  min-height: 100vh;
  padding: 24px;
  background: var(--color-bg-secondary, #f5f5f5);
}

.onboarding-content {
  max-width: 600px;
  margin: 48px auto;
}

.welcome-content,
.completion-content {
  text-align: center;
}

.welcome-content h1 {
  font-size: 32px;
  margin-bottom: 16px;
}

.benefits-list {
  text-align: left;
  margin-top: 24px;
  padding-left: 24px;
}

.benefits-list li {
  margin-bottom: 8px;
}

.celebration {
  font-size: 64px;
  margin-bottom: 24px;
}

.profile-form,
.subjects-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
}

.form-group input,
.form-group select,
.form-group textarea {
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
}

.subject-item {
  display: flex;
  gap: 12px;
}

.subject-item select {
  flex: 2;
}

.subject-item input {
  flex: 1;
}

.availability-step,
.verification-step {
  text-align: center;
  padding: 32px 0;
}

.availability-step p,
.verification-step p {
  margin-bottom: 24px;
}

.onboarding-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}

</style>
