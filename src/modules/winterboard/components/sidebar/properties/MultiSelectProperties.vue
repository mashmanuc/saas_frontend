<template>
  <div class="msp">
    <!-- Header: selection summary -->
    <div class="msp__header">
      <div class="msp__count">{{ count }} items selected</div>
      <div class="msp__breakdown">
        <span v-if="breakdown.strokes > 0">{{ breakdown.strokes }} stroke{{ breakdown.strokes > 1 ? 's' : '' }}</span>
        <span v-if="breakdown.strokes > 0 && breakdown.assets > 0"> · </span>
        <span v-if="breakdown.assets > 0">{{ breakdown.assets }} asset{{ breakdown.assets > 1 ? 's' : '' }}</span>
      </div>
      <div v-if="breakdown.locked > 0" class="msp__locked">
        {{ breakdown.locked }} locked
      </div>
    </div>

    <!-- Alignment Tools -->
    <AlignmentTools :store="store" />

    <!-- Batch Color (visible when strokes selected) -->
    <BatchColorControl v-if="hasStrokes" :store="store" />

    <!-- Batch Font (visible when text/sticky selected) -->
    <BatchFontControl v-if="hasText" :store="store" />

    <!-- Batch Opacity (visible when images selected) -->
    <div v-if="hasImages" class="msp__opacity">
      <div class="msp__opacity-row">
        <span class="msp__opacity-label">Opacity</span>
        <div class="msp__opacity-group">
          <input
            type="range"
            class="msp__opacity-slider"
            :value="commonOpacity !== 'mixed' ? Math.round(commonOpacity * 100) : 100"
            min="0"
            max="100"
            step="1"
            @input="onOpacityChange"
          />
          <span class="msp__opacity-value">
            {{ commonOpacity === 'mixed' ? '—' : Math.round(commonOpacity * 100) + '%' }}
          </span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="msp__section-label">Actions</div>
    <div class="msp__actions">
      <!-- Group/Ungroup -->
      <button
        v-if="canGroup"
        type="button"
        class="msp__btn"
        @click="grouping.groupSelected()"
      >
        Group
      </button>
      <button
        v-if="canUngroup"
        type="button"
        class="msp__btn"
        @click="grouping.ungroupSelected()"
      >
        Ungroup
      </button>

      <!-- Lock/Unlock -->
      <button
        type="button"
        class="msp__btn"
        :disabled="!hasUnlocked"
        @click="lockAll"
      >
        🔒 Lock all
      </button>
      <button
        type="button"
        class="msp__btn"
        :disabled="!hasLocked"
        @click="unlockAll"
      >
        🔓 Unlock all
      </button>

      <!-- Delete -->
      <button
        type="button"
        class="msp__btn msp__btn--delete"
        :disabled="!hasUnlocked"
        @click="emit('delete-selected')"
      >
        🗑 Delete selected
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 36: MultiSelectProperties — повна панель для multi-select.
 * Замінює Phase 34 MultiSelectInfo. Додає alignment, batch editing, group/ungroup.
 */
import { computed } from 'vue'
import type { WBAsset } from '../../../types/winterboard'
import type { useWBStore } from '../../../board/state/boardStore'
import { useGrouping } from '../../../composables/useGrouping'
import AlignmentTools from './AlignmentTools.vue'
import BatchColorControl from './BatchColorControl.vue'
import BatchFontControl from './BatchFontControl.vue'

type WBStore = ReturnType<typeof useWBStore>

const props = defineProps<{ store: WBStore }>()

const emit = defineEmits<{
  'delete-selected': []
}>()

const grouping = useGrouping(props.store)

const count = computed(() => props.store.selectedIds.length)

// Breakdown by type
const breakdown = computed(() => {
  let strokes = 0
  let assets = 0
  let locked = 0

  for (const id of props.store.selectedIds) {
    const obj = props.store.getObjectById(id)
    if (!obj) continue
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

// Type-specific visibility flags
const selectedTypes = computed(() => {
  const types = new Set<string>()
  for (const id of props.store.selectedIds) {
    const obj = props.store.getObjectById(id)
    if (obj) types.add(props.store.getObjectType(obj))
  }
  return types
})

const hasStrokes = computed(() =>
  ['pen', 'highlighter'].some(t => selectedTypes.value.has(t)),
)
const hasText = computed(() =>
  ['text', 'sticky'].some(t => selectedTypes.value.has(t)),
)
const hasImages = computed(() => selectedTypes.value.has('image'))

// Batch opacity for images
const commonOpacity = computed<number | 'mixed'>(() => {
  const images: WBAsset[] = []
  for (const id of props.store.selectedIds) {
    const obj = props.store.getObjectById(id)
    if (obj && props.store.getObjectType(obj) === 'image') {
      images.push(obj as WBAsset)
    }
  }
  if (images.length === 0) return 'mixed'
  const first = images[0].opacity ?? 1
  return images.every(i => (i.opacity ?? 1) === first) ? first : 'mixed'
})

function onOpacityChange(e: Event) {
  const pct = Number((e.target as HTMLInputElement).value)
  const opacity = pct / 100
  const updates = props.store.selectedIds
    .filter(id => {
      const obj = props.store.getObjectById(id)
      return obj && props.store.getObjectType(obj) === 'image' && !props.store.isItemLocked(id)
    })
    .map(id => ({ id, changes: { opacity } }))
  if (updates.length > 0) {
    props.store.batchUpdateObjects(updates)
  }
}

// Group/Ungroup flags
const canGroup = grouping.canGroup
const canUngroup = grouping.canUngroup

// Lock/Unlock
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
.msp {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* Header */
.msp__header {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: var(--wb-bg-secondary, #f3f4f6);
  border-radius: 8px;
}
.msp__count {
  font-size: 15px;
  font-weight: 600;
  color: var(--wb-text-primary, #111827);
}
.msp__breakdown {
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
}
.msp__locked {
  font-size: 12px;
  color: var(--wb-warning, #f59e0b);
  font-weight: 500;
}

/* Section labels */
.msp__section-label {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--wb-text-secondary, #6b7280);
}

/* Opacity */
.msp__opacity-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.msp__opacity-label {
  font-size: 13px;
  color: var(--wb-text-secondary, #6b7280);
  min-width: 56px;
}
.msp__opacity-group {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}
.msp__opacity-slider {
  flex: 1;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: var(--wb-border-color, #e5e7eb);
  border-radius: 2px;
  outline: none;
}
.msp__opacity-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--wb-brand, #0066ff);
  cursor: pointer;
}
.msp__opacity-value {
  font-size: 12px;
  color: var(--wb-text-secondary, #6b7280);
  min-width: 36px;
  text-align: right;
}

/* Actions */
.msp__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.msp__btn {
  padding: 8px 12px;
  border: 1px solid var(--wb-border-color, #e5e7eb);
  border-radius: 8px;
  background: var(--wb-bg-primary, #ffffff);
  color: var(--wb-text-primary, #111827);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  text-align: left;
}
.msp__btn:hover:not(:disabled) {
  background: var(--wb-bg-secondary, #f3f4f6);
  border-color: var(--wb-brand, #0066ff);
}
.msp__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.msp__btn--delete {
  color: #ef4444;
  border-color: #fecaca;
}
.msp__btn--delete:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.08);
  border-color: #ef4444;
}
</style>
