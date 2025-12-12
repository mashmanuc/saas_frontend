<script setup lang="ts">
import { ZoomIn, ZoomOut, Maximize, RotateCcw } from 'lucide-vue-next'

interface Props {
  zoom: number
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
  (e: 'zoom-reset'): void
  (e: 'fit-content'): void
}>()

const zoomLevels = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3]
</script>

<template>
  <div class="zoom-controls">
    <button class="zoom-btn" title="Zoom Out (-)" @click="emit('zoom-out')">
      <ZoomOut :size="18" />
    </button>

    <div class="zoom-value">
      {{ Math.round(zoom * 100) }}%
    </div>

    <button class="zoom-btn" title="Zoom In (+)" @click="emit('zoom-in')">
      <ZoomIn :size="18" />
    </button>

    <div class="zoom-divider" />

    <button class="zoom-btn" title="Fit to Content (1)" @click="emit('fit-content')">
      <Maximize :size="18" />
    </button>

    <button class="zoom-btn" title="Reset View (0)" @click="emit('zoom-reset')">
      <RotateCcw :size="18" />
    </button>
  </div>
</template>

<style scoped>
.zoom-controls {
  position: absolute;
  bottom: 1rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.zoom-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.zoom-btn:hover {
  background: #f0f0f0;
  color: #333;
}

.zoom-value {
  min-width: 50px;
  text-align: center;
  font-size: 0.8125rem;
  font-weight: 500;
  color: #333;
}

.zoom-divider {
  width: 1px;
  height: 20px;
  background: #e0e0e0;
  margin: 0 0.25rem;
}
</style>
