<template>
  <div class="shape-properties">
    <!-- Phase 34 B3.4: Shape properties -->
    <div class="shape-properties__section">
      <div class="shape-properties__label">Shape</div>

      <!-- Stroke color -->
      <label class="shape-properties__color-group">
        <span>Stroke color</span>
        <input
          type="color"
          :value="object.color || '#000000'"
          :disabled="isLocked"
          @input="onStrokeColorChange"
        />
      </label>

      <!-- Stroke width slider -->
      <label class="shape-properties__slider-group">
        <span>Stroke width</span>
        <div class="shape-properties__slider-row">
          <input
            type="range"
            :value="object.size || 2"
            :disabled="isLocked"
            min="1"
            max="10"
            step="1"
            @input="onStrokeWidthChange"
          />
          <span class="shape-properties__slider-value">{{ object.size || 2 }}</span>
        </div>
      </label>
    </div>

    <!-- Phase 34 B3.4: Common properties (position from points[0], size from width/height) -->
    <CommonProperties
      :object-id="object.id"
      :store="store"
      :is-locked="isLocked"
      :x="shapeX"
      :y="shapeY"
      :width="object.width"
      :height="object.height"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B3.4: ShapeProperties — для rectangle, circle, line strokes
 *
 * Stroke color (=color), stroke width (=size).
 * Position derived from points[0].
 */
import { computed } from 'vue'
import type { useWBStore } from '../../../board/state/boardStore'
import type { WBStroke } from '../../../types/winterboard'
import CommonProperties from './CommonProperties.vue'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{
  object: WBStroke
  objectType: string
  isLocked: boolean
  store: WBStore
}>()

// Shapes store position in points[0]
const shapeX = computed(() => props.object.points?.[0]?.x ?? 0)
const shapeY = computed(() => props.object.points?.[0]?.y ?? 0)

function onStrokeColorChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  props.store.updateObject(props.object.id, { color: value })
}

function onStrokeWidthChange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  props.store.updateObject(props.object.id, { size: value })
}
</script>

<style scoped>
.shape-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.shape-properties__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shape-properties__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.shape-properties__color-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.shape-properties__color-group input[type="color"] {
  width: 48px;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
}

.shape-properties__color-group input[type="color"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shape-properties__slider-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.shape-properties__slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.shape-properties__slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--wb-bg-secondary, #e5e7eb);
  outline: none;
  -webkit-appearance: none;
}

.shape-properties__slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066ff);
  cursor: pointer;
}

.shape-properties__slider-row input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066ff);
  cursor: pointer;
  border: none;
}

.shape-properties__slider-row input[type="range"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.shape-properties__slider-value {
  min-width: 24px;
  text-align: right;
  font-size: 12px;
  font-weight: 500;
  color: var(--wb-text-primary, #111827);
}
</style>
