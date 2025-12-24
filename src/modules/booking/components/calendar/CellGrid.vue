<template>
  <DragSelectOverlay @select="handleDragSelect">
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
          @cell-click="(cellData, event) => emit('cellClick', cellData, event)"
        />
      </div>
    </div>
  </DragSelectOverlay>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CalendarCell as CalendarCellType } from '@/modules/booking/types/calendar'
import CalendarCell from './CalendarCell.vue'
import DragSelectOverlay from './DragSelectOverlay.vue'
import { useDraftStore } from '@/modules/booking/stores/draftStore'

const props = defineProps<{
  cells: CalendarCellType[]
  weekStart: string
  timezone: string
}>()

const emit = defineEmits<{
  cellClick: [cell: CalendarCellType, event: MouseEvent]
}>()

const draftStore = useDraftStore()

function handleDragSelect(cellKeys: string[]) {
  console.log('[CellGrid] Drag select:', cellKeys.length, 'cells')
  
  for (const key of cellKeys) {
    const cell = props.cells.find(c => c.startAtUTC === key)
    if (cell && cell.status === 'empty') {
      draftStore.addPatch(cell, 'set_available')
    }
  }
}

function getCellsForDay(dayOffset: number): CalendarCellType[] {
  const targetDate = new Date(props.weekStart)
  targetDate.setDate(targetDate.getDate() + dayOffset)
  const dateStr = targetDate.toISOString().split('T')[0]
  
  const filtered = props.cells.filter(cell => {
    const cellDate = new Date(cell.startAtUTC).toISOString().split('T')[0]
    return cellDate === dateStr
  })
  
  console.log(`[CellGrid] Day ${dayOffset} (${dateStr}): ${filtered.length} cells`)
  if (dayOffset === 0 && filtered.length > 0) {
    console.log(`[CellGrid] First 3 cells of day 0:`, filtered.slice(0, 3))
  }
  
  return filtered
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
