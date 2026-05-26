<template>
  <div class="student-home" data-testid="student-home-page">
    <!-- Trial banner -->
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
    <div v-else class="student-home__hero-skeleton" aria-hidden="true" />

    <!-- Активні тьютори студента -->
    <StudentActiveTutorsSection
      :active-tutors="activeTutors"
      :loading="isLoadingTutors"
    />

    <!-- Secondary context (last completed lesson hint) -->
    <DashboardSecondaryContext
      v-if="snapshot?.secondary"
      :data="snapshot.secondary"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import DashboardHero from '../components/DashboardHero.vue'
import DashboardSecondaryContext from '../components/DashboardSecondaryContext.vue'
import StudentActiveTutorsSection from '../components/StudentActiveTutorsSection.vue'
import apiClient from '@/utils/apiClient'
import type { DashboardSnapshotV2, AssignedTutor } from '../api/dashboard'
import { resolveCta } from '../utils/fallbackCta'

const TrialBanner = defineAsyncComponent(
  () => import('@/modules/auth/components/TrialBanner.vue'),
)

const auth = useAuthStore()
const snapshot = ref<DashboardSnapshotV2 | null>(null)
const isLoading = ref(true)

const activeTutors = ref<AssignedTutor[]>([])
const isLoadingTutors = ref(false)

// Fix #1: fallback до find_tutor якщо backend повернув null
const heroCta = computed(() => resolveCta(snapshot.value?.primary_cta, 'student'))

async function loadSnapshot() {
  isLoading.value = true
  try {
    const data = await apiClient.get<DashboardSnapshotV2>('/v1/dashboard/student/snapshot/')
    snapshot.value = data
  } catch (err) {
    console.error('[StudentHome] Failed to load snapshot:', err)
  } finally {
    isLoading.value = false
  }
}

async function loadActiveTutors() {
  isLoadingTutors.value = true
  try {
    const data = await apiClient.get<{ activeTutors: AssignedTutor[] }>(
      '/v1/dashboard/student/collaboration/snapshot/'
    )
    activeTutors.value = data.activeTutors ?? []
  } catch (err) {
    console.error('[StudentHome] Failed to load active tutors:', err)
  } finally {
    isLoadingTutors.value = false
  }
}

onMounted(() => {
  loadSnapshot()
  loadActiveTutors()
})
</script>

<style scoped>
.student-home {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg, 16px);
}

.student-home__hero-skeleton {
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
