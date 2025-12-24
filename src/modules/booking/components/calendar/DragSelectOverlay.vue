<template>
  <div
    class="drag-select-overlay"
    ref="overlayRef"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <slot />
    
    <div
      v-if="isSelecting"
      class="selection-box"
      :style="selectionBoxStyle"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  select: [cells: string[]]
}>()

const overlayRef = ref<HTMLElement | null>(null)
const isSelecting = ref(false)
const startX = ref(0)
const startY = ref(0)
const currentX = ref(0)
const currentY = ref(0)
const selectionFramePending = ref(false)

const selectionBoxStyle = computed(() => ({
  left: `${Math.min(startX.value, currentX.value)}px`,
  top: `${Math.min(startY.value, currentY.value)}px`,
  width: `${Math.abs(currentX.value - startX.value)}px`,
  height: `${Math.abs(currentY.value - startY.value)}px`,
}))

function handleMouseDown(event: MouseEvent) {
  const target = event.target as HTMLElement
  if (!target.closest('.calendar-cell')) return
  
  isSelecting.value = true
  startX.value = event.clientX
  startY.value = event.clientY
  currentX.value = event.clientX
  currentY.value = event.clientY
}

function handleMouseMove(event: MouseEvent) {
  if (!isSelecting.value) return

  if (selectionFramePending.value) return
  selectionFramePending.value = true

  requestAnimationFrame(() => {
    currentX.value = event.clientX
    currentY.value = event.clientY
    selectionFramePending.value = false
  })
}

function handleMouseUp() {
  if (!isSelecting.value) return
  
  const selectedCells = findCellsInBox({
    left: Math.min(startX.value, currentX.value),
    top: Math.min(startY.value, currentY.value),
    right: Math.max(startX.value, currentX.value),
    bottom: Math.max(startY.value, currentY.value),
  })
  
  emit('select', selectedCells)
  
  isSelecting.value = false
}

function findCellsInBox(box: { left: number; top: number; right: number; bottom: number }): string[] {
  const cells: string[] = []
  const root = overlayRef.value ?? document.body
  const cellElements = root.querySelectorAll<HTMLElement>('[data-utc-key]')
  
  cellElements.forEach(el => {
    const rect = el.getBoundingClientRect()
    
    if (
      rect.left < box.right &&
      rect.right > box.left &&
      rect.top < box.bottom &&
      rect.bottom > box.top
    ) {
      const utcKey = el.getAttribute('data-utc-key')
      if (utcKey) cells.push(utcKey)
    }
  })
  
  return cells
}
</script>

<style scoped>
.drag-select-overlay {
  position: relative;
  user-select: none;
}

.selection-box {
  position: fixed;
  border: 2px dashed #3b82f6;
  background-color: rgba(59, 130, 246, 0.1);
  pointer-events: none;
  z-index: 1000;
}
</style>
