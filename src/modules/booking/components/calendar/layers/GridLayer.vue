<template>
  <div class="grid-layer" :class="{ 'availability-mode': availabilityMode }">
    <div 
      v-for="hour in hours" 
      :key="hour"
      class="grid-hour"
      :data-testid="'grid-hour-' + hour"
      :class="{
        'is-past': isPastHour(hour),
        'is-disabled': isDisabledDay
      }"
      :style="{ height: `${pxPerMinute * 60}px` }"
      @click="handleCellClick(hour)"
    >
      <div v-if="showLabels" class="hour-label">{{ formatHour(hour) }}</div>
      <div class="grid-line-half" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Day {
  date: string
  dayStatus: string
}

const props = defineProps<{
  days: Day[]
  hours: number[]
  currentTime: string
  pxPerMinute: number
  showLabels?: boolean
  availabilityMode?: boolean
}>()

const emit = defineEmits<{
  'cell-click': [hour: number]
}>()

const showLabels = computed(() => props.showLabels !== false)

const handleCellClick = (hour: number) => {
  const date = dayDate.value
  if (!date) return
  
  emit('cell-click', hour)
}

const currentDate = computed(() => {
  if (!props.currentTime) return null
  return props.currentTime.slice(0, 10)
})

const dayDate = computed(() => {
  return props.days[0]?.date || null
})

const isDisabledDay = computed(() => {
  if (!dayDate.value || !currentDate.value) return false
  return dayDate.value < currentDate.value
})

const isPastHour = (hour: number): boolean => {
  if (!props.currentTime || !dayDate.value || !currentDate.value) return false
  if (dayDate.value < currentDate.value) return true
  if (dayDate.value > currentDate.value) return false

  const now = new Date(props.currentTime)
  const currentHour = now.getHours()

  if (hour < currentHour) return true
  if (hour === currentHour) {
    const currentMinutes = now.getMinutes()
    return currentMinutes >= 55
  }
  return false
}

const formatHour = (hour: number): string => {
  return `${hour.toString().padStart(2, '0')}:00`
}
</script>

<style scoped>
.grid-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  pointer-events: auto;
}

.grid-layer.availability-mode {
  pointer-events: none;
}

.grid-hour {
  position: relative;
  border-bottom: 1px solid var(--calendar-grid-line, rgba(128, 128, 128, 0.15));
  transition: background-color 0.2s ease;
}

.grid-hour.is-past {
  opacity: 0.45;
}

.grid-hour.is-disabled {
  pointer-events: none;
  opacity: 0.5;
}

.hour-label {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
  pointer-events: auto;
}

.grid-line-half {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--calendar-grid-line-half, rgba(128, 128, 128, 0.07));
  pointer-events: none;
}
</style>
