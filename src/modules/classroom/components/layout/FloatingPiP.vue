<template>
  <div class="floating-pip">
    <!-- Main content (board) -->
    <div class="floating-pip__main">
      <slot name="board"></slot>
    </div>

    <!-- Floating video -->
    <div
      class="floating-pip__video"
      :class="{ 'floating-pip__video--dragging': isDragging }"
      :style="videoStyle"
      @mousedown="startDrag"
    >
      <slot name="video"></slot>

      <!-- Resize handle -->
      <div class="resize-handle" @mousedown.stop="startResize"></div>

      <!-- Position buttons -->
      <div class="position-buttons">
        <button
          v-for="pos in positions"
          :key="pos"
          class="position-btn"
          :class="{ 'position-btn--active': position === pos }"
          @click="setPosition(pos)"
        >
          {{ positionIcons[pos] }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

type Position = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

// State
const position = ref<Position>('bottom-right')
const videoWidth = ref(280)
const videoHeight = ref(160)
const isDragging = ref(false)
const isResizing = ref(false)
const customX = ref<number | null>(null)
const customY = ref<number | null>(null)

// Constants
const positions: Position[] = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
const positionIcons: Record<Position, string> = {
  'top-left': '↖',
  'top-right': '↗',
  'bottom-left': '↙',
  'bottom-right': '↘',
}

// Computed
const videoStyle = computed(() => {
  const style: Record<string, string> = {
    width: `${videoWidth.value}px`,
    height: `${videoHeight.value}px`,
  }

  if (customX.value !== null && customY.value !== null) {
    style.left = `${customX.value}px`
    style.top = `${customY.value}px`
  } else {
    // Preset positions
    const margin = '16px'
    switch (position.value) {
      case 'top-left':
        style.top = margin
        style.left = margin
        break
      case 'top-right':
        style.top = margin
        style.right = margin
        break
      case 'bottom-left':
        style.bottom = margin
        style.left = margin
        break
      case 'bottom-right':
        style.bottom = margin
        style.right = margin
        break
    }
  }

  return style
})

// Methods
function setPosition(pos: Position): void {
  position.value = pos
  customX.value = null
  customY.value = null
}

function startDrag(e: MouseEvent): void {
  if (isResizing.value) return
  isDragging.value = true

  const startX = e.clientX
  const startY = e.clientY
  const startLeft = customX.value ?? 0
  const startTop = customY.value ?? 0

  function handleMove(e: MouseEvent): void {
    customX.value = startLeft + (e.clientX - startX)
    customY.value = startTop + (e.clientY - startY)
  }

  function handleUp(): void {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleUp)
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleUp)
}

function startResize(e: MouseEvent): void {
  isResizing.value = true

  const startX = e.clientX
  const startY = e.clientY
  const startWidth = videoWidth.value
  const startHeight = videoHeight.value

  function handleMove(e: MouseEvent): void {
    videoWidth.value = Math.max(200, startWidth + (e.clientX - startX))
    videoHeight.value = Math.max(120, startHeight + (e.clientY - startY))
  }

  function handleUp(): void {
    isResizing.value = false
    document.removeEventListener('mousemove', handleMove)
    document.removeEventListener('mouseup', handleUp)
  }

  document.addEventListener('mousemove', handleMove)
  document.addEventListener('mouseup', handleUp)
}
</script>

<style scoped>
.floating-pip {
  position: relative;
  width: 100%;
  height: 100%;
}

.floating-pip__main {
  width: 100%;
  height: 100%;
}

.floating-pip__video {
  position: absolute;
  background: var(--color-bg-secondary);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  cursor: move;
  z-index: 100;
}

.floating-pip__video--dragging {
  opacity: 0.8;
  cursor: grabbing;
}

.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: linear-gradient(
    135deg,
    transparent 50%,
    var(--color-border) 50%
  );
}

.position-buttons {
  position: absolute;
  top: 4px;
  right: 4px;
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.2s;
}

.floating-pip__video:hover .position-buttons {
  opacity: 1;
}

.position-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  border-radius: 4px;
  color: white;
  font-size: 0.75rem;
  cursor: pointer;
}

.position-btn:hover {
  background: rgba(0, 0, 0, 0.7);
}

.position-btn--active {
  background: var(--color-primary);
}
</style>
