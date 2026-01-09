<template>
  <aside class="calendar-sidebar">
    <div class="sidebar-header">
      <h3 class="sidebar-title">{{ t('calendar.sidebar.upcomingLessons') }}</h3>
      <span class="sidebar-count">{{ upcomingEvents.length }}</span>
    </div>

    <div v-if="upcomingEvents.length === 0" class="sidebar-empty">
      <CalendarIcon class="w-8 h-8 text-gray-400" />
      <p>{{ t('calendar.sidebar.noUpcoming') }}</p>
    </div>

    <div v-else class="sidebar-list">
      <button
        v-for="event in upcomingEvents"
        :key="event.id"
        class="sidebar-item"
        :class="{ 'sidebar-item--selected': selectedEventId === event.id }"
        @click="handleEventClick(event.id)"
      >
        <div class="sidebar-item__header">
          <span class="sidebar-item__student">{{ event.clientName }}</span>
          <span class="sidebar-item__status" :class="`status--${event.paidStatus}`">
            {{ getPaidStatusLabel(event.paidStatus) }}
          </span>
        </div>
        <div class="sidebar-item__time">
          <ClockIcon class="w-4 h-4" />
          <span>{{ formatEventTime(event) }}</span>
        </div>
        <div class="sidebar-item__date">
          {{ formatEventDate(event) }}
        </div>
      </button>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Calendar as CalendarIcon, Clock as ClockIcon } from 'lucide-vue-next'
import type { CalendarEvent } from '@/modules/booking/types/calendarWeek'

const props = defineProps<{
  events: CalendarEvent[]
  selectedEventId?: number | null
}>()

const emit = defineEmits<{
  eventClick: [eventId: number]
}>()

const { t } = useI18n()

const upcomingEvents = computed(() => {
  const now = new Date()
  return props.events
    .filter(event => new Date(event.start) >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 10) // Show max 10 upcoming events
})

function formatEventTime(event: CalendarEvent): string {
  const start = new Date(event.start)
  const end = new Date(event.end)
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${formatter.format(start)} – ${formatter.format(end)}`
}

function formatEventDate(event: CalendarEvent): string {
  const date = new Date(event.start)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const isToday = date.toDateString() === today.toDateString()
  const isTomorrow = date.toDateString() === tomorrow.toDateString()

  if (isToday) {
    return t('calendar.sidebar.today')
  } else if (isTomorrow) {
    return t('calendar.sidebar.tomorrow')
  } else {
    return new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date)
  }
}

function getPaidStatusLabel(paidStatus: string | null | undefined): string {
  switch (paidStatus) {
    case 'paid':
      return t('calendar.sidebar.status.paid')
    case 'unpaid':
      return t('calendar.sidebar.status.unpaid')
    default:
      return ''
  }
}

function handleEventClick(eventId: number) {
  emit('eventClick', eventId)
}
</script>

<style scoped>
.calendar-sidebar {
  width: 320px;
  background: white;
  border-left: 1px solid #e5e7eb;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
  position: sticky;
  top: 80px;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid #e5e7eb;
}

.sidebar-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
  margin: 0;
}

.sidebar-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 24px;
  height: 24px;
  padding: 0 8px;
  background: #dbeafe;
  color: #1e40af;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.sidebar-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  text-align: center;
  color: #6b7280;
  font-size: 14px;
}

.sidebar-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.sidebar-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  margin-bottom: 8px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.sidebar-item:hover {
  background: #f3f4f6;
  border-color: #d1d5db;
  transform: translateX(-2px);
}

.sidebar-item--selected {
  background: #dbeafe;
  border-color: #3b82f6;
}

.sidebar-item__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.sidebar-item__student {
  font-size: 14px;
  font-weight: 600;
  color: #111827;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-item__status {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
}

.status--paid {
  background: #d1fae5;
  color: #065f46;
}

.status--unpaid {
  background: #fee2e2;
  color: #991b1b;
}

.sidebar-item__time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #4b5563;
}

.sidebar-item__date {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}

@media (max-width: 1280px) {
  .calendar-sidebar {
    display: none;
  }
}
</style>
