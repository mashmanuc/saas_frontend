<template>
  <div class="time-column">
    <div v-for="slot in timeSlots" :key="slot" class="time-label">
      {{ formatTime(slot) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  timezone: string
}>()

// Generate 30-minute time slots (48 per day: 00:00, 00:30, 01:00, ...)
const timeSlots = computed(() => {
  const result = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      result.push({ hour: h, minute: m })
    }
  }
  return result
})

function formatTime(slot: { hour: number; minute: number }): string {
  return `${slot.hour.toString().padStart(2, '0')}:${slot.minute.toString().padStart(2, '0')}`
}
</script>

<style scoped>
.time-column {
  width: 60px;
  flex-shrink: 0;
  background: white;
  border-right: 1px solid #e5e7eb;
}

.time-label {
  height: 40px;
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding-right: 8px;
  padding-top: 4px;
  font-size: 11px;
  color: #6b7280;
  border-bottom: 1px solid #f3f4f6;
}
</style>
