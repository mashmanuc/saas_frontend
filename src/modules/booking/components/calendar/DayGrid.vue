<template>
  <div class="day-grid">
    <DayColumnV2
      v-for="day in days"
      :key="day.dayKey"
      :day="day"
      :cells="getCellsForDay(day.dayKey)"
      :timezone="timezone"
      @cell-click="handleCellClick"
    />
  </div>
</template>

<script setup lang="ts">
import DayColumnV2 from './DayColumnV2.vue'
import type { Day, CalendarCell } from '@/modules/booking/types/calendarWeek'

const props = defineProps<{
  days: Day[]
  cells: CalendarCell[]
  timezone: string
}>()

const emit = defineEmits<{
  cellClick: [cell: CalendarCell]
}>()

function getCellsForDay(dayKey: string): CalendarCell[] {
  return props.cells.filter(cell => cell.dayKey === dayKey)
}

function handleCellClick(cell: CalendarCell) {
  emit('cellClick', cell)
}
</script>

<style scoped>
.day-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  background: #e5e7eb;
  flex: 1;
}
</style>
