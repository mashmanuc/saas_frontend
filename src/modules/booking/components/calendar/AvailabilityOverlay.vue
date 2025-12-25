<template>
  <div class="availability-overlay">
    <div
      v-for="layout in dayLayouts"
      :key="layout.slotId"
      class="availability-block"
      :style="{
        top: `${layout.top}px`,
        height: `${layout.height}px`
      }"
    >
      <div class="availability-block__inner">
        <span class="availability-block__label">
          {{ formatSlotLabel(slotsById?.[layout.slotId]) }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AvailabilityLayout, AccessibleSlot } from '@/modules/booking/types/calendarWeek'

const props = defineProps<{
  dayKey: string
  layouts?: AvailabilityLayout[]
  slotsById?: Record<number, AccessibleSlot>
}>()

const dayLayouts = computed(() => {
  return (props.layouts || []).filter(layout => layout.dayKey === props.dayKey)
})

function formatSlotLabel(slot?: AccessibleSlot) {
  if (!slot) return ''
  const start = new Date(slot.start)
  const end = new Date(slot.end)
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
  return `${formatter.format(start)} – ${formatter.format(end)}`
}
</script>

<style scoped>
.availability-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 5;
}

.availability-block {
  position: absolute;
  left: 4px;
  right: 4px;
  background: rgba(251, 191, 36, 0.25);
  border: 1px solid rgba(217, 119, 6, 0.45);
  border-radius: 8px;
  overflow: hidden;
}

.availability-block__inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: flex-end;
  padding: 4px 6px;
  box-sizing: border-box;
}

.availability-block__label {
  font-size: 11px;
  font-weight: 600;
  color: #92400e;
  background: rgba(255, 255, 255, 0.85);
  border-radius: 6px;
  padding: 2px 6px;
  line-height: 1.2;
}
</style>
