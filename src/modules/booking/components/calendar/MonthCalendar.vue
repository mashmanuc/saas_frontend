<script setup lang="ts">
// F9: Month Calendar Component
import { computed } from 'vue'
import type { CalendarDay } from '../../api/booking'

const props = defineProps<{
  calendarDays: CalendarDay[]
  selectedDate: Date
}>()

const emit = defineEmits<{
  'date-select': [date: Date]
}>()

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// Get the first day of the month
const firstDayOfMonth = computed(() => {
  const date = new Date(props.selectedDate)
  date.setDate(1)
  return date
})

// Get day of week for first day (0 = Monday in our grid)
const firstDayOffset = computed(() => {
  const day = firstDayOfMonth.value.getDay()
  return day === 0 ? 6 : day - 1 // Convert Sunday=0 to Monday=0 based
})

// Days in month
const daysInMonth = computed(() => {
  const date = new Date(props.selectedDate)
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
})

// Generate calendar grid
const calendarGrid = computed(() => {
  const grid: (CalendarDay | null)[] = []

  // Add empty cells for offset
  for (let i = 0; i < firstDayOffset.value; i++) {
    grid.push(null)
  }

  // Add days
  for (let day = 1; day <= daysInMonth.value; day++) {
    const dateStr = formatDateKey(
      new Date(props.selectedDate.getFullYear(), props.selectedDate.getMonth(), day)
    )
    const calendarDay = props.calendarDays.find((d) => d.date === dateStr)
    grid.push(
      calendarDay || {
        date: dateStr,
        slots_count: 0,
        available_count: 0,
        booked_count: 0,
        has_bookings: false,
      }
    )
  }

  return grid
})

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function isToday(dateStr: string): boolean {
  return dateStr === formatDateKey(new Date())
}

function isSelected(dateStr: string): boolean {
  return dateStr === formatDateKey(props.selectedDate)
}

function handleDayClick(day: CalendarDay | null) {
  if (day) {
    emit('date-select', new Date(day.date))
  }
}
</script>

<template>
  <div class="month-calendar">
    <!-- Week day headers -->
    <div class="weekday-header">
      <div v-for="day in weekDays" :key="day" class="weekday">
        {{ day }}
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="calendar-grid">
      <div
        v-for="(day, index) in calendarGrid"
        :key="index"
        class="day-cell"
        :class="{
          empty: !day,
          'is-today': day && isToday(day.date),
          'is-selected': day && isSelected(day.date),
          'has-slots': day && day.available_count > 0,
          'has-bookings': day && day.has_bookings,
        }"
        @click="handleDayClick(day)"
      >
        <template v-if="day">
          <span class="day-number">{{ new Date(day.date).getDate() }}</span>
          <div v-if="day.slots_count > 0" class="day-indicators">
            <span v-if="day.available_count > 0" class="indicator available">
              {{ day.available_count }}
            </span>
            <span v-if="day.booked_count > 0" class="indicator booked">
              {{ day.booked_count }}
            </span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.month-calendar {
  padding: 16px;
}

.weekday-header {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary, #6b7280);
  padding: 8px 0;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.day-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--color-bg-primary, white);
  border: 1px solid transparent;
}

.day-cell.empty {
  cursor: default;
  background: transparent;
}

.day-cell:not(.empty):hover {
  background: var(--color-bg-secondary, #f5f5f5);
}

.day-cell.is-today {
  border-color: var(--color-primary, #3b82f6);
}

.day-cell.is-selected {
  background: var(--color-primary, #3b82f6);
  color: white;
}

.day-cell.is-selected .day-number {
  color: white;
}

.day-cell.has-slots:not(.is-selected) {
  background: var(--color-success-light, #d1fae5);
}

.day-number {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary, #111827);
}

.day-indicators {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.indicator {
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  font-weight: 600;
}

.indicator.available {
  background: var(--color-success, #10b981);
  color: white;
}

.indicator.booked {
  background: var(--color-primary, #3b82f6);
  color: white;
}

@media (max-width: 640px) {
  .day-cell {
    padding: 4px;
  }

  .day-number {
    font-size: 12px;
  }

  .day-indicators {
    display: none;
  }
}
</style>
