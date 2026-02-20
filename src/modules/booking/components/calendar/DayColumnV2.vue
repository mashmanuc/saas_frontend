<template>
  <div class="day-column">
    <Cell
      v-for="cell in cells"
      :key="cell.startAtUTC"
      :cell="cell"
      :timezone="timezone"
      @click="handleCellClick(cell)"
    />
  </div>
</template>

<script setup lang="ts">
import Cell from './Cell.vue'
import type { Day, CalendarCell } from '@/modules/booking/types/calendarWeek'

const props = defineProps<{
  day: Day
  cells: CalendarCell[]
  timezone: string
}>()

const emit = defineEmits<{
  cellClick: [cell: CalendarCell]
}>()

function handleCellClick(cell: CalendarCell) {
  emit('cellClick', cell)
}
</script>

<style scoped>
.day-column {
  display: flex;
  flex-direction: column;
  background: var(--card-bg);
  border-right: 1px solid var(--border-color);
}

.day-column:last-child {
  border-right: none;
}
</style>
