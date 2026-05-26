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
      <button
        v-if="lesson.can_join"
        class="join-btn px-3 py-1.5 text-sm"
        :disabled="joining"
        @click="handleJoinClassroom"
      >
        {{ joining ? '...' : (isTutor ? 'Почати урок' : 'Приєднатися') }}
      </button>
      <router-link :to="`/bookings/${lesson.id}`" class="link-ghost px-3 py-1.5 text-sm">
        Деталі
      </router-link>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { calendarV055Api } from '@/modules/booking/api/calendarV055Api'
import type { ActiveLesson } from '../api/dashboard'

interface Props {
  lesson: ActiveLesson
  isTutor?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isTutor: false,
})

const router = useRouter()
const joining = ref(false)

async function handleJoinClassroom() {
  // INSTANT lessons (solo→classroom): navigate directly to classroom URL
  if (props.lesson.lesson_type === 'instant' || props.lesson.wb_session_id) {
    router.push(`/winterboard/classroom/${props.lesson.id}`)
    return
  }
  // Scheduled Booking: resolve room URL via calendar API
  joining.value = true
  try {
    const response = await calendarV055Api.joinEventRoom(props.lesson.id as number)
    if (response.room?.url) {
      router.push(response.room.url)
    }
  } catch (err) {
    console.error('[UpcomingLessonCard] Join failed:', err)
  } finally {
    joining.value = false
  }
}

// Computed
const formattedDate = computed(() => {
  if (!props.lesson.scheduled_at) return 'Зараз'
  const date = new Date(props.lesson.scheduled_at)
  return date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
})

const formattedTime = computed(() => {
  if (!props.lesson.scheduled_at) return ''
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
  return avatar || '/default-avatar.svg'
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

.link-ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background-color: transparent;
  color: var(--accent);
  border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
  text-decoration: none;
}

.link-ghost:hover {
  background-color: color-mix(in srgb, var(--accent) 8%, transparent);
  border-color: color-mix(in srgb, var(--accent) 45%, transparent);
}

.join-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 25px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border: none;
  text-decoration: none;
}

.join-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(109, 40, 217, 0.25);
}

.join-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
