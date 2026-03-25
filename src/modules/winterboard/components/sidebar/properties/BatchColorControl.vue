<template>
  <div class="batch-color">
    <label class="batch-color__row">
      <span class="batch-color__label">Color</span>
      <div class="batch-color__input-wrap">
        <input
          type="color"
          class="batch-color__picker"
          :value="commonColor !== 'mixed' ? commonColor : '#000000'"
          @input="onColorChange"
        />
        <span class="batch-color__value">{{ commonColor === 'mixed' ? '— mixed —' : commonColor }}</span>
      </div>
    </label>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 36: BatchColorControl — batch color picker for selected strokes.
 * Shows common value or "mixed" when colors differ.
 */
import { computed } from 'vue'
import type { WBStroke } from '../../../types/winterboard'
import type { useWBStore } from '../../../board/state/boardStore'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{ store: WBStore }>()

const selectedStrokes = computed(() => {
  const result: WBStroke[] = []
  for (const id of props.store.selectedIds) {
    const obj = props.store.getObjectById(id)
    if (obj && 'tool' in obj) result.push(obj as WBStroke)
  }
  return result
})

const commonColor = computed<string>(() => {
  const strokes = selectedStrokes.value
  if (strokes.length === 0) return 'mixed'
  const first = strokes[0].color
  return strokes.every(s => s.color === first) ? first : 'mixed'
})

function onColorChange(e: Event) {
  const color = (e.target as HTMLInputElement).value
  const updates = props.store.selectedIds
    .filter(id => {
      const obj = props.store.getObjectById(id)
      return obj && 'tool' in obj && !props.store.isItemLocked(id)
    })
    .map(id => ({ id, changes: { color } }))
  if (updates.length > 0) {
    props.store.batchUpdateObjects(updates)
  }
}
</script>

<style scoped>
.batch-color__row {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}
.batch-color__label {
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
  min-width: 48px;
}
.batch-color__input-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
}
.batch-color__picker {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  cursor: pointer;
  background: none;
}
.batch-color__value {
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
}
</style>
