<template>
  <div class="common-properties">
    <!-- Phase 34 B2: Position -->
    <div class="common-properties__section">
      <div class="common-properties__label">Position</div>
      <div class="common-properties__row">
        <label class="common-properties__input-group">
          <span>X</span>
          <input
            type="number"
            :value="Math.round(x)"
            :disabled="isLocked"
            step="1"
            @input="onInputDebounced('x', $event)"
          />
        </label>
        <label class="common-properties__input-group">
          <span>Y</span>
          <input
            type="number"
            :value="Math.round(y)"
            :disabled="isLocked"
            step="1"
            @input="onInputDebounced('y', $event)"
          />
        </label>
      </div>
    </div>

    <!-- Phase 34 B2: Size (optional) -->
    <div v-if="showSize" class="common-properties__section">
      <div class="common-properties__label">Size</div>
      <div class="common-properties__row">
        <label class="common-properties__input-group">
          <span>W</span>
          <input
            type="number"
            :value="Math.round(width ?? 0)"
            :disabled="isLocked"
            min="1"
            step="1"
            @input="onInputDebounced('w', $event)"
          />
        </label>
        <label class="common-properties__input-group">
          <span>H</span>
          <input
            type="number"
            :value="Math.round(height ?? 0)"
            :disabled="isLocked"
            min="1"
            step="1"
            @input="onInputDebounced('h', $event)"
          />
        </label>
      </div>
    </div>

    <!-- Phase 34 B2: Z-order -->
    <div class="common-properties__section">
      <div class="common-properties__label">Z-Order</div>
      <div class="common-properties__z-order">
        <button
          type="button"
          class="common-properties__z-btn"
          :disabled="isLocked"
          :title="'Bring Forward'"
          @click="store.bringForward(objectId)"
        >
          ↑ Forward
        </button>
        <button
          type="button"
          class="common-properties__z-btn"
          :disabled="isLocked"
          :title="'Send Backward'"
          @click="store.sendBackward(objectId)"
        >
          ↓ Backward
        </button>
        <button
          type="button"
          class="common-properties__z-btn"
          :disabled="isLocked"
          :title="'Bring to Front'"
          @click="store.bringToFront(objectId)"
        >
          ⤴ To Front
        </button>
        <button
          type="button"
          class="common-properties__z-btn"
          :disabled="isLocked"
          :title="'Send to Back'"
          @click="store.sendToBack(objectId)"
        >
          ⤵ To Back
        </button>
      </div>
    </div>

    <!-- Phase 34 B2: Lock toggle -->
    <div class="common-properties__section">
      <div
        class="common-properties__lock"
        :class="{ 'common-properties__lock--locked': isLocked }"
      >
        <span class="common-properties__lock-icon">
          {{ isLocked ? '🔒' : '🔓' }}
        </span>
        <span class="common-properties__lock-label">
          {{ isLocked ? 'Locked' : 'Unlocked' }}
        </span>
        <button
          type="button"
          class="common-properties__lock-btn"
          @click="toggleLock"
        >
          {{ isLocked ? 'Unlock' : 'Lock' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B2: CommonProperties — position, size, z-order, lock
 * 
 * Спільний блок для всіх properties-компонентів.
 * Read-only mode коли isLocked === true.
 */
import { ref } from 'vue'
import type { useWBStore } from '../../../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

const props = withDefaults(defineProps<{
  objectId: string
  store: WBStore
  isLocked: boolean
  x: number
  y: number
  width?: number
  height?: number
  showSize?: boolean
}>(), {
  showSize: true,
})

// Phase 34 B2: Debounced update to avoid spam
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onInputDebounced(field: string, event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  
  if (debounceTimer) clearTimeout(debounceTimer)
  
  debounceTimer = setTimeout(() => {
    props.store.updateObject(props.objectId, { [field]: value })
  }, 150)
}

function toggleLock() {
  if (props.isLocked) {
    props.store.unlockItems([props.objectId])
  } else {
    props.store.lockItems([props.objectId])
  }
}
</script>

<style scoped>
.common-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.common-properties__section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.common-properties__label {
  font-size: 12px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.common-properties__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.common-properties__input-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
}

.common-properties__input-group input {
  padding: 6px 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}

.common-properties__input-group input:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
}

.common-properties__input-group input:focus {
  outline: none;
  border-color: var(--wb-brand, #0066ff);
}

/* Z-order buttons */
.common-properties__z-order {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}

.common-properties__z-btn {
  padding: 6px 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.common-properties__z-btn:hover:not(:disabled) {
  background: var(--wb-bg-secondary, #f3f4f6);
  border-color: var(--wb-brand, #0066ff);
}

.common-properties__z-btn:disabled {
  background: var(--wb-bg-secondary, #f3f4f6);
  color: var(--wb-text-tertiary, #9ca3af);
  cursor: not-allowed;
  opacity: 0.5;
}

/* Lock section */
.common-properties__lock {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 8px;
  background: var(--wb-bg-primary, #ffffff);
}

.common-properties__lock--locked {
  background: rgba(255, 165, 0, 0.1);
  border-color: rgba(255, 165, 0, 0.3);
}

.common-properties__lock-icon {
  font-size: 16px;
}

.common-properties__lock-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--wb-text-primary, #111827);
}

.common-properties__lock-btn {
  padding: 4px 12px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease;
}

.common-properties__lock-btn:hover {
  background: var(--wb-bg-secondary, #f3f4f6);
}
</style>
