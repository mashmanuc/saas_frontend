<!-- WB: Vertical toolbar — drawing tools, thickness, colors, actions, lock
     Ref: ManifestWinterboard_v2.md LAW-09, LAW-21, LAW-22
     B3: Toolbar integration (conditional visibility, transitions, keyboard nav)
     B4: Lock/Unlock context action
     Adapted from classroom/BoardToolbarVertical.vue with WB prefix -->
<template>
  <div
    ref="toolbarEl"
    class="wb-toolbar"
    :class="[variantClasses, { 'wb-toolbar--expanded': isExpanded }]"
    :data-variant="variant"
    role="toolbar"
    :aria-label="t('winterboard.toolbar.title')"
    @keydown="handleToolbarKeydown"
  >
    <!-- Drawing Tools (4 visual sub-groups with thin separators) -->
    <div class="wb-toolbar__group" role="group" :aria-label="t('winterboard.toolbar.drawingTools')">
      <template v-for="(subGroup, si) in toolSubGroups" :key="si">
        <div v-if="si > 0" class="wb-toolbar__subsep" aria-hidden="true" />
        <button
          v-for="tool in subGroup"
          :key="tool.id"
          type="button"
          class="wb-toolbar__btn wb-toolbar__btn--tooltip"
          :class="{ 'wb-toolbar__btn--active': currentTool === tool.id }"
          :aria-pressed="currentTool === tool.id"
          :aria-label="`${t(`winterboard.tools.${tool.id}`)} (${tool.shortcut})`"
          :data-tooltip="toolTooltip(tool)"
          :tabindex="getTabIndex(0, drawingTools.findIndex(t => t.id === tool.id))"
          @click="emit('tool-change', tool.id)"
        >
          <component :is="tool.icon" class="wb-toolbar__icon" />
        </button>
      </template>
    </div>

    <!-- Stroke style flyout: thickness + color combined (B3: hidden for eraser/select) -->
    <Transition name="wb-collapse">
      <template v-if="showColorPalette">
        <div class="wb-toolbar__sep" role="separator" aria-hidden="true" />
      </template>
    </Transition>
    <Transition name="wb-collapse">
      <div v-if="showColorPalette" class="wb-toolbar__group" role="group" :aria-label="t('winterboard.toolbar.color_section')">
        <WBColorFlyout
          :model-value="currentColor"
          :current-tool="currentTool"
          :current-size="currentSize"
          @update:model-value="emit('color-change', $event)"
          @update:current-size="emit('size-change', $event)"
        />
      </div>
    </Transition>

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
      <!-- PROB-3 FIX: Single clear button — clears current page only -->
      <button
        type="button"
        class="wb-toolbar__btn wb-toolbar__btn--danger wb-toolbar__btn--tooltip"
        :aria-label="t('winterboard.clear.button')"
        :data-tooltip="t('winterboard.clear.button')"
        :tabindex="getTabIndex(3, 2)"
        :disabled="!canClearPage"
        @click="emit('clear-page-request')"
      >
        <WBIconTrash class="wb-toolbar__icon" />
      </button>
    </div>

    <!-- B4: Lock/Unlock context action (visible when items selected) -->
    <Transition name="wb-collapse">
      <template v-if="hasSelection">
        <div class="wb-toolbar__sep" role="separator" aria-hidden="true" />
      </template>
    </Transition>
    <Transition name="wb-collapse">
      <div v-if="hasSelection" class="wb-toolbar__group wb-toolbar__context" role="group" :aria-label="t('winterboard.lock.lock')">
        <button
          type="button"
          class="wb-toolbar__btn wb-toolbar__btn--tooltip"
          :aria-label="t(hasLockedInSelection ? 'winterboard.lock.unlock' : 'winterboard.lock.lock')"
          :data-tooltip="t(hasLockedInSelection ? 'winterboard.lock.unlock' : 'winterboard.lock.lock')"
          :tabindex="getTabIndex(4, 0)"
          @click="hasLockedInSelection ? emit('unlock-selected') : emit('lock-selected')"
        >
          <WBIconUnlock v-if="hasLockedInSelection" class="wb-toolbar__icon" />
          <WBIconLock v-else class="wb-toolbar__icon" />
        </button>
      </div>
    </Transition>

    <!-- P3: YouTube insert button -->
    <div class="wb-toolbar__sep" role="separator" aria-hidden="true" />
    <div class="wb-toolbar__group" role="group" :aria-label="t('winterboard.youtube.insert')">
      <button
        type="button"
        class="wb-toolbar__btn wb-toolbar__btn--tooltip"
        :aria-label="t('winterboard.youtube.insert')"
        :data-tooltip="t('winterboard.youtube.insert')"
        @click="emit('youtube-insert')"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <rect x="2" y="4" width="16" height="12" rx="3" fill="#FF0000"/>
          <path d="M8.5 7.5l5 2.5-5 2.5V7.5z" fill="#fff"/>
        </svg>
      </button>
    </div>

    <!-- Phase 4 B8: Tablet expand/collapse toggle (only visible on tablet variant) -->
    <button
      v-if="variant === 'tablet'"
      type="button"
      class="wb-toolbar__btn wb-toolbar__toggle"
      :aria-label="t(isExpanded ? 'winterboard.toolbar.collapse' : 'winterboard.toolbar.expand')"
      :aria-expanded="isExpanded"
      @click="toggleExpand"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
        <path v-if="isExpanded" d="M15 12L10 7L5 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path v-else d="M5 8L10 13L15 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
// WB: WBToolbar — vertical toolbar for Winterboard
// Ref: TASK_BOARD.md B1.3, B3.1
// B3.1: Roving tabindex, arrow key nav, Tab between groups, focus trap

import { ref, reactive, computed } from 'vue'
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
import WBIconLaser from './icons/WBIconLaser.vue'
import WBIconSticky from './icons/WBIconSticky.vue'
import WBIconLock from './icons/WBIconLock.vue'
import WBIconUnlock from './icons/WBIconUnlock.vue'
import WBColorFlyout from './WBColorFlyout.vue'

// ─── Props ──────────────────────────────────────────────────────────────────

// Responsive Phase 2 B3: Toolbar variant type (INV-3)
export type ToolbarVariant = 'mobile' | 'tablet' | 'desktop' | 'display'

interface Props {
  currentTool?: WBToolType
  currentColor?: string
  currentSize?: number
  canUndo?: boolean
  canRedo?: boolean
  hasSelection?: boolean
  hasLockedInSelection?: boolean
  canClearPage?: boolean
  /** Responsive Phase 2 B3: Layout variant (INV-3: one toolbar, not three) */
  variant?: ToolbarVariant
}

const props = withDefaults(defineProps<Props>(), {
  currentTool: 'pen',
  currentColor: '#000000',
  currentSize: 2,
  canUndo: false,
  canRedo: false,
  hasSelection: false,
  hasLockedInSelection: false,
  canClearPage: false,
  variant: 'desktop',
})

// Responsive Phase 2 B3: Variant CSS classes
const variantClasses = computed(() => ({
  'wb-toolbar--mobile': props.variant === 'mobile',
  'wb-toolbar--tablet': props.variant === 'tablet',
  'wb-toolbar--desktop': props.variant === 'desktop',
  'wb-toolbar--display': props.variant === 'display',
}))

// Phase 4 B8: Tablet expand/collapse state
const EXPAND_STORAGE_KEY = 'wb:toolbar-expanded'

function loadExpandedState(): boolean {
  try {
    return localStorage.getItem(EXPAND_STORAGE_KEY) !== 'false'
  } catch {
    return true
  }
}

const isExpanded = ref(loadExpandedState())

function toggleExpand(): void {
  isExpanded.value = !isExpanded.value
  try {
    localStorage.setItem(EXPAND_STORAGE_KEY, String(isExpanded.value))
  } catch {
    // Ignore
  }
}

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  'tool-change': [tool: WBToolType]
  'color-change': [color: string]
  'size-change': [size: number]
  undo: []
  redo: []
  clear: []
  'lock-selected': []
  'unlock-selected': []
  'clear-page-request': []
  'youtube-insert': []
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
  { id: 'laser', icon: WBIconLaser, shortcut: 'F' },
  { id: 'sticky', icon: WBIconSticky, shortcut: 'S' },
]

// Visual sub-groups with thin separators between them. Логіка:
// 1. Виділення | 2. Вільне малювання | 3. Фігури | 4. Текст + утиліти
const toolSubGroups: ToolDef[][] = [
  drawingTools.slice(0, 1),  // select
  drawingTools.slice(1, 3),  // pen, highlighter
  drawingTools.slice(3, 6),  // line, rectangle, circle
  drawingTools.slice(6),     // text, eraser, laser, sticky
]

// ─── B3: Conditional visibility ─────────────────────────────────────────────

const THICKNESS_TOOLS: WBToolType[] = ['pen', 'highlighter', 'line', 'rectangle', 'circle']
const COLOR_TOOLS: WBToolType[] = ['pen', 'highlighter', 'line', 'rectangle', 'circle', 'text']

const showThickness = computed(() => THICKNESS_TOOLS.includes(props.currentTool))
const showColorPalette = computed(() => COLOR_TOOLS.includes(props.currentTool))

// B5: Tooltip text — laser gets extra hint
function toolTooltip(tool: ToolDef): string {
  const base = `${t(`winterboard.tools.${tool.id}`)} (${tool.shortcut})`
  if (tool.id === 'laser') return `${base}\n${t('winterboard.toolbar.laser_hint')}`
  if (tool.id === 'sticky') return `${base}\n${t('winterboard.toolbar.sticky_hint')}`
  return base
}

// ─── B3.1: Roving tabindex + arrow key navigation ──────────────────────────
// Pattern: Tab/Shift+Tab moves between groups, Arrow keys move within group
// Only the "active" item in each group has tabindex=0, rest have tabindex=-1

const toolbarEl = ref<HTMLElement | null>(null)
// Group sizes: [tools(8), thickness(4), palette(8 max), actions(3), lock(1)]
// Dynamic — actual count resolved from DOM via getGroupElements()
const GROUP_SIZES = [drawingTools.length, 4, 8, 4, 1]  // tools(9), thickness(4), palette(8), actions(4), lock(1)
const MAX_GROUPS = GROUP_SIZES.length

// Track active index within each group
const activeIndices = reactive<number[]>([0, 0, 0, 0, 0])

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
        const prevGroup = (currentGroup - 1 + MAX_GROUPS) % MAX_GROUPS
        event.preventDefault()
        focusItem(prevGroup, activeIndices[prevGroup])
      } else {
        // Tab: next group
        const nextGroup = (currentGroup + 1) % MAX_GROUPS
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
  overflow: visible;
  max-height: 100vh;
  z-index: 20;
  position: relative;
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

/* Thin sub-separator between tool sub-groups (lighter than main sep) */
.wb-toolbar__subsep {
  height: 1px;
  margin: 4px 6px;
  background: var(--wb-toolbar-border, #e2e8f0);
  opacity: 0.7;
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
    flex-direction: row;
    width: 100%;
    height: 52px;
    max-height: none;
    padding: 4px 6px;
    gap: 2px;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
    -webkit-overflow-scrolling: touch;
  }

  .wb-toolbar__group {
    flex-direction: row;
    gap: 2px;
    flex-shrink: 0;
  }

  .wb-toolbar__sep {
    width: 1px;
    height: 32px;
    margin: 6px 4px;
  }
}

/* Tablet: scrollable vertical toolbar with tighter spacing */
@media (min-width: 769px) and (max-width: 1024px) {
  .wb-toolbar {
    width: 52px;
    padding: 6px 2px;
    gap: 2px;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    touch-action: pan-y;
  }

  .wb-toolbar__btn {
    width: 44px;
    height: 44px;
  }

  .wb-toolbar__sep {
    margin: 4px 4px;
  }
}

/* Hide tooltips on touch devices */
@media (max-width: 1024px) {
  .wb-toolbar__btn--tooltip::after {
    display: none;
  }
}

/* B3: Collapse transition for conditional sections */
.wb-collapse-enter-active,
.wb-collapse-leave-active {
  transition: max-height 0.2s ease, opacity 0.2s ease;
  overflow: hidden;
}
.wb-collapse-enter-from,
.wb-collapse-leave-to {
  max-height: 0;
  opacity: 0;
}
.wb-collapse-enter-to,
.wb-collapse-leave-from {
  max-height: 500px;
  opacity: 1;
}

/* B4: Context actions group */
.wb-toolbar__context {
  border-top: none;
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-toolbar__btn,
  .wb-toolbar__btn--tooltip::after,
  .wb-collapse-enter-active,
  .wb-collapse-leave-active {
    transition: none;
  }
}

/* ── Responsive Phase 2 B3: Variant-specific overrides (INV-3) ──── */

/* Mobile: horizontal bottom bar, scrollable, glass effect, safe area */
.wb-toolbar[data-variant="mobile"] {
  flex-direction: row;
  width: 100%;
  height: 56px;
  max-height: none;
  padding: 4px 6px;
  padding-bottom: calc(4px + env(safe-area-inset-bottom, 0px));
  gap: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  border-right: none;
  border-top: 1px solid var(--wb-toolbar-border, #e2e8f0);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.06);
  -webkit-overflow-scrolling: touch;
  backdrop-filter: blur(12px);
  background: rgba(255, 255, 255, 0.85);
  z-index: var(--wb-z-mobile-toolbar, 20);
}
.wb-toolbar[data-variant="mobile"] .wb-toolbar__group {
  flex-direction: row;
  gap: 2px;
  flex-shrink: 0;
}
.wb-toolbar[data-variant="mobile"] .wb-toolbar__sep {
  width: 1px;
  height: 32px;
  margin: 6px 4px;
}
.wb-toolbar[data-variant="mobile"] .wb-toolbar__subsep {
  width: 1px;
  height: 20px;
  margin: 0 2px;
  opacity: 0.4;
}
.wb-toolbar[data-variant="mobile"] .wb-toolbar__btn {
  width: 48px;
  height: 48px;
}
.wb-toolbar[data-variant="mobile"] .wb-toolbar__btn--tooltip::after {
  display: none;
}

/* Tablet: vertical left, collapsible, slightly compact (Phase 4 B8) */
.wb-toolbar[data-variant="tablet"] {
  width: 48px;
  padding: 6px 2px;
  gap: 2px;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  transition: width 0.2s ease;
}
.wb-toolbar[data-variant="tablet"].wb-toolbar--expanded {
  width: 56px;
}
.wb-toolbar[data-variant="tablet"] .wb-toolbar__btn {
  width: 44px;
  height: 44px;
}
.wb-toolbar[data-variant="tablet"] .wb-toolbar__btn--tooltip::after {
  display: none;
}
/* Phase 4 B8: Hide thickness/color sections when collapsed on tablet */
.wb-toolbar[data-variant="tablet"]:not(.wb-toolbar--expanded) .wb-toolbar__group:nth-child(n+2):nth-child(-n+4) {
  display: none;
}
/* Phase 4 B8: Toggle button at bottom */
.wb-toolbar__toggle {
  margin-top: auto;
  opacity: 0.6;
}
.wb-toolbar__toggle:hover {
  opacity: 1;
}

/* Desktop: vertical left, always expanded (default / current layout) */
.wb-toolbar[data-variant="desktop"] {
  /* Inherits base styles — no overrides needed */
}

/* Display: vertical left, enlarged targets + icons */
.wb-toolbar[data-variant="display"] {
  width: 72px;
  padding: 12px 4px;
  gap: 4px;
}
.wb-toolbar[data-variant="display"] .wb-toolbar__btn {
  width: 64px;
  height: 64px;
}
.wb-toolbar[data-variant="display"] .wb-toolbar__icon {
  width: 28px;
  height: 28px;
}
.wb-toolbar[data-variant="display"] .wb-toolbar__sep {
  margin: 8px 6px;
}
</style>
