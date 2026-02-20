<template>
  <div class="lesson-card" :class="{ 'can-join': lesson.can_join }">
    <div class="lesson-time">
      <span class="date">{{ formattedDate }}</span>
      <span class="time">{{ formattedTime }}</span>
    </div>

    <div class="lesson-info">
      <div class="participant">
        <img :src="participantAvatar" :alt="participantName" class="avatar" />
        <span>{{ participantName }}</span>
      </div>
      <span class="status-badge" :class="lesson.status">
        {{ statusLabel }}
      </span>
    </div>

    <div class="lesson-actions">
      <ClassroomButton
        v-if="lesson.classroom_session_id"
        :session-id="lesson.classroom_session_id"
        :can-join="lesson.can_join"
        :scheduled-at="lesson.scheduled_at"
        size="small"
        @click="$emit('join', lesson)"
      />
      <router-link :to="`/bookings/${lesson.id}`" class="btn btn-ghost px-3 py-1.5 text-sm">
        Деталі
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import ClassroomButton from '@/modules/classroom/components/ClassroomButton.vue'
import type { ActiveLesson } from '../api/dashboard'

interface Props {
  lesson: ActiveLesson
  isTutor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isTutor: false,
})

defineEmits<{
  (e: 'join', lesson: ActiveLesson): void
}>()

// Computed
const formattedDate = computed(() => {
  const date = new Date(props.lesson.scheduled_at)
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
})

const formattedTime = computed(() => {
  const date = new Date(props.lesson.scheduled_at)
  return date.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })
})

const participantName = computed(() => {
  return props.isTutor
    ? props.lesson.student_name || 'Студент'
    : props.lesson.tutor_name || 'Тьютор'
})

const participantAvatar = computed(() => {
  const avatar = props.isTutor ? props.lesson.student_avatar : props.lesson.tutor_avatar
  return avatar || '/default-avatar.png'
})

const statusLabel = computed(() => {
  const labels: Record<string, string> = {
    pending: 'Очікує',
    confirmed: 'Підтверджено',
    in_progress: 'Триває',
    completed: 'Завершено',
    cancelled: 'Скасовано',
  }
  return labels[props.lesson.status] || props.lesson.status
})
</script>

<style scoped>
.lesson-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--card-bg);
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
}

.lesson-card.can-join {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}

.lesson-time {
  text-align: center;
  min-width: 60px;
}

.lesson-time .date {
  display: block;
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.lesson-time .time {
  display: block;
  font-size: var(--text-xl);
  font-weight: 600;
}

.lesson-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.participant {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  object-fit: cover;
}

.status-badge {
  padding: var(--space-2xs) var(--space-xs);
  border-radius: var(--radius-xs);
  font-size: var(--text-xs);
  font-weight: 500;
}

.status-badge.confirmed {
  background: color-mix(in srgb, var(--success-bg) 15%, transparent);
  color: var(--success-bg);
}

.status-badge.in_progress {
  background: color-mix(in srgb, var(--accent) 15%, transparent);
  color: var(--accent);
}

.status-badge.pending {
  background: color-mix(in srgb, var(--warning-bg) 15%, transparent);
  color: var(--warning-bg);
}

.status-badge.completed {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.status-badge.cancelled {
  background: color-mix(in srgb, var(--danger-bg) 15%, transparent);
  color: var(--danger-bg);
}

.lesson-actions {
  display: flex;
  gap: var(--space-xs);
}
</style>
