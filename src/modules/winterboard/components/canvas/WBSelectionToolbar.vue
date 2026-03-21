<template>
  <Transition name="wb-sel-toolbar">
    <div
      v-if="isVisible"
      ref="toolbarRef"
      class="wb-selection-toolbar"
      :style="positionStyle"
      role="toolbar"
      :aria-label="t('winterboard.selection.toolbar', 'Selection toolbar')"
      @pointerdown.stop
    >
      <!-- Bring to Front -->
      <button
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.bringToFront')"
        @click="$emit('bring-to-front')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M4 7l4-4 4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Send to Back -->
      <button
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.sendToBack')"
        @click="$emit('send-to-back')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 13V3M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>

      <!-- Duplicate -->
      <button
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.duplicate')"
        :disabled="isLocked"
        @click="$emit('duplicate')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>

      <!-- Lock / Unlock -->
      <button
        v-if="isLocked"
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.unlock')"
        @click="$emit('unlock')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 7V5a3 3 0 016 0" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>
      <button
        v-else
        type="button"
        class="wb-selection-toolbar__btn"
        :title="t('winterboard.selection.lock')"
        @click="$emit('lock')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.5"/>
          <path d="M5 7V5a3 3 0 116 0v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </button>

      <!-- Delete -->
      <button
        type="button"
        class="wb-selection-toolbar__btn wb-selection-toolbar__btn--danger"
        :title="t('winterboard.selection.delete')"
        :disabled="isLocked"
        @click="$emit('delete')"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M2 4h12M5.333 4V2.667A.667.667 0 016 2h4a.667.667 0 01.667.667V4M12.667 4v9.333a1.333 1.333 0 01-1.334 1.334H4.667a1.333 1.333 0 01-1.334-1.334V4h9.334z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// WBSelectionToolbar — floating toolbar for selected objects (desktop only)
// Ref: PHASE10_PLAN.md P2, DAY1_AGENT_B.md B2.1
// Zone: AGENT-B (components/canvas/WBSelectionToolbar.vue)

import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceMode } from '../../composables/useDeviceMode'

// ─── Props ──────────────────────────────────────────────────────────────────

export interface SelectionBBox {
  x: number
  y: number
  w: number
  h: number
}

const props = defineProps<{
  selectedIds: string[]
  zoom: number
  canvasRect: DOMRect | null
  mode: 'edit' | 'replay'
  isLocked: boolean
  bbox: SelectionBBox | null
}>()

defineEmits<{
  'bring-to-front': []
  'send-to-back': []
  duplicate: []
  lock: []
  unlock: []
  delete: []
}>()

// ─── i18n & Device mode ─────────────────────────────────────────────────────

const { t } = useI18n({ useScope: 'global' })
const { deviceMode } = useDeviceMode()

const toolbarRef = ref<HTMLElement | null>(null)

// ─── Visibility ─────────────────────────────────────────────────────────────

const isVisible = computed(() =>
  props.selectedIds.length > 0 &&
  props.mode === 'edit' &&
  (deviceMode.value === 'desktop' || deviceMode.value === 'display'),
)

// ─── Positioning ────────────────────────────────────────────────────────────

const TOOLBAR_HEIGHT = 40
const TOOLBAR_GAP = 8

const positionStyle = computed(() => {
  if (!props.bbox || !props.canvasRect) {
    return { display: 'none' }
  }

  const zoom = props.zoom || 1
  const rect = props.canvasRect

  // Canvas-space bbox → screen-space
  const screenCenterX = rect.left + props.bbox.x * zoom + (props.bbox.w * zoom) / 2
  const screenBottomY = rect.top + (props.bbox.y + props.bbox.h) * zoom

  // Position toolbar below selection with gap
  let top = screenBottomY + TOOLBAR_GAP
  let left = screenCenterX

  // Fallback: if toolbar goes below canvas, put it above selection
  if (top + TOOLBAR_HEIGHT > rect.bottom) {
    top = rect.top + props.bbox.y * zoom - TOOLBAR_HEIGHT - TOOLBAR_GAP
  }

  // Clamp to canvas bounds
  top = Math.max(rect.top, Math.min(top, rect.bottom - TOOLBAR_HEIGHT))
  left = Math.max(rect.left + 80, Math.min(left, rect.right - 80))

  return {
    position: 'fixed' as const,
    top: `${top}px`,
    left: `${left}px`,
    transform: 'translateX(-50%)',
    zIndex: 50,
  }
})
</script>

<style scoped>
.wb-selection-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  background: rgba(30, 41, 59, 0.95);
  backdrop-filter: blur(8px);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.wb-selection-toolbar__btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  margin: 0;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #e2e8f0;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.wb-selection-toolbar__btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}

.wb-selection-toolbar__btn:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.wb-selection-toolbar__btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.wb-selection-toolbar__btn--danger:hover:not(:disabled) {
  background: rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

/* ── Fade transition ──────────────────────────────────────────────────────── */

.wb-sel-toolbar-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.wb-sel-toolbar-leave-active {
  transition: opacity 0.1s ease;
}
.wb-sel-toolbar-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(4px);
}
.wb-sel-toolbar-leave-to {
  opacity: 0;
}
</style>
