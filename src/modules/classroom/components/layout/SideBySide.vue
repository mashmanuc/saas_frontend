<template>
  <div class="side-by-side">
    <div class="side-by-side__video">
      <slot name="video"></slot>
    </div>
    <div class="side-by-side__divider" @mousedown="startResize"></div>
    <div class="side-by-side__board" :style="{ width: `${100 - videoWidth}%` }">
      <slot name="board"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// State
const videoWidth = ref(30) // percentage
const isResizing = ref(false)

// Resize handlers
function startResize(e: MouseEvent): void {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
}

function handleResize(e: MouseEvent): void {
  if (!isResizing.value) return

  const container = document.querySelector('.side-by-side')
  if (!container) return

  const rect = container.getBoundingClientRect()
  const newWidth = ((e.clientX - rect.left) / rect.width) * 100

  // Clamp between 20% and 50%
  videoWidth.value = Math.max(20, Math.min(50, newWidth))
}

function stopResize(): void {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.side-by-side {
  display: flex;
  width: 100%;
  height: 100%;
}

.side-by-side__video {
  width: 30%;
  min-width: 200px;
  max-width: 50%;
  height: 100%;
  padding: 8px;
}

.side-by-side__divider {
  width: 4px;
  background: var(--color-border);
  cursor: col-resize;
  transition: background 0.2s;
}

.side-by-side__divider:hover {
  background: var(--color-primary);
}

.side-by-side__board {
  flex: 1;
  height: 100%;
  padding: 8px;
}
</style>
