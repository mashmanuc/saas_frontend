<template>
  <div class="multi-select-info">
    <!-- Phase 34 B4: Multi-select summary -->
    <div class="multi-select-info__header">
      <div class="multi-select-info__count">{{ count }} items selected</div>
      <div class="multi-select-info__breakdown">
        <span v-if="breakdown.strokes > 0">{{ breakdown.strokes }} stroke{{ breakdown.strokes > 1 ? 's' : '' }}</span>
        <span v-if="breakdown.strokes > 0 && breakdown.assets > 0"> · </span>
        <span v-if="breakdown.assets > 0">{{ breakdown.assets }} asset{{ breakdown.assets > 1 ? 's' : '' }}</span>
      </div>
      <div v-if="breakdown.locked > 0" class="multi-select-info__locked">
        {{ breakdown.locked }} locked
      </div>
    </div>

    <!-- Phase 34 B4: Actions -->
    <div class="multi-select-info__actions">
      <button
        type="button"
        class="multi-select-info__btn multi-select-info__btn--lock"
        :disabled="!hasUnlocked"
        @click="lockAll"
      >
        🔒 Lock all
      </button>
      <button
        type="button"
        class="multi-select-info__btn multi-select-info__btn--unlock"
        :disabled="!hasLocked"
        @click="unlockAll"
      >
        🔓 Unlock all
      </button>
      <button
        type="button"
        class="multi-select-info__btn multi-select-info__btn--delete"
        :disabled="!hasUnlocked"
        @click="emit('delete-selected')"
      >
        🗑 Delete selected
      </button>
    </div>

    <!-- Phase 34 B4: Future features placeholder -->
    <div class="multi-select-info__note">
      Alignment and batch edit coming in Phase 36
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 34 B4: MultiSelectInfo — інформація та дії для multi-select
 * 
 * Показує кількість, breakdown (strokes/assets/locked), lock/unlock/delete actions.
 */
import { computed } from 'vue'
import type { useWBStore } from '../../../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{ store: WBStore }>()

const emit = defineEmits<{
  'delete-selected': []
}>()

const count = computed(() => props.store.selectedIds.length)

// Phase 34 B4: Breakdown by type and lock status
const breakdown = computed(() => {
  let strokes = 0
  let assets = 0
  let locked = 0
  
  for (const id of props.store.selectedIds) {
    const obj = props.store.getObjectById(id)
    if (!obj) continue
    
    // Check if stroke (has 'tool' property) or asset
    if ('tool' in obj) {
      strokes++
    } else {
      assets++
    }
    
    if (props.store.isItemLocked(id)) {
      locked++
    }
  }
  
  return { strokes, assets, locked }
})

const hasUnlocked = computed(() => breakdown.value.locked < count.value)
const hasLocked = computed(() => breakdown.value.locked > 0)

function lockAll() {
  const unlocked = props.store.selectedIds.filter(id => !props.store.isItemLocked(id))
  if (unlocked.length > 0) {
    props.store.lockItems(unlocked)
  }
}

function unlockAll() {
  const locked = props.store.selectedIds.filter(id => props.store.isItemLocked(id))
  if (locked.length > 0) {
    props.store.unlockItems(locked)
  }
}
</script>

<style scoped>
.multi-select-info {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.multi-select-info__header {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  background: var(--wb-bg-secondary, #f3f4f6);
  border-radius: 8px;
}

.multi-select-info__count {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
}

.multi-select-info__breakdown {
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}

.multi-select-info__locked {
  font-size: 12px;
  color: var(--wb-warning, #f59e0b);
  font-weight: 500;
}

.multi-select-info__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.multi-select-info__btn {
  padding: 10px 12px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 8px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
  text-align: left;
}

.multi-select-info__btn:hover:not(:disabled) {
  background: var(--wb-bg-secondary, #f3f4f6);
  border-color: var(--wb-brand, #0066ff);
}

.multi-select-info__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.multi-select-info__btn--delete {
  color: #ef4444;
  border-color: #ef4444;
}

.multi-select-info__btn--delete:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.1);
}

.multi-select-info__note {
  padding: 8px 12px;
  background: rgba(99, 102, 241, 0.1);
  border-radius: 6px;
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
  font-style: italic;
  text-align: center;
}
</style>
