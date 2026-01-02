<template>
  <div class="draft-slots-layer">
    <div
      v-for="slot in draftSlots"
      :key="slot.tempId || slot.slotId"
      class="draft-slot"
      :class="{ 'draft-add': !slot.action, 'draft-remove': slot.action === 'remove' }"
      :style="getSlotStyle(slot)"
    >
      <div class="draft-label">
        <span v-if="!slot.action">+</span>
        <span v-else>×</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface DraftSlot {
  tempId?: string
  slotId?: number | null
  start: string
  end: string
  status?: 'available' | 'blocked'
  action?: 'remove'
}

const props = defineProps<{
  draftSlots: DraftSlot[]
  pxPerMinute: number
  timezone?: string
  gridStartHour?: number
}>()

const getSlotStyle = (slot: DraftSlot) => {
  const start = new Date(slot.start)
  const end = new Date(slot.end)
  
  const minutesFromDayStart = start.getHours() * 60 + start.getMinutes()
  const gridStartMinutes = (props.gridStartHour ?? 0) * 60
  const minutesFromGridStart = Math.max(0, minutesFromDayStart - gridStartMinutes)
  const durationMinutes = (end.getTime() - start.getTime()) / 60000
  
  return {
    top: `${minutesFromGridStart * props.pxPerMinute}px`,
    height: `${durationMinutes * props.pxPerMinute}px`,
    left: '4px',
    right: '4px',
  }
}
</script>

<style scoped>
.draft-slots-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 3;
  pointer-events: none;
}

.draft-slot {
  position: absolute;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  pointer-events: none;
}

.draft-slot.draft-add {
  background: rgba(76, 175, 80, 0.3);
  border: 2px dashed #4caf50;
}

.draft-slot.draft-remove {
  background: rgba(244, 67, 54, 0.3);
  border: 2px dashed #f44336;
}

.draft-label {
  font-size: 24px;
  font-weight: bold;
  background: rgba(255, 255, 255, 0.95);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.draft-slot.draft-add .draft-label {
  color: #4caf50;
}

.draft-slot.draft-remove .draft-label {
  color: #f44336;
}
</style>
