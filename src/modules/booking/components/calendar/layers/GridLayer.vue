<template>
  <div class="grid-layer">
    <div 
      v-for="hour in hours" 
      :key="hour"
      class="grid-hour"
      :class="{ 'is-past': isPastHour(hour) }"
      :style="{ height: `${pxPerMinute * 60}px` }"
      @click="handleCellClick(hour)"
    >
      <div v-if="showLabels" class="hour-label">{{ formatHour(hour) }}</div>
      <div class="grid-line" />
      <div class="grid-line half" />
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
}>()

const emit = defineEmits<{
  'cell-click': [hour: number]
}>()

const showLabels = computed(() => props.showLabels !== false)

const handleCellClick = (hour: number) => {
  console.log('[GridLayer] Cell clicked:', hour)
  emit('cell-click', hour)
}

const isPastHour = (hour: number): boolean => {
  if (!props.currentTime) return false
  
  const now = new Date(props.currentTime)
  const currentHour = now.getHours()
  
  return hour < currentHour
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

.grid-hour {
  position: relative;
  border-bottom: 1px solid #e0e0e0;
  transition: background-color 0.3s ease;
}

.grid-hour.is-past {
  background: #f5f5f5;
  opacity: 0.4;
}

.hour-label {
  position: absolute;
  top: 4px;
  left: 8px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
  pointer-events: auto;
}

.grid-line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: #e0e0e0;
}

.grid-line.half {
  bottom: 50%;
  background: #f0f0f0;
}
</style>
