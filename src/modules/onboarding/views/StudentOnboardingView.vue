<script setup lang="ts">
// F12: Student Onboarding View
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { useOnboardingStore } from '../stores/onboardingStore'
import OnboardingProgress from '../components/progress/OnboardingProgress.vue'
import OnboardingStep from '../components/steps/OnboardingStep.vue'

const router = useRouter()
const { t } = useI18n()
const store = useOnboardingStore()

const { steps, currentStep, currentStepIndex, progressPercentage, isLoading } = storeToRefs(store)

// Form data for student onboarding
const formData = ref({
  displayName: '',
  avatar: null as File | null,
  subjects: [] as string[],
  preferredSchedule: '',
  learningGoals: '',
})

const studentSteps = [
  {
    slug: 'welcome',
    title: t('onboarding.student.welcome.title'),
    description: t('onboarding.student.welcome.description'),
    icon: 'Sparkles',
  },
  {
    slug: 'profile',
    title: t('onboarding.student.profile.title'),
    description: t('onboarding.student.profile.description'),
    icon: 'User',
  },
  {
    slug: 'preferences',
    title: t('onboarding.student.preferences.title'),
    description: t('onboarding.student.preferences.description'),
    icon: 'Settings',
  },
  {
    slug: 'first-tutor',
    title: t('onboarding.student.firstTutor.title'),
    description: t('onboarding.student.firstTutor.description'),
    icon: 'Search',
  },
  {
    slug: 'completion',
    title: t('onboarding.student.completion.title'),
    description: t('onboarding.student.completion.description'),
    icon: 'CheckCircle',
  },
]

onMounted(async () => {
  await store.loadProgress()
  await store.loadSteps()
})

async function handleNext() {
  await store.completeCurrentStep()
  if (store.isCompleted) {
    router.push('/dashboard')
  }
}

async function handleSkip() {
  await store.skipCurrentStep()
}

function goToFindTutor() {
  router.push('/tutors')
}
</script>

<template>
  <div class="student-onboarding">
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
          <h1>{{ t('onboarding.student.welcome.greeting') }}</h1>
          <p>{{ t('onboarding.student.welcome.intro') }}</p>
        </div>
      </OnboardingStep>

      <!-- Profile Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'profile'"
        :step="currentStep"
      >
        <div class="profile-form">
          <div class="form-group">
            <label>{{ t('onboarding.student.profile.name') }}</label>
            <input v-model="formData.displayName" type="text" />
          </div>
          <div class="form-group">
            <label>{{ t('onboarding.student.profile.avatar') }}</label>
            <input type="file" accept="image/*" />
          </div>
        </div>
      </OnboardingStep>

      <!-- Preferences Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'preferences'"
        :step="currentStep"
      >
        <div class="preferences-form">
          <div class="form-group">
            <label>{{ t('onboarding.student.preferences.subjects') }}</label>
            <select multiple v-model="formData.subjects">
              <option value="math">Math</option>
              <option value="english">English</option>
              <option value="physics">Physics</option>
            </select>
          </div>
          <div class="form-group">
            <label>{{ t('onboarding.student.preferences.schedule') }}</label>
            <select v-model="formData.preferredSchedule">
              <option value="morning">Morning</option>
              <option value="afternoon">Afternoon</option>
              <option value="evening">Evening</option>
            </select>
          </div>
        </div>
      </OnboardingStep>

      <!-- First Tutor Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'first-tutor'"
        :step="currentStep"
      >
        <div class="first-action">
          <button class="btn btn-primary btn-lg" @click="goToFindTutor">
            {{ t('onboarding.student.firstTutor.cta') }}
          </button>
        </div>
      </OnboardingStep>

      <!-- Completion Step -->
      <OnboardingStep
        v-else-if="currentStep?.slug === 'completion'"
        :step="currentStep"
      >
        <div class="completion-content">
          <div class="celebration">🎉</div>
          <h2>{{ t('onboarding.student.completion.congrats') }}</h2>
          <p>{{ t('onboarding.student.completion.message') }}</p>
        </div>
      </OnboardingStep>
    </div>

    <div class="onboarding-actions">
      <button
        v-if="currentStep?.is_skippable"
        class="btn btn-outline"
        @click="handleSkip"
      >
        {{ t('onboarding.skip') }}
      </button>
      <button class="btn btn-primary" @click="handleNext" :disabled="isLoading">
        {{ t('common.next') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.student-onboarding {
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

.celebration {
  font-size: 64px;
  margin-bottom: 24px;
}

.profile-form,
.preferences-form {
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
.form-group select {
  padding: 12px;
  border: 1px solid var(--color-border, #d1d5db);
  border-radius: 8px;
  font-size: 14px;
}

.first-action {
  text-align: center;
  padding: 48px 0;
}

.onboarding-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 32px;
}

.btn {
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary {
  background: var(--color-primary, #3b82f6);
  border: none;
  color: white;
}

.btn-outline {
  background: transparent;
  border: 1px solid var(--color-border, #d1d5db);
  color: var(--color-text-primary, #111827);
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
}
</style>
