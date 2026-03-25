<template>
  <div class="alignment-tools">
    <div class="alignment-tools__label">Alignment</div>
    <div class="alignment-tools__row">
      <button
        type="button"
        class="alignment-tools__btn"
        :disabled="!canAlign"
        title="Align Left"
        @click="align.alignLeft()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="2" height="14" rx="0.5" fill="currentColor"/>
          <rect x="5" y="3" width="8" height="4" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="5" y="9" width="5" height="4" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
      </button>
      <button
        type="button"
        class="alignment-tools__btn"
        :disabled="!canAlign"
        title="Align Center Horizontal"
        @click="align.alignCenter()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="7" y="1" width="2" height="14" rx="0.5" fill="currentColor"/>
          <rect x="3" y="3" width="10" height="4" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="4" y="9" width="8" height="4" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
      </button>
      <button
        type="button"
        class="alignment-tools__btn"
        :disabled="!canAlign"
        title="Align Right"
        @click="align.alignRight()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="13" y="1" width="2" height="14" rx="0.5" fill="currentColor"/>
          <rect x="3" y="3" width="8" height="4" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="6" y="9" width="5" height="4" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
      </button>
      <span class="alignment-tools__sep"></span>
      <button
        type="button"
        class="alignment-tools__btn"
        :disabled="!canAlign"
        title="Align Top"
        @click="align.alignTop()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="1" width="14" height="2" rx="0.5" fill="currentColor"/>
          <rect x="3" y="5" width="4" height="8" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="9" y="5" width="4" height="5" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
      </button>
      <button
        type="button"
        class="alignment-tools__btn"
        :disabled="!canAlign"
        title="Align Center Vertical"
        @click="align.alignMiddle()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="7" width="14" height="2" rx="0.5" fill="currentColor"/>
          <rect x="3" y="2" width="4" height="12" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="9" y="4" width="4" height="8" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
      </button>
      <button
        type="button"
        class="alignment-tools__btn"
        :disabled="!canAlign"
        title="Align Bottom"
        @click="align.alignBottom()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="13" width="14" height="2" rx="0.5" fill="currentColor"/>
          <rect x="3" y="3" width="4" height="8" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="9" y="6" width="4" height="5" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
      </button>
    </div>

    <!-- Distribute (requires 3+ items) -->
    <div v-if="canDistribute" class="alignment-tools__row alignment-tools__row--distribute">
      <button
        type="button"
        class="alignment-tools__btn alignment-tools__btn--wide"
        @click="align.distributeHorizontal()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="4" width="3" height="8" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="6.5" y="4" width="3" height="8" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="12" y="4" width="3" height="8" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
        <span>Distribute H</span>
      </button>
      <button
        type="button"
        class="alignment-tools__btn alignment-tools__btn--wide"
        @click="align.distributeVertical()"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="4" y="1" width="8" height="3" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="4" y="6.5" width="8" height="3" rx="1" fill="currentColor" opacity="0.6"/>
          <rect x="4" y="12" width="8" height="3" rx="1" fill="currentColor" opacity="0.6"/>
        </svg>
        <span>Distribute V</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 36: AlignmentTools — 6 align buttons + 2 distribute buttons.
 * Uses existing useAlign composable which already implements all logic.
 */
import { useAlign } from '../../../composables/useAlign'
import type { useWBStore } from '../../../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{ store: WBStore }>()

const align = useAlign(props.store)
const canAlign = align.canAlign
const canDistribute = align.canDistribute
</script>

<style scoped>
.alignment-tools {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alignment-tools__label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--wb-text-secondary, #6b7280);
}

.alignment-tools__row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.alignment-tools__row--distribute {
  gap: 6px;
}

.alignment-tools__sep {
  width: 1px;
  height: 20px;
  background: var(--wb-border-color, #e5e7eb);
  margin: 0 2px;
  flex-shrink: 0;
}

.alignment-tools__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-secondary, #6b7280);
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
  padding: 0;
}

.alignment-tools__btn:hover:not(:disabled) {
  background: var(--wb-bg-secondary, #f3f4f6);
  border-color: var(--wb-brand, #0066ff);
  color: var(--wb-brand, #0066ff);
}

.alignment-tools__btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.alignment-tools__btn--wide {
  width: auto;
  flex: 1;
  gap: 4px;
  padding: 0 8px;
  font-size: 11px;
  font-weight: 500;
}
</style>
