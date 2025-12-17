<template>
  <div
    class="board-toolbar"
    role="toolbar"
    :aria-label="$t('classroom.tools.toolbar')"
    @keydown="handleKeydown"
  >
    <!-- Drawing Tools Group -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.drawingTools')">
      <button
        v-for="(tool, index) in tools"
        :key="tool.id"
        :ref="(el: any) => setToolRef(el?.$el ?? el, index)"
        class="toolbar-btn"
        :class="{
          'toolbar-btn--active': currentTool === tool.id,
          'toolbar-btn--disabled': !canUseTool(tool.id),
        }"
        :aria-pressed="currentTool === tool.id"
        :aria-label="`${$t(`classroom.tools.${tool.id}`)} (${tool.shortcut})`"
        :disabled="!canUseTool(tool.id)"
        :tabindex="focusedToolIndex === index ? 0 : -1"
        @click="selectTool(tool.id)"
        @focus="focusedToolIndex = index"
      >
        <component :is="tool.icon" class="toolbar-icon" />
      </button>
    </div>

    <div class="toolbar-divider" role="separator" />

    <!-- Color Palette Group -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.colorPalette')">
      <button
        v-for="color in colorPresets"
        :key="color.value"
        class="color-btn"
        :class="{ 'color-btn--active': currentColor === color.value }"
        :style="{ '--btn-color': color.value }"
        :aria-pressed="currentColor === color.value"
        :aria-label="color.label"
        @click="selectColor(color.value)"
      >
        <span class="color-swatch" />
        <span v-if="currentColor === color.value" class="color-check">✓</span>
      </button>
    </div>

    <div class="toolbar-divider" role="separator" />

    <!-- Size Presets Group -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.strokeSize')">
      <button
        v-for="size in sizePresets"
        :key="size.value"
        class="size-btn"
        :class="{ 'size-btn--active': currentSize === size.value }"
        :aria-pressed="currentSize === size.value"
        :aria-label="size.label"
        @click="selectSize(size.value)"
      >
        <span
          class="size-dot"
          :style="{
            width: `${size.dotSize}px`,
            height: `${size.dotSize}px`,
          }"
        />
      </button>
    </div>

    <div class="toolbar-divider" role="separator" />

    <!-- Actions Group -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.actions')">
      <button
        class="toolbar-btn"
        :aria-label="`${$t('classroom.tools.undo')} (Ctrl+Z)`"
        :disabled="!canUndo"
        @click="$emit('undo')"
      >
        <IconUndo class="toolbar-icon" />
      </button>
      <button
        class="toolbar-btn"
        :aria-label="`${$t('classroom.tools.redo')} (Ctrl+Y)`"
        :disabled="!canRedo"
        @click="$emit('redo')"
      >
        <IconRedo class="toolbar-icon" />
      </button>
      <button
        v-if="permissions?.can_clear_board"
        class="toolbar-btn toolbar-btn--danger"
        :aria-label="$t('classroom.tools.clear')"
        @click="handleClear"
      >
        <IconTrash class="toolbar-icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RoomPermissions } from '../../api/classroom'

// Icon components (inline SVG for performance)
import IconPen from './icons/IconPen.vue'
import IconHighlighter from './icons/IconHighlighter.vue'
import IconEraser from './icons/IconEraser.vue'
import IconLine from './icons/IconLine.vue'
import IconRectangle from './icons/IconRectangle.vue'
import IconCircle from './icons/IconCircle.vue'
import IconText from './icons/IconText.vue'
import IconSelect from './icons/IconSelect.vue'
import IconUndo from './icons/IconUndo.vue'
import IconRedo from './icons/IconRedo.vue'
import IconTrash from './icons/IconTrash.vue'

interface Props {
  permissions?: RoomPermissions | null
  currentTool?: string
  currentColor?: string
  currentSize?: number
  canUndo?: boolean
  canRedo?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  permissions: null,
  currentTool: 'pen',
  currentColor: '#1e293b',
  currentSize: 2,
  canUndo: false,
  canRedo: false,
})

const emit = defineEmits<{
  'tool-change': [tool: string]
  'color-change': [color: string]
  'size-change': [size: number]
  undo: []
  redo: []
  clear: []
}>()

const { t } = useI18n()

// Tool definitions with icons and shortcuts
const tools = [
  { id: 'pen', icon: IconPen, shortcut: 'P' },
  { id: 'highlighter', icon: IconHighlighter, shortcut: 'H' },
  { id: 'eraser', icon: IconEraser, shortcut: 'E' },
  { id: 'line', icon: IconLine, shortcut: 'L' },
  { id: 'rectangle', icon: IconRectangle, shortcut: 'R' },
  { id: 'circle', icon: IconCircle, shortcut: 'C' },
  { id: 'text', icon: IconText, shortcut: 'T' },
  { id: 'select', icon: IconSelect, shortcut: 'V' },
]

// Color presets - 5 most used colors (Kami-style)
const colorPresets = [
  { value: '#1e293b', label: 'Black' },
  { value: '#dc2626', label: 'Red' },
  { value: '#2563eb', label: 'Blue' },
  { value: '#16a34a', label: 'Green' },
  { value: '#eab308', label: 'Yellow' },
]

// Size presets - 3 options (thin, medium, thick)
const sizePresets = [
  { value: 1, label: 'Thin', dotSize: 4 },
  { value: 3, label: 'Medium', dotSize: 8 },
  { value: 6, label: 'Thick', dotSize: 14 },
]

// Keyboard navigation state
const focusedToolIndex = ref(0)
const toolRefs = ref<(HTMLElement | null)[]>([])

function setToolRef(el: HTMLElement | null, index: number) {
  toolRefs.value[index] = el
}

// Methods
function selectTool(toolId: string): void {
  emit('tool-change', toolId)
  console.log('[ui.tool_select]', { tool: toolId })
}

function selectColor(color: string): void {
  emit('color-change', color)
  console.log('[ui.color_select]', { color })
}

function selectSize(size: number): void {
  emit('size-change', size)
  console.log('[ui.size_select]', { size })
}

function canUseTool(toolId: string): boolean {
  // Add permission checks if needed
  return true
}

function handleClear(): void {
  if (confirm(t('classroom.soloWorkspace.clearConfirm'))) {
    emit('clear')
    console.log('[ui.board_clear]')
  }
}

// Keyboard navigation
function handleKeydown(event: KeyboardEvent): void {
  const { key } = event

  if (key === 'ArrowDown' || key === 'ArrowRight') {
    event.preventDefault()
    focusedToolIndex.value = (focusedToolIndex.value + 1) % tools.length
    toolRefs.value[focusedToolIndex.value]?.focus()
  } else if (key === 'ArrowUp' || key === 'ArrowLeft') {
    event.preventDefault()
    focusedToolIndex.value = (focusedToolIndex.value - 1 + tools.length) % tools.length
    toolRefs.value[focusedToolIndex.value]?.focus()
  } else if (key === 'Enter' || key === ' ') {
    event.preventDefault()
    const tool = tools[focusedToolIndex.value]
    if (tool) {
      selectTool(tool.id)
    }
  }
}

// Global keyboard shortcuts
function handleGlobalKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  if (event.repeat) return

  // Ignore if typing in input
  if (
    event.target instanceof HTMLInputElement ||
    event.target instanceof HTMLTextAreaElement
  ) {
    return
  }

  const key = event.key.toUpperCase()
  const code = event.code

  // Tool shortcuts
  const tool = tools.find((t) => t.shortcut === key)
  if (tool && !event.ctrlKey && !event.metaKey) {
    event.preventDefault()
    selectTool(tool.id)
    return
  }

  // Undo/Redo
  if ((event.ctrlKey || event.metaKey) && code === 'KeyZ') {
    event.preventDefault()
    if (event.shiftKey) {
      emit('redo')
    } else {
      emit('undo')
    }
  }

  if ((event.ctrlKey || event.metaKey) && code === 'KeyY') {
    event.preventDefault()
    emit('redo')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleGlobalKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown)
})
</script>

<style scoped>
.board-toolbar {
  position: fixed;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px;
  background: var(--toolbar-bg, #ffffff);
  border: 1px solid var(--toolbar-border, #e2e8f0);
  border-radius: var(--radius-lg, 12px);
  box-shadow: var(--toolbar-shadow, 0 4px 12px rgba(0, 0, 0, 0.08));
  z-index: 100;
}

.toolbar-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toolbar-divider {
  height: 1px;
  margin: 4px 0;
  background: var(--color-border, #e2e8f0);
}

/* Tool Button */
.toolbar-btn {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--color-fg-secondary, #475569);
}

.toolbar-btn:hover:not(:disabled) {
  background: var(--toolbar-btn-hover, #f1f5f9);
  color: var(--color-fg, #0f172a);
}

.toolbar-btn:focus-visible {
  outline: 2px solid var(--color-border-focus, #2563eb);
  outline-offset: 2px;
}

.toolbar-btn--active {
  background: var(--toolbar-btn-active, #dbeafe);
  color: var(--color-brand, #2563eb);
}

.toolbar-btn--active:hover {
  background: var(--toolbar-btn-active, #dbeafe);
}

.toolbar-btn--danger:hover:not(:disabled) {
  background: var(--color-error-light, #fee2e2);
  color: var(--color-error, #dc2626);
}

.toolbar-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-icon {
  width: 20px;
  height: 20px;
}

/* Color Button */
.color-btn {
  position: relative;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.color-btn:hover {
  background: var(--toolbar-btn-hover, #f1f5f9);
}

.color-btn:focus-visible {
  outline: 2px solid var(--color-border-focus, #2563eb);
  outline-offset: 2px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: var(--radius-full, 9999px);
  background: var(--btn-color);
  border: 2px solid var(--color-border, #e2e8f0);
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.color-btn:hover .color-swatch {
  transform: scale(1.1);
}

.color-btn--active .color-swatch {
  border-color: var(--color-brand, #2563eb);
  box-shadow: 0 0 0 2px var(--color-brand-light, #dbeafe);
}

.color-check {
  position: absolute;
  font-size: 12px;
  font-weight: bold;
  color: white;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Size Button */
.size-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
}

.size-btn:hover {
  background: var(--toolbar-btn-hover, #f1f5f9);
  border-color: var(--color-border-strong, #cbd5e1);
}

.size-btn:focus-visible {
  outline: 2px solid var(--color-border-focus, #2563eb);
  outline-offset: 2px;
}

.size-btn--active {
  background: var(--toolbar-btn-active, #dbeafe);
  border-color: var(--color-brand, #2563eb);
}

.size-dot {
  border-radius: var(--radius-full, 9999px);
  background: var(--color-fg, #0f172a);
  transition: transform 0.15s ease;
}

.size-btn:hover .size-dot {
  transform: scale(1.1);
}

/* Responsive: horizontal on small screens */
@media (max-width: 768px) {
  .board-toolbar {
    left: 50%;
    top: auto;
    bottom: 16px;
    transform: translateX(-50%);
    flex-direction: row;
    gap: 4px;
  }

  .toolbar-group {
    flex-direction: row;
  }

  .toolbar-divider {
    width: 1px;
    height: 32px;
    margin: 0 4px;
  }
}
</style>
