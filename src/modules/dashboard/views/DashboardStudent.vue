<template>
  <div class="space-y-6">
    <TrialBanner
      v-if="auth.hasTrial"
      :days-left="auth.trialDaysLeft"
      :trial-active="auth.hasTrial"
      :dismissible="true"
    />
    
    <Card class="space-y-2">
      <Heading :level="1">
        {{ $t('menu.studentDashboard') }}
      </Heading>
      <p class="text-muted text-sm">
        {{ $t('studentDashboard.subtitle') }}
      </p>
    </Card>

    <StudentActiveTutorsSection
      :active-tutors="dashboardStore.activeTutors"
      :loading="dashboardStore.isLoading"
      :error="dashboardStore.error"
    />

    <StudentUpcomingLessonsSection
      :upcoming-lessons="dashboardStore.upcomingLessons"
      :loading="dashboardStore.isLoading"
      :error="dashboardStore.error"
    />

    <Card class="space-y-4">
      <div class="flex justify-between items-center">
        <Heading :level="2">
          {{ $t('inquiries.student.title') }}
        </Heading>
        <router-link to="/student/inquiries" class="text-sm text-accent hover:underline">
          {{ $t('common.all') }}
        </router-link>
      </div>
      <p class="text-sm text-muted">
        {{ $t('inquiries.student.description') }}
      </p>
    </Card>

    <Card v-if="!hasActiveTutors" class="space-y-4">
      <Heading :level="2">
        {{ $t('studentDashboard.findTutor.title') }}
      </Heading>
      <TutorSearchView />
    </Card>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import { useDashboardStore } from '../store/dashboardStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useRelationsStore } from '../../../stores/relationsStore'
import StudentActiveTutorsSection from '../components/StudentActiveTutorsSection.vue'
import StudentUpcomingLessonsSection from '../components/StudentUpcomingLessonsSection.vue'
import TutorSearchView from '../../tutor/views/TutorSearchView.vue'
import TrialBanner from '../../auth/components/TrialBanner.vue'

const router = useRouter()
const { t } = useI18n()
const dashboardStore = useDashboardStore()
const auth = useAuthStore()
const relationsStore = useRelationsStore()

const hasActiveTutors = computed(() => dashboardStore.hasActiveTutors)

function goToMarketplace() {
  router.push('/marketplace').catch(() => {})
}

onMounted(() => {
  dashboardStore.fetchStudentDashboard().catch(() => {})
  // Phase 1 v0.87.1: Завантажуємо relations для чату
  relationsStore.fetchStudentRelations().catch(() => {})
})
</script>
