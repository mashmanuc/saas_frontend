<template>
  <div class="week-header">
    <div class="time-gutter" />
    <div
      v-for="day in weekDays"
      :key="day.dateStr"
      class="day-header"
      :class="{ 'is-today': day.isToday }"
    >
      <span class="day-label">{{ day.label }}</span>
      <span class="day-number">{{ day.number }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  weekStart: string
  timezone: string
}>()

interface DayInfo {
  dateStr: string
  label: string
  number: string
  isToday: boolean
}

const weekDays = computed((): DayInfo[] => {
  const days: DayInfo[] = []
  const today = new Date().toISOString().split('T')[0]
  
  for (let i = 0; i < 7; i++) {
    const date = new Date(props.weekStart)
    date.setDate(date.getDate() + i)
    
    const dateStr = date.toISOString().split('T')[0]
    const label = date.toLocaleDateString('uk-UA', { weekday: 'short' })
    const number = date.getDate().toString()
    const isToday = dateStr === today
    
    days.push({ dateStr, label, number, isToday })
  }
  
  return days
})
</script>

<style scoped>
.week-header {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  flex-shrink: 0;
  background: var(--card-bg);
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
  border-left: 1px solid var(--border-color);
}

.day-header.is-today {
  background: #eff6ff;
}

.day-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-transform: uppercase;
}

.day-number {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.day-header.is-today .day-number {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
}
</style>
