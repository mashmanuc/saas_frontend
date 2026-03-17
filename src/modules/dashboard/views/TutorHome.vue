<template>
  <div class="space-y-6">
    <!-- Trial Banner -->
    <TrialBanner
      v-if="auth.hasTrial"
      :days-left="auth.trialDaysLeft"
      :trial-active="auth.hasTrial"
      :dismissible="true"
    />

    <!-- Onboarding Hint (FTUE) -->
    <OnboardingHint
      :hint-id="TutorHintId.DASHBOARD_WELCOME"
      :condition="!isProfilePublished"
      icon="💡"
    >
      <strong>{{ $t('onboarding.hints.dashboard.welcome.title') }}</strong>
      <ol>
        <li>{{ $t('onboarding.hints.dashboard.welcome.step1') }}</li>
        <li>{{ $t('onboarding.hints.dashboard.welcome.step2') }}</li>
        <li>{{ $t('onboarding.hints.dashboard.welcome.step3') }}</li>
      </ol>
      <template #actions>
        <router-link to="/tutor/schedule" class="hint-btn">
          {{ $t('onboarding.hints.dashboard.welcome.openCalendar') }}
        </router-link>
        <router-link to="/tutor/profile" class="hint-btn">
          {{ $t('onboarding.hints.dashboard.welcome.editProfile') }}
        </router-link>
      </template>
    </OnboardingHint>

    <!-- Pre-Phase 4: Demo Student onboarding hint -->
    <OnboardingHint
      :hint-id="TutorHintId.DEMO_STUDENT_ONLY"
      :condition="hasOnlyDemoStudent"
      icon="🎓"
    >
      <strong>{{ $t('student.demoHint') }}</strong>
      <template #actions>
        <router-link to="/tutor/profile" class="hint-btn">
          {{ $t('student.inviteReal') }} →
        </router-link>
      </template>
    </OnboardingHint>

    <!-- Greeting -->
    <DashboardGreeting />

    <!-- Stats Row -->
    <DashboardStatsRow :stats="dashboardStats" />

    <!-- Today's Schedule -->
    <div class="tutor-home__slot tutor-home__slot--schedule">
      <TodaySchedule
        :lessons="todaysLessons"
        :loading="dashboard.isLoadingTutor"
        :is-tutor="true"
      />
    </div>

    <!-- Quick Actions -->
    <QuickActions />

    <!-- Phase 16: Knowledge Stats Widget -->
    <div class="tutor-home__slot tutor-home__slot--stats">
      <KnowledgeStatsWidget />
    </div>

    <!-- New Inquiries Preview -->
    <InquiriesPreview
      :inquiries="pendingInquiries"
      :loading-id="inquiryLoadingId"
      @accept="handleAcceptInquiry"
      @decline="handleDeclineInquiry"
    />

    <!-- Empty Dashboard State (new tutor) -->
    <DashboardEmptyState
      v-if="showEmptyState"
      :title="$t('dashboard.tutor.emptyState.title')"
      :description="$t('dashboard.tutor.emptyState.description')"
      :cta-label="$t('dashboard.tutor.emptyState.cta')"
      cta-to="/tutor/profile"
      icon="users"
    />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, onMounted, ref } from 'vue'
import { useAuthStore } from '@/modules/auth/store/authStore'
import { useDashboardStore } from '../store/dashboardStore'
import { useRelationsStore } from '@/stores/relationsStore'
import DashboardGreeting from '../components/DashboardGreeting.vue'
import DashboardStatsRow from '../components/DashboardStatsRow.vue'
import QuickActions from '../components/QuickActions.vue'
import OnboardingHint from '@/components/OnboardingHint.vue'

// BUG-13 fix: lazy load heavy below-the-fold components to reduce initial bundle
const TodaySchedule = defineAsyncComponent(() => import('../components/TodaySchedule.vue'))
const InquiriesPreview = defineAsyncComponent(() => import('../components/InquiriesPreview.vue'))
const DashboardEmptyState = defineAsyncComponent(() => import('../components/DashboardEmptyState.vue'))
const TrialBanner = defineAsyncComponent(() => import('@/modules/auth/components/TrialBanner.vue'))
import { TutorHintId } from '@/composables/useOnboardingHints'
// BUG-10 fix: async import with error boundary to prevent dashboard crash
const KnowledgeStatsWidget = defineAsyncComponent({
  loader: () => import('@/modules/knowledge/components/KnowledgeStatsWidget.vue'),
  errorComponent: { render: () => null },
})
import { notifySuccess, notifyError } from '@/utils/notify'
import apiClient from '@/utils/apiClient'

const auth = useAuthStore()
const dashboard = useDashboardStore()
const relationsStore = useRelationsStore()

const isProfilePublished = ref(false)
const inquiryLoadingId = ref(null)

const todaysLessons = computed(() => dashboard.todaysLessons ?? [])

const pendingInquiries = computed(() => {
  const rels = relationsStore.tutorRelations ?? []
  return rels
    .filter(r => r.status === 'invited' && !r.student?.is_demo)
    .map(r => ({
      id: r.id ?? r.relation_id ?? r.student?.id,
      student_name: r.student?.display_name || r.student?.full_name || r.student?.first_name || '—',
      subject: r.subject || undefined,
      status: r.status,
    }))
})

// Pre-Phase 4: Demo Student onboarding hint condition
const hasOnlyDemoStudent = computed(() => {
  const rels = relationsStore.tutorRelations
  if (!rels || !rels.length) return false
  return rels.every(r => r.student?.is_demo)
})

const dashboardStats = computed(() => [
  {
    key: 'lessonsToday',
    icon: 'calendar',
    label: 'dashboard.stats.lessonsToday',
    value: todaysLessons.value.length,
    to: '/tutor/schedule',
  },
  {
    key: 'activeStudents',
    icon: 'users',
    label: 'dashboard.stats.activeStudents',
    value: relationsStore.tutorRelations?.filter(r => r.status === 'active')?.length ?? 0,
  },
  {
    key: 'pendingInquiries',
    icon: 'inbox',
    label: 'dashboard.stats.pendingInquiries',
    value: relationsStore.tutorRelations?.filter(r => r.status === 'invited')?.length ?? 0,
    to: '/tutor/inquiries',
  },
  {
    key: 'balance',
    icon: 'wallet',
    label: 'dashboard.stats.balance',
    value: '—',
  },
])

const showEmptyState = computed(() => {
  return !dashboard.isLoadingTutor
    && !todaysLessons.value.length
    && !(relationsStore.tutorRelations?.length > 0)
})

async function handleAcceptInquiry(id) {
  inquiryLoadingId.value = id
  try {
    await relationsStore.acceptRelation(id)
    notifySuccess('Запит прийнято')
  } catch (error) {
    notifyError(error?.response?.data?.detail || 'Помилка')
  } finally {
    inquiryLoadingId.value = null
  }
}

async function handleDeclineInquiry(id) {
  inquiryLoadingId.value = id
  try {
    await relationsStore.declineRelation(id)
    notifySuccess('Запит відхилено')
  } catch (error) {
    notifyError(error?.response?.data?.detail || 'Помилка')
  } finally {
    inquiryLoadingId.value = null
  }
}

onMounted(async () => {
  dashboard.fetchTutorDashboard().catch(() => {})
  relationsStore.fetchTutorRelations().catch(() => {})

  try {
    const me = await apiClient.get('/v1/marketplace/me/', { meta: { skipLoader: true } })
    isProfilePublished.value = !!me?.is_published
  } catch {
    // Silent — banner is non-critical
  }
})
</script>

<style scoped>
.hint-btn {
  display: inline-block;
  padding: var(--space-2xs, 4px) var(--space-sm, 8px);
  border-radius: var(--radius-sm, 4px);
  background: var(--accent);
  color: #fff;
  text-decoration: none;
  font-size: var(--text-sm, 0.875rem);
  font-weight: 500;
  transition: opacity 0.15s;
}

.hint-btn:hover {
  opacity: 0.85;
}

/* BUG-17 fix: reserve min-height for async-loaded sections to prevent CLS */
.tutor-home__slot--schedule {
  min-height: 120px;
}
.tutor-home__slot--stats {
  min-height: 96px;
}
</style>
