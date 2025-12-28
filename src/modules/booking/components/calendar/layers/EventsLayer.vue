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
      <div class="event-time">{{ formatTime(event.start) }}</div>
      <div class="event-student">{{ event.student?.name || 'Студент' }}</div>
      <div v-if="event.is_first" class="first-badge">FIRST</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useCalendarGrid } from '@/modules/booking/composables/useCalendarGrid'

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
}

const props = defineProps<{
  events: CalendarEvent[]
  pxPerMinute: number
  isPastFn: (datetime: string) => boolean
}>()

const emit = defineEmits<{
  'event-click': [event: CalendarEvent]
  'drag-start': [event: CalendarEvent, mouseEvent: MouseEvent]
}>()

const { formatTime } = useCalendarGrid()

const handleEventMouseDown = (event: CalendarEvent, mouseEvent: MouseEvent) => {
  if (!props.isPastFn(event.start)) {
    emit('drag-start', event, mouseEvent)
  }
}

const getEventStyle = (event: CalendarEvent) => {
  const start = new Date(event.start)
  const end = new Date(event.end)
  
  const minutesFromDayStart = start.getHours() * 60 + start.getMinutes()
  const durationMinutes = (end.getTime() - start.getTime()) / 60000
  
  const topPx = minutesFromDayStart * props.pxPerMinute
  const heightPx = durationMinutes * props.pxPerMinute
  
  return {
    top: `${topPx}px`,
    height: `${heightPx}px`
  }
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
  background: #4CAF50;
  color: white;
  border-radius: 4px;
  padding: 8px;
  cursor: pointer;
  pointer-events: auto;
  transition: transform 0.2s, box-shadow 0.2s;
  overflow: hidden;
}

.event-card.is-first {
  background: #9C27B0;
}

.event-card.is-past {
  opacity: 0.6;
  cursor: default;
}

.event-card.is-no-show {
  background: #757575;
  text-decoration: line-through;
}

.event-card.is-cancelled {
  background: #f44336;
  opacity: 0.7;
}

.event-card:not(.is-past):hover {
  transform: scale(1.02);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
}

.event-time {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.event-student {
  font-size: 12px;
  opacity: 0.9;
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
