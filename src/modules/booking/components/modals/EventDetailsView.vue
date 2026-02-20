<template>
  <div class="event-details">
    <!-- Join Lesson CTA -->
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
import { Clock as ClockIcon, User as UserIcon, Timer as TimerIcon } from 'lucide-vue-next'
import type { CalendarEvent } from '@/modules/booking/types/calendarWeek'
import JoinLessonPicker from './JoinLessonPicker.vue'

const props = defineProps<{
  event: CalendarEvent
  dictionaries: any
}>()

function formatTime(utcTime: string): string {
  const date = new Date(utcTime)
  return date.toLocaleTimeString('uk-UA', {
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
</style>
