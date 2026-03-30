<template>
  <div class="batch-font">
    <!-- Font family -->
    <div class="batch-font__row">
      <span class="batch-font__label">Font</span>
      <select
        class="batch-font__select"
        :value="commonFont"
        @change="onFontChange"
      >
        <option v-if="commonFont === 'mixed'" value="mixed" disabled>— mixed —</option>
        <option v-for="f in AVAILABLE_FONTS" :key="f.value" :value="f.value">{{ f.label }}</option>
      </select>
    </div>

    <!-- Font size -->
    <div class="batch-font__row">
      <span class="batch-font__label">Size</span>
      <input
        type="number"
        class="batch-font__input"
        :value="commonSize !== 'mixed' ? commonSize : ''"
        :placeholder="commonSize === 'mixed' ? 'mixed' : ''"
        min="8"
        max="200"
        step="1"
        @change="onSizeChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 36: BatchFontControl — batch font/size for selected text and sticky items.
 */
import { computed } from 'vue'
import type { WBStroke, WBAsset } from '../../../types/winterboard'
import type { useWBStore } from '../../../board/state/boardStore'
import { AVAILABLE_FONTS } from '../../../constants/fonts'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{ store: WBStore }>()

// Collect text-like items (text strokes + sticky assets)
const textItems = computed(() => {
  const result: Array<{ id: string; obj: WBStroke | WBAsset; kind: 'stroke' | 'asset' }> = []
  for (const id of props.store.selectedIds) {
    const obj = props.store.getObjectById(id)
    if (!obj) continue
    const type = props.store.getObjectType(obj)
    if (type === 'text') {
      result.push({ id, obj, kind: 'stroke' })
    } else if (type === 'sticky') {
      result.push({ id, obj, kind: 'asset' })
    }
  }
  return result
})

const commonFont = computed<string>(() => {
  const items = textItems.value
  if (items.length === 0) return 'mixed'
  const first = (items[0].obj as unknown as Record<string, unknown>).fontFamily as string | undefined ?? 'Inter'
  return items.every(i => ((i.obj as unknown as Record<string, unknown>).fontFamily as string | undefined ?? 'Inter') === first) ? first : 'mixed'
})

const commonSize = computed<number | 'mixed'>(() => {
  const items = textItems.value
  if (items.length === 0) return 'mixed'
  // text strokes use 'size', sticky assets use 'fontSize'
  function getSize(item: typeof items[0]): number {
    if (item.kind === 'stroke') return (item.obj as WBStroke).size ?? 16
    return (item.obj as WBAsset).fontSize ?? 16
  }
  const first = getSize(items[0])
  return items.every(i => getSize(i) === first) ? first : 'mixed'
})

function onFontChange(e: Event) {
  const fontFamily = (e.target as HTMLSelectElement).value
  if (fontFamily === 'mixed') return
  const updates = textItems.value
    .filter(i => !props.store.isItemLocked(i.id))
    .map(i => ({ id: i.id, changes: { fontFamily } }))
  if (updates.length > 0) {
    props.store.batchUpdateObjects(updates)
  }
}

function onSizeChange(e: Event) {
  const val = Number((e.target as HTMLInputElement).value)
  if (!val || val < 8 || val > 200) return
  const updates = textItems.value
    .filter(i => !props.store.isItemLocked(i.id))
    .map(i => ({
      id: i.id,
      // text strokes use 'size', sticky assets use 'fontSize'
      changes: i.kind === 'stroke' ? { size: val } : { fontSize: val },
    }))
  if (updates.length > 0) {
    props.store.batchUpdateObjects(updates)
  }
}
</script>

<style scoped>
.batch-font {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.batch-font__row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.batch-font__label {
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
  min-width: 48px;
}
.batch-font__select {
  flex: 1;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  cursor: pointer;
}
.batch-font__input {
  width: 80px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 6px;
  font-size: 13px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
}
.batch-font__input::placeholder {
  color: var(--wb-text-secondary, #6b7280);
  font-style: italic;
}
</style>
