<template>
  <div class="space-y-6" data-testid="student-home-page">
    <!-- Trial Banner -->
    <TrialBanner
      v-if="auth.hasTrial"
      :days-left="auth.trialDaysLeft"
      :trial-active="auth.hasTrial"
      :dismissible="true"
    />

    <!-- Greeting -->
    <DashboardGreeting />

    <!-- Stats Row -->
    <DashboardStatsRow :stats="dashboardStats" />

    <!-- Upcoming Lessons -->
    <TodaySchedule
      :lessons="upcomingLessons"
      :loading="dashboard.isLoadingStudent"
      :is-tutor="false"
    />

    <!-- Quick Actions -->
    <StudentQuickActions />

    <!-- Active Tutors -->
    <StudentActiveTutorsSection
      :active-tutors="dashboard.activeTutors"
      :loading="dashboard.isLoading"
      :error="dashboard.error"
    />

    <!-- Empty Dashboard State -->
    <DashboardEmptyState
      v-if="showEmptyState"
      :title="$t('dashboard.student.emptyState.title')"
      :description="$t('dashboard.student.emptyState.description')"
      :cta-label="$t('dashboard.student.emptyState.cta')"
      cta-to="/marketplace"
      icon="search"
    />
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useDashboardStore } from '../store/dashboardStore'
import { useRelationsStore } from '@/stores/relationsStore'
import DashboardGreeting from '../components/DashboardGreeting.vue'
import DashboardStatsRow from '../components/DashboardStatsRow.vue'
import TodaySchedule from '../components/TodaySchedule.vue'
import StudentQuickActions from '../components/StudentQuickActions.vue'
import StudentActiveTutorsSection from '../components/StudentActiveTutorsSection.vue'
import DashboardEmptyState from '../components/DashboardEmptyState.vue'
import TrialBanner from '@/modules/auth/components/TrialBanner.vue'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const relationsStore = useRelationsStore()

const upcomingLessons = computed(() => dashboard.upcomingLessons ?? [])

const dashboardStats = computed(() => [
  {
    key: 'upcomingLessons',
    icon: 'calendar',
    label: 'dashboard.stats.upcomingLessons',
    value: upcomingLessons.value.length,
    to: '/student/schedule',
  },
  {
    key: 'activeTutors',
    icon: 'users',
    label: 'dashboard.stats.activeTutors',
    value: dashboard.activeTutors?.length ?? 0,
  },
  {
    key: 'totalLessons',
    icon: 'book-open',
    label: 'dashboard.stats.totalLessons',
    value: dashboard.studentStats?.total_lessons ?? 0,
  },
  {
    key: 'totalHours',
    icon: 'clock',
    label: 'dashboard.stats.totalHours',
    value: dashboard.studentStats?.total_hours ?? 0,
  },
])

const showEmptyState = computed(() => {
  return !dashboard.isLoadingStudent
    && !upcomingLessons.value.length
    && !dashboard.activeTutors?.length
})

onMounted(() => {
  dashboard.fetchStudentDashboard().catch(() => {})
  relationsStore.fetchStudentRelations().catch(() => {})
})
</script>
