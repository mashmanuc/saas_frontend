<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useBoardStore } from '@/stores/boardStore'

const boardStore = useBoardStore()
const { remoteCursors } = storeToRefs(boardStore)

const canvasRef = ref<HTMLCanvasElement | null>(null)
</script>

<template>
  <div class="board-canvas">
    <canvas ref="canvasRef" class="main-canvas" />
    
    <!-- Remote cursors overlay -->
    <div class="cursors-overlay">
      <div
        v-for="cursor in remoteCursors"
        :key="cursor.userId"
        class="remote-cursor"
        :style="{
          left: `${cursor.x}px`,
          top: `${cursor.y}px`,
          '--cursor-color': cursor.color,
        }"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.86a.5.5 0 0 0-.85.35z" />
        </svg>
        <span class="cursor-label">{{ cursor.userName }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.board-canvas {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.main-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.cursors-overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.remote-cursor {
  position: absolute;
  transform: translate(-2px, -2px);
  color: var(--cursor-color, #3b82f6);
  transition: left 0.1s, top 0.1s;
}

.cursor-label {
  position: absolute;
  left: 16px;
  top: 16px;
  padding: 2px 6px;
  background: var(--cursor-color, #3b82f6);
  color: white;
  font-size: 11px;
  border-radius: 4px;
  white-space: nowrap;
}
</style>
