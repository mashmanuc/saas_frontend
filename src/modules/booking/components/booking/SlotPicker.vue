<script setup lang="ts">
// F13: Slot Picker Component
import { ref, computed, watch } from 'vue'
import Button from '@/ui/Button.vue'
import type { TimeSlot } from '../../api/booking'

import CalendarHeader from '../calendar/CalendarHeader.vue'
import WeekCalendar from '../calendar/WeekCalendar.vue'
import SkeletonCard from '@/components/ui/SkeletonCard.vue'

const props = defineProps<{
  tutorId?: number
  loading?: boolean
}>()

const slotsByDate = ref<Record<string, TimeSlot[]>>({})
const selectedDate = ref(new Date())
const selectedSlot = ref<TimeSlot | null>(null)
const weekDays = ref<any[]>([])
const viewMode = ref<'week' | 'month'>('week')

function handleSlotSelect(slot: TimeSlot) {
  if (slot.status === 'available') {
    selectedSlot.value = slot
  }
}

function navigateWeek(direction: number) {
  const newDate = new Date(selectedDate.value)
  newDate.setDate(newDate.getDate() + (direction * 7))
  selectedDate.value = newDate
}

function goToToday() {
  selectedDate.value = new Date()
}

function setViewMode(mode: 'week' | 'month') {
  viewMode.value = mode
}

function clearSelection() {
  selectedSlot.value = null
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
      @prev="navigateWeek(-1)"
      @next="navigateWeek(1)"
      @today="goToToday()"
      @view-change="setViewMode"
    />

    <!-- Loading skeletons -->
    <div v-if="loading" class="skeleton-grid">
      <SkeletonCard v-for="i in 7" :key="i" variant="slot" :lines="2" />
    </div>

    <WeekCalendar
      v-else
      :slots-by-date="slotsByDate"
      :week-days="weekDays"
      :loading="loading"
      @slot-click="handleSlotSelect"
    />

    <!-- Selected Slot Info -->
    <Transition name="slide-up">
      <div v-if="selectedSlot" class="selected-slot-info">
      <h4>Selected Time</h4>
      <p class="selected-time">{{ formatSelectedTime(selectedSlot) }}</p>
      <p class="selected-duration">
        Duration: {{ selectedSlot.duration_minutes }} minutes
      </p>
      <Button variant="ghost" size="sm" @click="clearSelection()">
        Clear Selection
      </Button>
      </div>
    </Transition>

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

.skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
  padding: 16px;
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

/* Transitions */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.3s ease;
}

.slide-up-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-up-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
