<template>
  <Card>
    <div class="schedule-header">
      <h2 class="text-lg font-semibold text-body">
        {{ $t('dashboard.todaySchedule.title') }}
      </h2>
      <router-link
        to="/tutor/schedule"
        class="text-sm text-accent hover:underline"
      >
        {{ $t('dashboard.todaySchedule.viewAll') }}
      </router-link>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="py-4 text-center text-muted text-sm">
      {{ $t('loader.loading') }}
    </div>

    <!-- Lessons list -->
    <div v-else-if="lessons.length" class="space-y-2">
      <UpcomingLessonCard
        v-for="lesson in lessons"
        :key="lesson.id"
        :lesson="lesson"
        :is-tutor="isTutor"
      />
    </div>

    <!-- Empty state -->
    <div v-else class="schedule-empty">
      <Calendar :size="32" class="schedule-empty-icon" />
      <p class="text-sm text-muted">
        {{ $t('dashboard.todaySchedule.empty') }}
      </p>
      <router-link
        to="/tutor/schedule"
        class="text-sm text-accent hover:underline"
      >
        {{ $t('dashboard.todaySchedule.openCalendar') }}
      </router-link>
    </div>
  </Card>
</template>

<script setup lang="ts">
import { Calendar } from 'lucide-vue-next'
import Card from '@/ui/Card.vue'
import UpcomingLessonCard from './UpcomingLessonCard.vue'
import type { ActiveLesson } from '../api/dashboard'

defineProps<{
  lessons: ActiveLesson[]
  loading: boolean
  isTutor: boolean
}>()
</script>

<style scoped>
.schedule-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md, 16px);
}

.schedule-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm, 8px);
  padding: var(--space-xl, 24px) 0;
  text-align: center;
}

.schedule-empty-icon {
  color: var(--text-secondary, var(--color-text-muted));
  opacity: 0.5;
}

.schedule-header a:focus-visible,
.schedule-empty a:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}
</style>
