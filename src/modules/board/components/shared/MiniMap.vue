<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { Viewport, Layer } from '@/core/board/types'

interface Props {
  viewport: Viewport
  layers: Layer[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'navigate', x: number, y: number): void
}>()

const mapWidth = 150
const mapHeight = 100
const scale = 0.02 // Scale factor for minimap

const viewportRect = computed(() => {
  const { x, y, width, height, zoom } = props.viewport
  return {
    x: x * scale,
    y: y * scale,
    width: (width / zoom) * scale,
    height: (height / zoom) * scale,
  }
})

function handleClick(e: MouseEvent) {
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  const x = (e.clientX - rect.left) / scale
  const y = (e.clientY - rect.top) / scale
  emit('navigate', x, y)
}
</script>

<template>
  <div class="mini-map" @click="handleClick">
    <svg :width="mapWidth" :height="mapHeight" class="map-canvas">
      <!-- Background -->
      <rect width="100%" height="100%" fill="#f5f5f5" />

      <!-- Grid -->
      <defs>
        <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
          <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e0e0e0" stroke-width="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />

      <!-- Viewport indicator -->
      <rect
        :x="viewportRect.x"
        :y="viewportRect.y"
        :width="Math.max(viewportRect.width, 10)"
        :height="Math.max(viewportRect.height, 10)"
        fill="rgba(59, 130, 246, 0.2)"
        stroke="#3b82f6"
        stroke-width="1"
        rx="2"
      />
    </svg>

    <div class="zoom-label">{{ Math.round(viewport.zoom * 100) }}%</div>
  </div>
</template>

<style scoped>
.mini-map {
  position: absolute;
  bottom: 1rem;
  left: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  cursor: pointer;
}

.map-canvas {
  display: block;
}

.zoom-label {
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 2px 6px;
  background: rgba(0, 0, 0, 0.6);
  color: white;
  font-size: 10px;
  border-radius: 4px;
}
</style>
