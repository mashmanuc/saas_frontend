<script setup lang="ts">
// F10: Day Column Component
import { computed } from 'vue'
import type { TimeSlot } from '../../api/booking'
import TimeSlotComponent from './TimeSlot.vue'

const props = defineProps<{
  date: Date
  slots: TimeSlot[]
  hours: number[]
  isToday?: boolean
}>()

const emit = defineEmits<{
  'slot-click': [slot: TimeSlot]
}>()

// Calculate slot position based on time
function getSlotStyle(slot: TimeSlot) {
  const [startHour, startMin] = slot.start_time.split(':').map(Number)
  const [endHour, endMin] = slot.end_time.split(':').map(Number)

  const startOffset = (startHour - props.hours[0]) * 60 + startMin
  const duration = (endHour - startHour) * 60 + (endMin - startMin)

  return {
    top: `${startOffset}px`,
    height: `${duration}px`,
  }
}

function handleSlotClick(slot: TimeSlot) {
  emit('slot-click', slot)
}
</script>

<template>
  <div class="day-column" :class="{ 'is-today': isToday }">
    <!-- Hour grid lines -->
    <div v-for="hour in hours" :key="hour" class="hour-cell" />

    <!-- Slots -->
    <TimeSlotComponent
      v-for="slot in slots"
      :key="slot.id"
      :slot="slot"
      :style="getSlotStyle(slot)"
      @click="handleSlotClick(slot)"
    />
  </div>
</template>

<style scoped>
.day-column {
  flex: 1;
  position: relative;
  border-left: 1px solid var(--color-border, #e5e7eb);
  min-width: 100px;
}

.day-column.is-today {
  background: var(--color-primary-light, #eff6ff);
}

.hour-cell {
  height: 60px;
  border-bottom: 1px solid var(--color-border, #e5e7eb);
}

.hour-cell:last-child {
  border-bottom: none;
}
</style>
