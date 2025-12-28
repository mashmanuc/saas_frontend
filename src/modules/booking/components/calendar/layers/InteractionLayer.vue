<template>
  <div 
    v-if="isDragEnabled"
    class="interaction-layer"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseLeave"
  >
    <div
      v-if="previewSlot"
      class="preview-slot"
      :style="getPreviewStyle()"
    >
      <div class="preview-label">{{ $t('calendar.drag.preview') }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useDragDrop } from '@/modules/booking/composables/useDragDrop'

const props = defineProps<{
  pxPerMinute: number
  isDragEnabled?: boolean
}>()

const emit = defineEmits<{
  'drag-start': [event: MouseEvent]
  'drag-move': [slot: { start: string; end: string }]
  'drag-end': []
}>()

const dragDrop = useDragDrop()

const isDragging = computed(() => dragDrop.isDragging())
const previewSlot = computed(() => dragDrop.previewSlot())
const draggedEvent = computed(() => dragDrop.draggedEvent())

const handleMouseDown = (event: MouseEvent) => {
  // Emit to parent to handle event selection and drag start
  emit('drag-start', event)
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value || !draggedEvent.value) return
  
  // Calculate target slot from mouse position
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const mouseY = event.clientY - rect.top
  
  // Calculate duration from dragged event
  const eventStart = new Date(draggedEvent.value.start)
  const eventEnd = new Date(draggedEvent.value.end)
  const durationMinutes = (eventEnd.getTime() - eventStart.getTime()) / 60000
  
  // Calculate target slot
  const slot = dragDrop.calculateTargetSlot(
    mouseY,
    0, // containerTop offset
    props.pxPerMinute,
    durationMinutes
  )
  
  // Emit to parent to update preview
  emit('drag-move', slot)
}

const handleMouseUp = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  // Emit to parent to confirm reschedule
  emit('drag-end')
}

const handleMouseLeave = () => {
  if (isDragging.value) {
    dragDrop.cancelDrag()
  }
}

const getPreviewStyle = () => {
  if (!previewSlot.value) return {}
  
  const start = new Date(previewSlot.value.start)
  const end = new Date(previewSlot.value.end)
  
  const minutesFromDayStart = start.getHours() * 60 + start.getMinutes()
  const durationMinutes = (end.getTime() - start.getTime()) / 60000
  
  return {
    top: `${minutesFromDayStart * props.pxPerMinute}px`,
    height: `${durationMinutes * props.pxPerMinute}px`
  }
}
</script>

<style scoped>
.interaction-layer {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 4;
  cursor: grab;
  pointer-events: none;
}

.interaction-layer:active {
  pointer-events: auto;
}

.interaction-layer:active {
  cursor: grabbing;
}

.preview-slot {
  position: absolute;
  left: 8px;
  right: 8px;
  background: rgba(76, 175, 80, 0.3);
  border: 2px dashed #4CAF50;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.preview-label {
  font-size: 12px;
  color: #4CAF50;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.9);
  padding: 4px 8px;
  border-radius: 4px;
}
</style>
