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
      <router-link :to="`/bookings/${lesson.id}`" class="btn ghost small">
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
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-primary, #fff);
  border-radius: 8px;
  border: 1px solid var(--border-color, #e5e7eb);
}

.lesson-card.can-join {
  border-color: var(--primary-500, #3b82f6);
  background: var(--primary-50, #eff6ff);
}

.lesson-time {
  text-align: center;
  min-width: 60px;
}

.lesson-time .date {
  display: block;
  font-size: 0.875rem;
  color: var(--text-secondary, #6b7280);
}

.lesson-time .time {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
}

.lesson-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.participant {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.status-badge.confirmed {
  background: var(--success-100, #dcfce7);
  color: var(--success-700, #15803d);
}

.status-badge.in_progress {
  background: var(--primary-100, #dbeafe);
  color: var(--primary-700, #1d4ed8);
}

.status-badge.pending {
  background: var(--warning-100, #fef3c7);
  color: var(--warning-700, #b45309);
}

.status-badge.completed {
  background: var(--gray-100, #f3f4f6);
  color: var(--gray-700, #374151);
}

.status-badge.cancelled {
  background: var(--danger-100, #fee2e2);
  color: var(--danger-700, #b91c1c);
}

.lesson-actions {
  display: flex;
  gap: 0.5rem;
}

.btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
  border: none;
}

.btn.ghost {
  background: transparent;
  border: 1px solid var(--border-color, #e5e7eb);
  color: inherit;
}

.btn.ghost:hover {
  background: var(--bg-secondary, #f9fafb);
}

.btn.small {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
}
</style>
