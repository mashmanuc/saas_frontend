<template>
  <div class="event-details">
    <!-- Відкрити дошку M4SH (classroom) -->
    <div class="classroom-cta">
      <button
        class="classroom-join-btn"
        :disabled="joiningClassroom"
        @click="handleOpenClassroom"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
          <line x1="8" y1="21" x2="16" y2="21"/>
          <line x1="12" y1="17" x2="12" y2="21"/>
        </svg>
        {{ joiningClassroom ? $t('common.loading') : $t('booking.calendar.eventDetails.openClassroom') }}
      </button>
    </div>

    <!-- Join Lesson CTA (Zoom/зовнішні посилання) -->
    <JoinLessonPicker
      v-if="event.lesson_link"
      :event-id="event.id"
      :lesson-link="event.lesson_link"
    />

    <!-- Time & Client -->
    <div class="detail-section">
      <div class="detail-row">
        <ClockIcon class="w-5 h-5 text-gray-500" />
        <div>
          <p class="detail-label">{{ $t('booking.calendar.eventDetails.time') }}</p>
          <p class="detail-value" data-testid="event-time">{{ formatTime(event.start) }} - {{ formatTime(event.end) }}</p>
        </div>
      </div>

      <div class="detail-row">
        <UserIcon class="w-5 h-5 text-gray-500" />
        <div>
          <p class="detail-label">{{ $t('booking.calendar.eventDetails.student') }}</p>
          <p class="detail-value" data-testid="event-student-name">{{ event.clientName }}</p>
          <p v-if="event.clientPhone" class="detail-subvalue">{{ event.clientPhone }}</p>
        </div>
      </div>

      <div class="detail-row">
        <TimerIcon class="w-5 h-5 text-gray-500" />
        <div>
          <p class="detail-label">{{ $t('booking.calendar.eventDetails.duration') }}</p>
          <p class="detail-value">{{ event.durationMin }} {{ $t('common.minutes') }}</p>
        </div>
      </div>
    </div>

    <!-- Comment -->
    <div v-if="event.tutorComment" class="detail-section">
      <p class="detail-label">{{ $t('booking.calendar.eventDetails.comment') }}</p>
      <p class="comment-text">{{ event.tutorComment }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Clock as ClockIcon, User as UserIcon, Timer as TimerIcon } from 'lucide-vue-next'
import type { CalendarEvent } from '@/modules/booking/types/calendarWeek'
import { calendarV055Api } from '@/modules/booking/api/calendarV055Api'
import JoinLessonPicker from './JoinLessonPicker.vue'
import { activeLocale } from '@/utils/i18nDate'

const props = defineProps<{
  event: CalendarEvent
  dictionaries: any
}>()

const router = useRouter()
const { t } = useI18n()
const joiningClassroom = ref(false)

async function handleOpenClassroom() {
  joiningClassroom.value = true
  try {
    // Використовуємо canonical API join endpoint — повертає classroom URL
    const response = await calendarV055Api.joinEventRoom(props.event.id)
    if (response.room?.url) {
      router.push(response.room.url)
    }
  } catch (err: any) {
    const code = err?.response?.data?.code
    const status = err?.response?.status
    if (status === 409 || code === 'room_not_available_yet') {
      alert(t('student.calendar.tooEarly'))
    } else if (status === 410 || code === 'room_expired') {
      alert(t('student.calendar.expired'))
    } else {
      alert(t('student.calendar.joinError'))
    }
  } finally {
    joiningClassroom.value = false
  }
}

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString(activeLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<style scoped>
.event-details {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.detail-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.detail-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.detail-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.detail-subvalue {
  font-size: 13px;
  color: var(--text-secondary);
}

.comment-text {
  padding: 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  font-size: 14px;
  color: var(--text-primary);
  white-space: pre-wrap;
}

/* Кнопка "Відкрити дошку" */
.classroom-cta {
  margin-bottom: 4px;
}

.classroom-join-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px 16px;
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  color: white;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 600;
  transition: all 0.2s;
  cursor: pointer;
  border: none;
}

.classroom-join-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #6d28d9 0%, #5b21b6 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(109, 40, 217, 0.3);
}

.classroom-join-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}
</style>
