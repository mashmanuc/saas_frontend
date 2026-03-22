<template>
  <div class="space-y-6">
    <TrialBanner
      v-if="auth?.hasTrial"
      :days-left="auth?.trialDaysLeft ?? 0"
      :trial-active="auth?.hasTrial ?? false"
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
      :active-tutors="activeTutors"
      :loading="isLoading"
      :error="error?.message ?? null"
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
  </div>
</template>

<script setup>
import { useI18n } from 'vue-i18n'
import Card from '../../../ui/Card.vue'
import Heading from '../../../ui/Heading.vue'
import { useAuthStore } from '../../auth/store/authStore'
import { useStudentDashboardQuery } from '@/api/queries/useStudentDashboardQuery'
import StudentActiveTutorsSection from '../components/StudentActiveTutorsSection.vue'
import TrialBanner from '../../auth/components/TrialBanner.vue'

const { t } = useI18n()
const auth = useAuthStore()

// Phase 29 B2: Query auto-fetches on mount. Replaces dashboardStore.fetchStudentDashboard()
const { activeTutors, isLoading, error } = useStudentDashboardQuery()
</script>
