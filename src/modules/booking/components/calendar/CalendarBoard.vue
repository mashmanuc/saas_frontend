<template>
  <div class="calendar-board">
    <!-- Day Headers -->
    <div class="day-headers">
      <div class="time-column-header"></div>
      <div
        v-for="day in days"
        :key="day.dayKey"
        class="day-header"
      >
        <span class="day-label">{{ day.label }}</span>
        <span class="day-date">{{ day.day }}</span>
      </div>
    </div>

    <!-- Grid Container (position: relative для overlay) -->
    <div class="grid-container">
      <DragSelectOverlay @select="handleCellsSelected">
      <!-- Time Column -->
      <div class="time-column">
        <div
          v-for="hour in hours"
          :key="hour"
          class="time-label"
        >
          {{ formatHour(hour) }}
        </div>
      </div>

      <!-- Day Grid -->
      <DayGrid
        :days="days"
        :cells="cells"
        :timezone="timezone"
        @cell-click="handleCellClick"
      />

      <!-- Events Overlay -->
      <EventsOverlay
        :event-layouts="eventLayouts"
        :events-by-id="eventsByIdComputed"
        @event-click="handleEventClick"
      />
      </DragSelectOverlay>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DayGrid from './DayGrid.vue'
import EventsOverlay from './EventsOverlay.vue'
import DragSelectOverlay from './DragSelectOverlay.vue'
import type { Day, CalendarCell, EventLayout } from '@/modules/booking/types/calendarWeek'
import { useCalendarWeekStore } from '@/modules/booking/stores/calendarWeekStore'
import { storeToRefs } from 'pinia'

const props = defineProps<{
  days: Day[]
  cells: CalendarCell[]
  eventLayouts: EventLayout[]
  timezone: string
}>()

const emit = defineEmits<{
  cellClick: [cell: CalendarCell]
  eventClick: [eventId: number]
  cellsSelected: [utcKeys: string[]]
}>()

const store = useCalendarWeekStore()
const { eventsById } = storeToRefs(store)

const eventsByIdComputed = computed(() => eventsById.value)

const hours = computed(() => {
  const result = []
  for (let h = 6; h < 22; h++) {
    result.push(h)
  }
  return result
})

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
}

function handleCellClick(cell: CalendarCell) {
  emit('cellClick', cell)
}

function handleEventClick(eventId: number) {
  emit('eventClick', eventId)
}

function handleCellsSelected(utcKeys: string[]) {
  emit('cellsSelected', utcKeys)
}
</script>

<style scoped>
.calendar-board {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.day-headers {
  display: grid;
  grid-template-columns: 60px repeat(7, 1fr);
  border-bottom: 2px solid #e5e7eb;
  background: #f9fafb;
}

.time-column-header {
  width: 60px;
}

.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  gap: 4px;
}

.day-label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.day-date {
  font-size: 20px;
  font-weight: 700;
  color: #111827;
}

.grid-container {
  display: grid;
  grid-template-columns: 60px 1fr;
  position: relative;
  min-height: 800px;
}

.time-column {
  display: flex;
  flex-direction: column;
  border-right: 1px solid #e5e7eb;
  background: #fafafa;
}

.time-label {
  height: 72px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 8px;
  padding-top: 4px;
  font-size: 11px;
  color: #6b7280;
  border-bottom: 1px solid #f3f4f6;
}

/* Responsive */
@media (max-width: 1024px) {
  .day-headers {
    grid-template-columns: 50px repeat(7, 1fr);
  }
  
  .grid-container {
    grid-template-columns: 50px 1fr;
  }
  
  .time-column-header,
  .time-column {
    width: 50px;
  }
  
  .day-header {
    padding: 8px 4px;
  }
  
  .day-label {
    font-size: 10px;
  }
  
  .day-date {
    font-size: 16px;
  }
}

@media (max-width: 768px) {
  .calendar-board {
    overflow-x: auto;
  }
  
  .grid-container {
    min-width: 600px;
  }
}
</style>
