<template>
  <div class="stroke-properties">
    <!-- Phase 34 B3.1: Stroke properties -->
    <div class="stroke-properties__section">
      <div class="stroke-properties__label">Stroke</div>
      
      <!-- Color picker -->
      <label class="stroke-properties__color-group">
        <span>Color</span>
        <input
          type="color"
          :value="object.color || '#000000'"
          :disabled="isLocked"
          @input="onColorChange"
        />
      </label>

      <!-- Size slider -->
      <label class="stroke-properties__slider-group">
        <span>Size</span>
        <div class="stroke-properties__slider-row">
          <input
            type="range"
            :value="object.size || 2"
            :disabled="isLocked"
            min="1"
            max="20"
            step="1"
            @input="onSizeChange"
          />
          <span class="stroke-properties__slider-value">{{ object.size || 2 }}</span>
        </div>
      </label>
    </div>

    <!-- Phase 34 B3.1: Common properties (position from points[0], no size for freehand) -->
    <CommonProperties
      :object-id="object.id"
      :store="store"
      :is-locked="isLocked"
      :x="object.points?.[0]?.x ?? 0"
      :y="object.points?.[0]?.y ?? 0"
      :show-size="false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B3.1: StrokeProperties — для pen та highlighter strokes
 * 
 * Color picker + size slider (1-20).
 */
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

function onColorChange(event: Event) {
  const value = (event.target as HTMLInputElement).value
  props.store.updateObject(props.object.id, { color: value })
}

function onSizeChange(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  props.store.updateObject(props.object.id, { size: value })
}
</script>

<style scoped>
.stroke-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stroke-properties__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stroke-properties__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stroke-properties__color-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.stroke-properties__color-group input[type="color"] {
  width: 48px;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
}

.stroke-properties__color-group input[type="color"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stroke-properties__slider-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.stroke-properties__slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stroke-properties__slider-row input[type="range"] {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--wb-bg-secondary, #e5e7eb);
  outline: none;
  -webkit-appearance: none;
}

.stroke-properties__slider-row input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066ff);
  cursor: pointer;
}

.stroke-properties__slider-row input[type="range"]::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066ff);
  cursor: pointer;
  border: none;
}

.stroke-properties__slider-row input[type="range"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stroke-properties__slider-value {
  min-width: 24px;
  text-align: right;
  font-size: 12px;
  font-weight: 500;
  color: var(--wb-text-primary, #111827);
}
</style>
