<script setup lang="ts">
// F8: Week Calendar Component
import { ref, computed } from 'vue'
import type { TimeSlot } from '../../api/booking'
import DayColumn from './DayColumn.vue'

const props = defineProps<{
  slotsByDate: Record<string, TimeSlot[]>
  weekDays: Date[]
  loading?: boolean
  editMode?: boolean
}>()

const emit = defineEmits<{
  'slot-click': [slot: TimeSlot]
  'create-slot': [data: { date: string; start: string; end: string }]
}>()

const isDragging = ref(false)
const dragStart = ref<{ date: string; hour: number } | null>(null)
const dragEnd = ref<{ date: string; hour: number } | null>(null)

// Time grid hours (8 AM to 10 PM)
const hours = Array.from({ length: 15 }, (_, i) => i + 8)
const HOUR_BLOCK_HEIGHT = 60

function formatDateKey(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

function formatDayNumber(date: Date): string {
  return date.getDate().toString()
}

function isToday(date: Date): boolean {
  const today = new Date()
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  )
}

function getSlotsForDate(date: Date): TimeSlot[] {
  const key = formatDateKey(date)
  return props.slotsByDate[key] || []
}

function handleSlotClick(slot: TimeSlot) {
  emit('slot-click', slot)
}

function handleMouseDown(date: Date, hour: number) {
  if (!props.editMode) return
  
  isDragging.value = true
  const dateKey = formatDateKey(date)
  dragStart.value = { date: dateKey, hour }
  dragEnd.value = { date: dateKey, hour }
}

function handleMouseMove(date: Date, hour: number) {
  if (!isDragging.value || !props.editMode) return
  
  const dateKey = formatDateKey(date)
  if (dragStart.value && dragStart.value.date === dateKey) {
    dragEnd.value = { date: dateKey, hour }
  }
}

function handleMouseUp() {
  if (!isDragging.value || !props.editMode) return
  
  if (dragStart.value && dragEnd.value) {
    const startHour = Math.min(dragStart.value.hour, dragEnd.value.hour)
    const endHour = Math.max(dragStart.value.hour, dragEnd.value.hour) + 1
    
    emit('create-slot', {
      date: dragStart.value.date,
      start: `${startHour.toString().padStart(2, '0')}:00`,
      end: `${endHour.toString().padStart(2, '0')}:00`
    })
  }
  
  isDragging.value = false
  dragStart.value = null
  dragEnd.value = null
}

function isInDragSelection(date: Date, hour: number): boolean {
  if (!isDragging.value || !dragStart.value || !dragEnd.value) return false
  
  const dateKey = formatDateKey(date)
  if (dateKey !== dragStart.value.date) return false
  
  const minHour = Math.min(dragStart.value.hour, dragEnd.value.hour)
  const maxHour = Math.max(dragStart.value.hour, dragEnd.value.hour)
  
  return hour >= minHour && hour <= maxHour
}

function getHourCellStyle(hour: number) {
  const offset = hour - hours[0]
  return {
    top: `${offset * HOUR_BLOCK_HEIGHT}px`,
    height: `${HOUR_BLOCK_HEIGHT}px`
  }
}
</script>

<template>
  <div class="week-calendar" :class="{ 'edit-mode': editMode }" @mouseup="handleMouseUp" @mouseleave="handleMouseUp">
    <!-- Header with day names -->
    <div class="calendar-header-row">
      <div class="time-gutter" />
      <div
        v-for="day in weekDays"
        :key="formatDateKey(day)"
        class="day-header"
        :class="{ 'is-today': isToday(day) }"
      >
        <span class="day-label">{{ formatDayLabel(day) }}</span>
        <span class="day-number">{{ formatDayNumber(day) }}</span>
      </div>
    </div>

    <!-- Time grid -->
    <div class="calendar-body">
      <!-- Loading overlay -->
      <div v-if="loading" class="loading-overlay">
        <div class="spinner" />
      </div>

      <!-- Time labels -->
      <div class="time-gutter">
        <div v-for="hour in hours" :key="hour" class="time-label">
          {{ hour.toString().padStart(2, '0') }}:00
        </div>
      </div>

      <!-- Day columns -->
      <div
        v-for="day in weekDays"
        :key="formatDateKey(day)"
        class="day-column-wrapper"
      >
        <div
          v-for="hour in hours"
          :key="hour"
          class="hour-cell"
          :class="{ 'in-selection': isInDragSelection(day, hour) }"
          :style="getHourCellStyle(hour)"
          @mousedown="handleMouseDown(day, hour)"
          @mouseenter="handleMouseMove(day, hour)"
        />
        <DayColumn
          :date="day"
          :slots="getSlotsForDate(day)"
          :hours="hours"
          :is-today="isToday(day)"
          @slot-click="handleSlotClick"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.week-calendar {
  display: flex;
  flex-direction: column;
  height: 600px;
  overflow: hidden;
}

.calendar-header-row {
  display: flex;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
  flex-shrink: 0;
}

.time-gutter {
  width: 60px;
  flex-shrink: 0;
}

.day-header {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 8px;
  border-left: 1px solid var(--color-border, #e5e7eb);
}

.day-header.is-today {
  background: var(--color-primary-light, #eff6ff);
}

.day-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary, #6b7280);
  text-transform: uppercase;
}

.day-number {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text-primary, #111827);
}

.day-header.is-today .day-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary, #3b82f6);
  color: white;
  border-radius: 50%;
}

.calendar-body {
  display: flex;
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.calendar-body .time-gutter {
  position: sticky;
  left: 0;
  background: var(--color-bg-primary, white);
  z-index: 1;
}

.time-label {
  height: 60px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 8px;
  font-size: 11px;
  color: var(--color-text-secondary, #6b7280);
  transform: translateY(-8px);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border, #e5e7eb);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.week-calendar.edit-mode {
  cursor: crosshair;
}

.day-column-wrapper {
  position: relative;
  flex: 1;
  border-left: 1px solid var(--color-border, #e5e7eb);
}

.hour-cell {
  position: absolute;
  width: 100%;
  height: 60px;
  pointer-events: all;
  z-index: 1;
}

.hour-cell.in-selection {
  background: var(--color-primary-light, #dbeafe);
  border: 2px dashed var(--color-primary, #3b82f6);
}

.edit-mode .hour-cell:hover {
  background: var(--color-primary-light, #eff6ff);
}
</style>
