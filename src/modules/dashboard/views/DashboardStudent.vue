<template>
  <div class="space-y-6">
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
import StudentActiveTutorsSection from '../components/StudentActiveTutorsSection.vue'
import StudentUpcomingLessonsSection from '../components/StudentUpcomingLessonsSection.vue'
import TutorSearchView from '../../tutor/views/TutorSearchView.vue'

const router = useRouter()
const { t } = useI18n()
const dashboardStore = useDashboardStore()

const hasActiveTutors = computed(() => dashboardStore.hasActiveTutors)

function goToMarketplace() {
  router.push('/marketplace').catch(() => {})
}

onMounted(() => {
  dashboardStore.fetchStudentDashboard().catch(() => {})
})
</script>
