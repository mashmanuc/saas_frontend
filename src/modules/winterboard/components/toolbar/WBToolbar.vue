<!-- WB: Vertical toolbar — drawing tools, colors, sizes, actions
     Ref: ManifestWinterboard_v2.md LAW-09, LAW-21, LAW-22
     B3.1: Full keyboard a11y — roving tabindex, arrow keys, focus trap
     Adapted from classroom/BoardToolbarVertical.vue with WB prefix -->
<template>
  <div
    ref="toolbarEl"
    class="wb-toolbar"
    role="toolbar"
    :aria-label="t('winterboard.toolbar.title')"
    @keydown="handleToolbarKeydown"
  >
    <!-- Drawing Tools -->
    <div class="wb-toolbar__group" role="group" :aria-label="t('winterboard.toolbar.drawingTools')">
      <button
        v-for="(tool, idx) in drawingTools"
        :key="tool.id"
        type="button"
        class="wb-toolbar__btn wb-toolbar__btn--tooltip"
        :class="{ 'wb-toolbar__btn--active': currentTool === tool.id }"
        :aria-pressed="currentTool === tool.id"
        :aria-label="`${t(`winterboard.tools.${tool.id}`)} (${tool.shortcut})`"
        :data-tooltip="`${t(`winterboard.tools.${tool.id}`)} (${tool.shortcut})`"
        :tabindex="getTabIndex(0, idx)"
        @click="emit('tool-change', tool.id)"
      >
        <component :is="tool.icon" class="wb-toolbar__icon" />
      </button>
    </div>

    <div class="wb-toolbar__sep" role="separator" aria-hidden="true" />

    <!-- Color Picker (B6.1) -->
    <div class="wb-toolbar__group" role="group" :aria-label="t('winterboard.toolbar.colorPalette')">
      <WBColorPicker
        :model-value="currentColor"
        @update:model-value="emit('color-change', $event)"
      />
    </div>

    <div class="wb-toolbar__sep" role="separator" aria-hidden="true" />

    <!-- Size Slider (B6.1) -->
    <div class="wb-toolbar__group" role="group" :aria-label="t('winterboard.toolbar.strokeSize')">
      <WBSizeSlider
        :model-value="currentSize"
        :current-color="currentColor"
        @update:model-value="emit('size-change', $event)"
      />
    </div>

    <div class="wb-toolbar__sep" role="separator" aria-hidden="true" />

    <!-- Actions: Undo / Redo / Clear -->
    <div class="wb-toolbar__group" role="group" :aria-label="t('winterboard.toolbar.actions')">
      <button
        type="button"
        class="wb-toolbar__btn wb-toolbar__btn--tooltip"
        :disabled="!canUndo"
        :aria-label="`${t('winterboard.tools.undo')} (Ctrl+Z)`"
        :data-tooltip="`${t('winterboard.tools.undo')} (Ctrl+Z)`"
        :tabindex="getTabIndex(3, 0)"
        @click="emit('undo')"
      >
        <WBIconUndo class="wb-toolbar__icon" />
      </button>
      <button
        type="button"
        class="wb-toolbar__btn wb-toolbar__btn--tooltip"
        :disabled="!canRedo"
        :aria-label="`${t('winterboard.tools.redo')} (Ctrl+Y)`"
        :data-tooltip="`${t('winterboard.tools.redo')} (Ctrl+Y)`"
        :tabindex="getTabIndex(3, 1)"
        @click="emit('redo')"
      >
        <WBIconRedo class="wb-toolbar__icon" />
      </button>
      <button
        type="button"
        class="wb-toolbar__btn wb-toolbar__btn--danger wb-toolbar__btn--tooltip"
        :aria-label="t('winterboard.tools.clear')"
        :data-tooltip="t('winterboard.tools.clear')"
        :tabindex="getTabIndex(3, 2)"
        @click="emit('clear')"
      >
        <WBIconTrash class="wb-toolbar__icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// WB: WBToolbar — vertical toolbar for Winterboard
// Ref: TASK_BOARD.md B1.3, B3.1
// B3.1: Roving tabindex, arrow key nav, Tab between groups, focus trap

import { ref, reactive } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBToolType } from '../../types/winterboard'

// Icons (WB-prefixed copies, isolated from classroom)
import WBIconPen from './icons/WBIconPen.vue'
import WBIconHighlighter from './icons/WBIconHighlighter.vue'
import WBIconEraser from './icons/WBIconEraser.vue'
import WBIconLine from './icons/WBIconLine.vue'
import WBIconRectangle from './icons/WBIconRectangle.vue'
import WBIconCircle from './icons/WBIconCircle.vue'
import WBIconText from './icons/WBIconText.vue'
import WBIconSelect from './icons/WBIconSelect.vue'
import WBIconUndo from './icons/WBIconUndo.vue'
import WBIconRedo from './icons/WBIconRedo.vue'
import WBIconTrash from './icons/WBIconTrash.vue'
import WBColorPicker from './WBColorPicker.vue'
import WBSizeSlider from './WBSizeSlider.vue'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  currentTool?: WBToolType
  currentColor?: string
  currentSize?: number
  canUndo?: boolean
  canRedo?: boolean
}

withDefaults(defineProps<Props>(), {
  currentTool: 'pen',
  currentColor: '#000000',
  currentSize: 2,
  canUndo: false,
  canRedo: false,
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'tool-change': [tool: WBToolType]
  'color-change': [color: string]
  'size-change': [size: number]
  undo: []
  redo: []
  clear: []
}>()

// ─── i18n ───────────────────────────────────────────────────────────────────

const { t } = useI18n()

// ─── Tool definitions (LAW-09 order) ────────────────────────────────────────

interface ToolDef {
  id: WBToolType
  icon: typeof WBIconPen
  shortcut: string
}

const drawingTools: ToolDef[] = [
  { id: 'select', icon: WBIconSelect, shortcut: 'V' },
  { id: 'pen', icon: WBIconPen, shortcut: 'P' },
  { id: 'highlighter', icon: WBIconHighlighter, shortcut: 'H' },
  { id: 'line', icon: WBIconLine, shortcut: 'L' },
  { id: 'rectangle', icon: WBIconRectangle, shortcut: 'R' },
  { id: 'circle', icon: WBIconCircle, shortcut: 'C' },
  { id: 'text', icon: WBIconText, shortcut: 'T' },
  { id: 'eraser', icon: WBIconEraser, shortcut: 'E' },
]

// Color presets and size presets are now in WBColorPicker.vue and WBSizeSlider.vue

// ─── B3.1: Roving tabindex + arrow key navigation ──────────────────────────
// Pattern: Tab/Shift+Tab moves between groups, Arrow keys move within group
// Only the "active" item in each group has tabindex=0, rest have tabindex=-1

const toolbarEl = ref<HTMLElement | null>(null)
// Group sizes: [tools(8), color picker(1), size slider(1), actions(3)]
const GROUP_SIZES = [drawingTools.length, 1, 1, 3]
const TOTAL_GROUPS = GROUP_SIZES.length

// Track active index within each group
const activeIndices = reactive<number[]>([0, 0, 0, 0])

function getTabIndex(groupIdx: number, itemIdx: number): number {
  return activeIndices[groupIdx] === itemIdx ? 0 : -1
}

// Get all focusable elements in a group
function getGroupElements(groupIdx: number): HTMLElement[] {
  if (!toolbarEl.value) return []
  const groups = toolbarEl.value.querySelectorAll<HTMLElement>('[role="group"]')
  if (!groups[groupIdx]) return []
  // Select buttons and labels with role="button"
  return Array.from(
    groups[groupIdx].querySelectorAll<HTMLElement>('button, [role="button"]')
  )
}

function focusItem(groupIdx: number, itemIdx: number): void {
  const els = getGroupElements(groupIdx)
  const clamped = Math.max(0, Math.min(els.length - 1, itemIdx))
  activeIndices[groupIdx] = clamped
  els[clamped]?.focus()
}

function handleToolbarKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement
  if (!toolbarEl.value) return

  // Find which group the target belongs to
  const groups = toolbarEl.value.querySelectorAll<HTMLElement>('[role="group"]')
  let currentGroup = -1
  for (let g = 0; g < groups.length; g++) {
    if (groups[g].contains(target)) {
      currentGroup = g
      break
    }
  }
  if (currentGroup === -1) return

  const groupSize = GROUP_SIZES[currentGroup]
  const currentIdx = activeIndices[currentGroup]

  switch (event.key) {
    // Arrow Up/Left: previous item in group (wrap)
    case 'ArrowUp':
    case 'ArrowLeft': {
      event.preventDefault()
      const next = (currentIdx - 1 + groupSize) % groupSize
      focusItem(currentGroup, next)
      break
    }
    // Arrow Down/Right: next item in group (wrap)
    case 'ArrowDown':
    case 'ArrowRight': {
      event.preventDefault()
      const next = (currentIdx + 1) % groupSize
      focusItem(currentGroup, next)
      break
    }
    // Tab: move to next group (with focus trap)
    case 'Tab': {
      if (event.shiftKey) {
        // Shift+Tab: previous group
        const prevGroup = (currentGroup - 1 + TOTAL_GROUPS) % TOTAL_GROUPS
        event.preventDefault()
        focusItem(prevGroup, activeIndices[prevGroup])
      } else {
        // Tab: next group
        const nextGroup = (currentGroup + 1) % TOTAL_GROUPS
        event.preventDefault()
        focusItem(nextGroup, activeIndices[nextGroup])
      }
      break
    }
    // Home: first item in group
    case 'Home': {
      event.preventDefault()
      focusItem(currentGroup, 0)
      break
    }
    // End: last item in group
    case 'End': {
      event.preventDefault()
      focusItem(currentGroup, groupSize - 1)
      break
    }
  }
}
</script>

<style scoped>
/* WB: Vertical toolbar — LAW-09: 60px wide, 32×32 icons, blue accent
   F29-AS.25: CSS containment to prevent canvas reflow */
.wb-toolbar {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 4px;
  width: 56px;
  background: var(--wb-toolbar-bg, #ffffff);
  border-right: 1px solid var(--wb-toolbar-border, #e2e8f0);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.06);
  overflow-y: auto;
  max-height: 100vh;
  contain: layout style;
  will-change: contents;
  z-index: 20;
}

.wb-toolbar__group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.wb-toolbar__sep {
  height: 1px;
  margin: 6px 4px;
  background: var(--wb-toolbar-border, #e2e8f0);
}

/* Tool button — 44×44 touch-friendly (LAW-22: min 44px for a11y) */
.wb-toolbar__btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  color: var(--wb-fg-secondary, #475569);
  transition: background 0.15s ease, color 0.15s ease;
}

.wb-toolbar__btn:hover:not(:disabled) {
  background: var(--wb-btn-hover, #f1f5f9);
  color: var(--wb-fg, #0f172a);
}

.wb-toolbar__btn:focus-visible {
  outline: 2px solid var(--wb-brand, #0066FF);
  outline-offset: -2px;
}

.wb-toolbar__btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.wb-toolbar__btn--active {
  background: var(--wb-brand, #2563eb);
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3);
}

.wb-toolbar__btn--active:hover:not(:disabled) {
  background: var(--wb-brand-dark, #1d4ed8);
  color: #ffffff;
}

.wb-toolbar__btn--danger:hover:not(:disabled) {
  background: #fee2e2;
  color: #dc2626;
}

/* Icon — 20×20 */
.wb-toolbar__icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

/* B6.1: Tooltip — CSS-only, 500ms delay, positioned right of toolbar */
.wb-toolbar__btn--tooltip {
  position: relative;
}

.wb-toolbar__btn--tooltip::after {
  content: attr(data-tooltip);
  position: absolute;
  left: calc(100% + 8px);
  top: 50%;
  transform: translateY(-50%);
  z-index: 60;
  padding: 5px 10px;
  background: var(--wb-header-bg, #0f172a);
  color: #ffffff;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.15s ease 500ms;
}

.wb-toolbar__btn--tooltip:hover::after {
  opacity: 1;
}

.wb-toolbar__btn--tooltip:focus-visible::after {
  opacity: 1;
}

.wb-toolbar__btn--tooltip:active::after {
  opacity: 0;
  transition-delay: 0ms;
}

/* Responsive: compact on mobile (LAW-22: 44px min touch target maintained) */
@media (max-width: 768px) {
  .wb-toolbar {
    width: 48px;
    padding: 6px 2px;
    gap: 2px;
  }
}

/* Hide tooltips on mobile — use touch instead */
@media (max-width: 768px) {
  .wb-toolbar__btn--tooltip::after {
    display: none;
  }
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-toolbar__btn,
  .wb-toolbar__btn--tooltip::after {
    transition: none;
  }
}
</style>
