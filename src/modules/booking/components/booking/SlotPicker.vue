<script setup lang="ts">
// F13: Slot Picker Component
import { computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useCalendarStore } from '../../stores/calendarStore'
import type { TimeSlot } from '../../api/booking'

import CalendarHeader from '../calendar/CalendarHeader.vue'
import WeekCalendar from '../calendar/WeekCalendar.vue'

const props = defineProps<{
  tutorId: number
  loading?: boolean
}>()

const store = useCalendarStore()
const { slotsByDate, selectedDate, selectedSlot, weekDays, viewMode } =
  storeToRefs(store)

// Load slots when tutor or date changes
watch(
  [() => props.tutorId, selectedDate],
  async () => {
    if (props.tutorId) {
      await store.loadWeekSlots(props.tutorId)
    }
  },
  { immediate: true }
)

function handleSlotSelect(slot: TimeSlot) {
  if (slot.status === 'available') {
    store.setSelectedSlot(slot)
  }
}

function formatSelectedTime(slot: TimeSlot): string {
  const date = new Date(slot.start_datetime)
  return date.toLocaleString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="slot-picker">
    <CalendarHeader
      :date="selectedDate"
      :view-mode="viewMode"
      @prev="store.navigateWeek(-1)"
      @next="store.navigateWeek(1)"
      @today="store.goToToday()"
      @view-change="store.setViewMode"
    />

    <WeekCalendar
      :slots-by-date="slotsByDate"
      :week-days="weekDays"
      :loading="loading"
      @slot-click="handleSlotSelect"
    />

    <!-- Selected Slot Info -->
    <div v-if="selectedSlot" class="selected-slot-info">
      <h4>Selected Time</h4>
      <p class="selected-time">{{ formatSelectedTime(selectedSlot) }}</p>
      <p class="selected-duration">
        Duration: {{ selectedSlot.duration_minutes }} minutes
      </p>
      <button class="clear-btn" @click="store.setSelectedSlot(null)">
        Clear Selection
      </button>
    </div>

    <!-- No Slots Message -->
    <div v-if="!loading && Object.keys(slotsByDate).length === 0" class="no-slots">
      <p>No available slots for this week</p>
      <p class="hint">Try navigating to a different week</p>
    </div>
  </div>
</template>

<style scoped>
.slot-picker {
  background: var(--color-bg-primary, white);
  border-radius: 12px;
  border: 1px solid var(--color-border, #e5e7eb);
  overflow: hidden;
}

.selected-slot-info {
  padding: 16px 20px;
  background: var(--color-success-light, #d1fae5);
  border-top: 1px solid var(--color-success, #10b981);
}

.selected-slot-info h4 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-success-dark, #065f46);
}

.selected-time {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.selected-duration {
  margin: 4px 0 12px;
  font-size: 14px;
  color: var(--color-text-secondary, #6b7280);
}

.clear-btn {
  padding: 6px 12px;
  background: none;
  border: 1px solid var(--color-success, #10b981);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-success-dark, #065f46);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  background: var(--color-success, #10b981);
  color: white;
}

.no-slots {
  padding: 40px 20px;
  text-align: center;
}

.no-slots p {
  margin: 0;
  color: var(--color-text-secondary, #6b7280);
}

.no-slots .hint {
  font-size: 14px;
  margin-top: 8px;
}
</style>
