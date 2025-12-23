<template>
  <div class="time-column">
    <div v-for="hour in hours" :key="hour" class="time-label">
      {{ formatHour(hour) }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  timezone: string
}>()

const hours = computed(() => {
  const result = []
  for (let h = 0; h < 24; h++) {
    result.push(h)
  }
  return result
})

function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`
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
  height: 80px;
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
