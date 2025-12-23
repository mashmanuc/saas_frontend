<template>
  <div class="cell-grid">
    <div
      v-for="day in 7"
      :key="day"
      class="day-column"
    >
      <CalendarCell
        v-for="cell in getCellsForDay(day - 1)"
        :key="cell.startAtUTC"
        :cell="cell"
        @click="(event) => emit('cellClick', cell, event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarCell as CalendarCellType } from '@/modules/booking/types/calendar'
import CalendarCell from './CalendarCell.vue'

const props = defineProps<{
  cells: CalendarCellType[]
  weekStart: string
  timezone: string
}>()

const emit = defineEmits<{
  cellClick: [cell: CalendarCellType, event: MouseEvent]
}>()

function getCellsForDay(dayOffset: number): CalendarCellType[] {
  const targetDate = new Date(props.weekStart)
  targetDate.setDate(targetDate.getDate() + dayOffset)
  const dateStr = targetDate.toISOString().split('T')[0]
  
  return props.cells.filter(cell => {
    const cellDate = new Date(cell.startAtUTC).toISOString().split('T')[0]
    return cellDate === dateStr
  })
}
</script>

<style scoped>
.cell-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: #e5e7eb;
  flex: 1;
}

.day-column {
  display: flex;
  flex-direction: column;
  background: white;
}
</style>
