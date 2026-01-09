<template>
  <Card class="space-y-4">
    <Heading :level="2">
      {{ $t('studentDashboard.upcomingLessons.title') }}
    </Heading>

    <!-- Loading State -->
    <div v-if="loading" class="text-sm text-muted">
      {{ $t('loader.loading') }}
    </div>

    <!-- Error State -->
    <p v-else-if="error" class="text-sm text-danger">
      {{ error }}
    </p>

    <!-- Empty State -->
    <template v-else-if="!hasLessons">
      <div
        class="rounded-2xl border border-dashed border-default bg-surface-soft p-4 space-y-1"
      >
        <p class="text-sm font-semibold text-body">
          {{ $t('studentDashboard.upcomingLessons.empty.title') }}
        </p>
        <p class="text-sm text-muted">
          {{ $t('studentDashboard.upcomingLessons.empty.description') }}
        </p>
      </div>
      <div class="flex flex-wrap gap-3">
        <Button variant="primary" size="sm" @click="goToBookLesson">
          {{ $t('studentDashboard.actions.bookLesson') }}
        </Button>
      </div>
    </template>

    <!-- Lessons List -->
    <section v-else class="space-y-3">
      <div class="space-y-2">
        <UpcomingLessonCard
          v-for="lesson in upcomingLessons"
          :key="lesson.id"
          :lesson="lesson"
          :is-tutor="false"
        />
      </div>
      
      <router-link 
        to="/bookings" 
        class="inline-flex items-center text-sm text-accent hover:underline"
      >
        {{ $t('studentDashboard.actions.viewAllLessons') }}
        <svg 
          class="ml-1 w-4 h-4" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            stroke-linecap="round" 
            stroke-linejoin="round" 
            stroke-width="2" 
            d="M9 5l7 7-7 7"
          />
        </svg>
      </router-link>
    </section>
  </Card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Button from '@/ui/Button.vue'
import Card from '@/ui/Card.vue'
import Heading from '@/ui/Heading.vue'
import UpcomingLessonCard from './UpcomingLessonCard.vue'
import type { ActiveLesson } from '../api/dashboard'

interface Props {
  upcomingLessons: ActiveLesson[]
  loading?: boolean
  error?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
})

const router = useRouter()
const { t } = useI18n()

const hasLessons = computed(() => props.upcomingLessons.length > 0)

function goToBookLesson() {
  router.push('/lessons').catch(() => {})
}
</script>
