<template>
  <div class="tutor-home">
    <!-- Trial banner (fallback banner layer) -->
    <TrialBanner
      v-if="auth?.hasTrial"
      :days-left="auth?.trialDaysLeft ?? 0"
      :trial-active="auth?.hasTrial ?? false"
      :dismissible="true"
    />

    <!-- M4 Activation — TutorActivationCard (Intent question → Start card) -->
    <TutorActivationCard :has-lesson="hasLesson" />

    <!-- M4 Activation — Journey milestones panel -->
    <TutorJourneyPanel
      :state="activationState"
      :draft-lessons-count="draftLessonsCount"
    />

    <!-- Phase 29 (Activation) — Hero CTA (з fallback, Fix #1) -->
    <DashboardHero
      v-if="!isLoading"
      :cta="heroCta"
    />
    <div v-else class="tutor-home__hero-skeleton" aria-hidden="true" />

    <!-- Secondary context (rows, no CTA) -->
    <DashboardSecondaryContext
      v-if="snapshot?.secondary"
      :data="snapshot.secondary"
    />

    <!-- Onboarding hint (профіль не опубліковано) -->
    <OnboardingHint
      v-if="snapshot && snapshot.banners?.profile_published === false"
      :hint-id="TutorHintId.DASHBOARD_WELCOME"
      :condition="true"
      icon="💡"
    >
      <strong>{{ $t('onboarding.hints.dashboard.welcome.title') }}</strong>
      <template #actions>
        <router-link to="/tutor/profile" class="hint-btn">
          {{ $t('onboarding.hints.dashboard.welcome.editProfile') }}
        </router-link>
      </template>
    </OnboardingHint>

    <!-- Sprint 2: trial offer modal — показуємо тільки якщо вже був завершений урок -->
    <TrialActivationModal
      v-model="trial.modalOpen.value"
      :trigger="trial.trigger.value"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import DashboardHero from '../components/DashboardHero.vue'
import DashboardSecondaryContext from '../components/DashboardSecondaryContext.vue'
import OnboardingHint from '@/components/OnboardingHint.vue'
import { TutorHintId } from '@/composables/useOnboardingHints'
import apiClient from '@/utils/apiClient'
import type { DashboardSnapshotV2 } from '../api/dashboard'
import { resolveCta } from '../utils/fallbackCta'
// Sprint 2: trial-offer trigger (composable + lazy modal).
import { useTrialActivation } from '@/modules/billing/composables/useTrialActivation'
// M4 Activation
import TutorActivationCard from '@/modules/activation/components/TutorActivationCard.vue'
import TutorJourneyPanel from '@/modules/activation/components/TutorJourneyPanel.vue'
import { useActivation } from '@/modules/activation/composables/useActivation'

const TrialBanner = defineAsyncComponent(
  () => import('@/modules/auth/components/TrialBanner.vue'),
)
const TrialActivationModal = defineAsyncComponent(
  () => import('@/modules/billing/components/TrialActivationModal.vue'),
)

const auth = useAuthStore()
const snapshot = ref<DashboardSnapshotV2 | null>(null)
const isLoading = ref(true)

// M4 Activation
const { state: activationState } = useActivation()
const hasLesson = computed(() => (snapshot.value?.secondary?.draft_lessons?.length ?? 0) > 0)
const draftLessonsCount = computed(() => snapshot.value?.secondary?.draft_lessons?.length ?? 0)

// Сигнал first-lesson: snapshot.secondary.last_completed_lesson != null.
// localStorage flag + backend eligibility-probe запобігають повторним показам.
const trial = useTrialActivation()

// Fix #1: якщо backend повернув null/broken primary_cta — fallback до create_lesson
const heroCta = computed(() => resolveCta(snapshot.value?.primary_cta, 'tutor'))

async function loadSnapshot() {
  isLoading.value = true
  try {
    const data = await apiClient.get<DashboardSnapshotV2>('/v1/dashboard/tutor/snapshot/')
    snapshot.value = data

    // Sprint 2 trial-offer: тільки якщо вже був завершений урок.
    // Не показуємо при signup (snapshot буде, але last_completed_lesson=null).
    if (data?.secondary?.last_completed_lesson) {
      // best-effort, не блокуємо UX — composable сам логує помилки в DEV.
      void trial.maybeOfferTrial({ trigger: 'first_lesson' })
    }
  } catch (err) {
    console.error('[TutorHome] Failed to load snapshot:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadSnapshot()
})
</script>

<style scoped>
.tutor-home {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 16px);
}

.tutor-home__hero-skeleton {
  height: 112px;
  border-radius: var(--radius-lg, 12px);
  background: linear-gradient(
    90deg,
    var(--bg-secondary, #f3f4f6) 0%,
    var(--border-color, #e5e7eb) 50%,
    var(--bg-secondary, #f3f4f6) 100%
  );
  background-size: 200% 100%;
  animation: hero-skeleton-shimmer 1.4s infinite;
}

@keyframes hero-skeleton-shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
