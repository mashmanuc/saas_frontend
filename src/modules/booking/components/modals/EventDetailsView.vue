<template>
  <div class="event-details">
    <!-- Time & Client -->
    <div class="detail-section">
      <div class="detail-row">
        <ClockIcon class="w-5 h-5 text-gray-500" />
        <div>
          <p class="detail-label">{{ $t('booking.calendar.eventDetails.time') }}</p>
          <p class="detail-value">{{ formatTime(event.start) }} - {{ formatTime(event.end) }}</p>
        </div>
      </div>

      <div class="detail-row">
        <UserIcon class="w-5 h-5 text-gray-500" />
        <div>
          <p class="detail-label">{{ $t('booking.calendar.eventDetails.student') }}</p>
          <p class="detail-value">{{ event.clientName }}</p>
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

    <!-- Status Badges -->
    <div class="detail-section">
      <div class="badges">
        <span :class="['badge', `badge-${event.paidStatus}`]">
          {{ $t(`booking.calendar.paidStatus.${event.paidStatus}`) }}
        </span>
        <span :class="['badge', `badge-${event.doneStatus}`]">
          {{ $t(`booking.calendar.doneStatus.${event.doneStatus}`) }}
        </span>
        <span class="badge badge-regularity">
          {{ $t(`booking.calendar.regularity.${event.regularity}`) }}
        </span>
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
  color: #6b7280;
  margin-bottom: 2px;
}

.detail-value {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
}

.detail-subvalue {
  font-size: 13px;
  color: #6b7280;
}

.badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.badge-paid {
  background: #d1fae5;
  color: #065f46;
}

.badge-unpaid {
  background: #fee2e2;
  color: #991b1b;
}

.badge-done {
  background: #dbeafe;
  color: #1e40af;
}

.badge-not_done,
.badge-not_done_client_missed,
.badge-done_client_missed {
  background: #f3f4f6;
  color: #374151;
}

.badge-regularity {
  background: #fef3c7;
  color: #92400e;
}

.comment-text {
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  font-size: 14px;
  color: #374151;
  white-space: pre-wrap;
}
</style>
