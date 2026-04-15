<template>
  <div class="tutor-home">
    <!-- Trial banner (fallback banner layer) -->
    <TrialBanner
      v-if="auth?.hasTrial"
      :days-left="auth?.trialDaysLeft ?? 0"
      :trial-active="auth?.hasTrial ?? false"
      :dismissible="true"
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

const TrialBanner = defineAsyncComponent(
  () => import('@/modules/auth/components/TrialBanner.vue'),
)

const auth = useAuthStore()
const snapshot = ref<DashboardSnapshotV2 | null>(null)
const isLoading = ref(true)

// Fix #1: якщо backend повернув null/broken primary_cta — fallback до create_lesson
const heroCta = computed(() => resolveCta(snapshot.value?.primary_cta, 'tutor'))

async function loadSnapshot() {
  isLoading.value = true
  try {
    const data = await apiClient.get<DashboardSnapshotV2>('/v1/dashboard/tutor/snapshot/')
    snapshot.value = data
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
