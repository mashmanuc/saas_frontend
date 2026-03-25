<template>
  <div class="image-properties">
    <!-- Phase 34 B3.5: Image properties -->
    <div class="image-properties__section">
      <div class="image-properties__label">Image</div>
      
      <!-- Width input -->
      <label class="image-properties__input-group">
        <span>Width</span>
        <input
          type="number"
          :value="Math.round(object.w || 0)"
          :disabled="isLocked"
          min="10"
          step="1"
          @input="onWidthChange"
        />
      </label>

      <!-- Height input -->
      <label class="image-properties__input-group">
        <span>Height</span>
        <input
          type="number"
          :value="Math.round(object.h || 0)"
          :disabled="isLocked"
          min="10"
          step="1"
          @input="onHeightChange"
        />
      </label>

      <!-- Aspect ratio lock -->
      <label class="image-properties__checkbox">
        <input
          type="checkbox"
          :checked="lockAspect"
          :disabled="isLocked"
          @change="lockAspect = !lockAspect"
        />
        <span>🔗 Maintain aspect ratio</span>
      </label>

      <!-- Phase 35 B4: Opacity slider (0-100%) -->
      <div class="image-properties__slider-row">
        <label class="image-properties__slider-label">Opacity</label>
        <div class="image-properties__slider-group">
          <input
            type="range"
            class="image-properties__slider"
            :value="Math.round((object.opacity ?? 1) * 100)"
            :disabled="isLocked"
            min="0"
            max="100"
            step="1"
            @input="onOpacityInput"
          />
          <span class="image-properties__slider-value">{{ Math.round((object.opacity ?? 1) * 100) }}%</span>
        </div>
      </div>

      <!-- Phase 35 B4: Border radius slider (FIX-8: max 20px) -->
      <div class="image-properties__slider-row">
        <label class="image-properties__slider-label">Corners</label>
        <div class="image-properties__slider-group">
          <input
            type="range"
            class="image-properties__slider"
            :value="object.borderRadius ?? 0"
            :disabled="isLocked"
            min="0"
            max="20"
            step="1"
            @input="onBorderRadiusInput"
          />
          <span class="image-properties__slider-value">{{ object.borderRadius ?? 0 }}px</span>
        </div>
      </div>
    </div>

    <!-- Phase 34 B3.5: Common properties -->
    <CommonProperties
      :object-id="object.id"
      :store="store"
      :is-locked="isLocked"
      :x="object.x"
      :y="object.y"
      :width="object.w"
      :height="object.h"
      :show-size="false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B3.5: ImageProperties — для image assets
 * 
 * Width/height inputs з aspect ratio lock toggle.
 */
import { ref, computed } from 'vue'
import type { useWBStore } from '../../../board/state/boardStore'
import type { WBAsset } from '../../../types/winterboard'
import CommonProperties from './CommonProperties.vue'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{
  object: WBAsset
  objectType: string
  isLocked: boolean
  store: WBStore
}>()

// Phase 34 B3.5: Aspect ratio lock
const lockAspect = ref(true)
const aspectRatio = computed(() => (props.object.w || 1) / (props.object.h || 1))

function onWidthChange(event: Event) {
  const w = Number((event.target as HTMLInputElement).value)
  
  if (lockAspect.value) {
    const h = Math.round(w / aspectRatio.value)
    props.store.updateObject(props.object.id, { w, h })
  } else {
    props.store.updateObject(props.object.id, { w })
  }
}

function onHeightChange(event: Event) {
  const h = Number((event.target as HTMLInputElement).value)

  if (lockAspect.value) {
    const w = Math.round(h * aspectRatio.value)
    props.store.updateObject(props.object.id, { w, h })
  } else {
    props.store.updateObject(props.object.id, { h })
  }
}

// Phase 35 B4: Opacity control (0-100% → 0-1)
function onOpacityInput(e: Event) {
  const pct = Number((e.target as HTMLInputElement).value)
  props.store.updateObject(props.object.id, { opacity: pct / 100 })
}

// Phase 35 B4: Border radius control (FIX-8: cap at 20px)
function onBorderRadiusInput(e: Event) {
  const val = Math.min(Number((e.target as HTMLInputElement).value), 20)
  props.store.updateObject(props.object.id, { borderRadius: val })
}
</script>

<style scoped>
.image-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.image-properties__section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.image-properties__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.image-properties__input-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.image-properties__input-group input {
  width: 100px;
  padding: 6px 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}

.image-properties__input-group input:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.image-properties__input-group input:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

.image-properties__checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
  cursor: pointer;
  padding: 8px 0;
}

.image-properties__checkbox input[type="checkbox"] {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.image-properties__checkbox input[type="checkbox"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Phase 35 B4: Slider styles */
.image-properties__slider-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.image-properties__slider-label {
  min-width: 56px;
  color: var(--wb-text-secondary, #6b7280);
  font-size: 13px;
}

.image-properties__slider-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.image-properties__slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--wb-border-color, #e5e7eb);
  border-radius: 2px;
  outline: none;
}

.image-properties__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066ff);
  cursor: pointer;
}

.image-properties__slider:disabled {
  opacity: 0.5;
}

.image-properties__slider:disabled::-webkit-slider-thumb {
  cursor: not-allowed;
}

.image-properties__slider-value {
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
  min-width: 40px;
  text-align: right;
}
</style>
