<template>
  <div class="events-layer">
    <div
      v-for="event in events"
      :key="event.id"
      class="event-card"
      :class="{
        'is-first': event.is_first,
        'is-past': isPastFn(event.start),
        'is-no-show': event.status === 'no_show',
        'is-cancelled': event.status === 'cancelled'
      }"
      :style="getEventStyle(event)"
      @click="$emit('event-click', event)"
      @mousedown="handleEventMouseDown(event, $event)"
    >
      <div class="event-student">{{ getStudentName(event) }}</div>
      <div class="event-time">{{ formatTimeRange(event) }}</div>
      <div v-if="event.is_first" class="first-badge">FIRST</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'
import { useCalendarGrid } from '@/modules/booking/composables/useCalendarGrid'

dayjs.extend(utc)
dayjs.extend(timezone)

interface Student {
  id: number
  name: string
}

interface CalendarEvent {
  id: number
  start: string
  end: string
  status: string
  is_first?: boolean
  student?: Student
  clientName?: string
}

const props = defineProps<{
  events: CalendarEvent[]
  pxPerMinute: number
  isPastFn: (datetime: string) => boolean
  timezone?: string
}>()

const emit = defineEmits<{
  'event-click': [event: CalendarEvent]
  'drag-start': [event: CalendarEvent, mouseEvent: MouseEvent]
}>()

const tz = computed(() => props.timezone || 'UTC')
const { formatTime, calculateTopPx, calculateHeightPx } = useCalendarGrid({
  timezone: tz.value,
  pxPerMinute: props.pxPerMinute,
})

const handleEventMouseDown = (event: CalendarEvent, mouseEvent: MouseEvent) => {
  if (!props.isPastFn(event.start)) {
    emit('drag-start', event, mouseEvent)
  }
}

const getEventStyle = (event: CalendarEvent) => {
  const topPx = calculateTopPx(event.start)
  const heightPx = calculateHeightPx(event.start, event.end)

  return {
    top: `${topPx}px`,
    height: `${heightPx}px`
  }
}

const getStudentName = (event: CalendarEvent): string => {
  if (event.student?.name && event.student.name.trim()) {
    return event.student.name.trim()
  }
  if (event.clientName && event.clientName.trim()) {
    return event.clientName.trim()
  }
  return ''
}

const formatTimeRange = (event: CalendarEvent): string => {
  const from = formatTime(event.start)
  const to = formatTime(event.end)
  return `${from} – ${to}`
}
</script>

<style scoped>
.events-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  pointer-events: none;
}

.event-card {
  position: absolute;
  left: 8px;
  right: 8px;
  min-height: 32px;
  background: #4caf50;
  color: #0a2f16;
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.2s, box-shadow 0.2s;
  overflow: hidden;
  border: 1px solid #2e7d32;
}

.event-card.is-first {
  background: #7c3aed;
  border-color: #5b21b6;
  color: #f5f3ff;
}

.event-card.is-past {
  opacity: 0.6;
  cursor: default;
}

.event-card.is-no-show {
  background: #9e9e9e;
  border-color: #757575;
  color: #f5f5f5;
}

.event-card.is-cancelled {
  background: #f87171;
  border-color: #ef4444;
  color: #7f1d1d;
}

.event-card:not(.is-past):hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.event-student {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 2px;
  color: #041b0c;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
}

.event-time {
  font-size: 12px;
  opacity: 0.95;
}

.first-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(255, 255, 255, 0.3);
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  letter-spacing: 0.5px;
}
</style>
