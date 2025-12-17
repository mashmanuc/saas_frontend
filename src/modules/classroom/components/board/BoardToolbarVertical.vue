<template>
  <div
    class="toolbar-vertical"
    role="toolbar"
    :aria-label="$t('classroom.tools.toolbar')"
  >
    <!-- Drawing Tools -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.drawingTools')">
      <button
        v-for="tool in drawingTools"
        :key="tool.id"
        ref="toolRefs"
        class="tool-btn"
        :class="{ 'tool-btn--active': currentTool === tool.id }"
        :aria-pressed="currentTool === tool.id"
        :title="`${$t(`classroom.tools.${tool.id}`)} (${tool.shortcut})`"
        @click="$emit('tool-change', tool.id)"
      >
        <component :is="tool.icon" class="tool-btn__icon" />
      </button>
    </div>

    <div class="toolbar-separator" />

    <!-- Color Presets (Kami-style: 3 colors + picker) -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.colorPalette')">
      <button
        v-for="color in colorPresets"
        :key="color"
        class="color-btn"
        :class="{ 'color-btn--active': currentColor === color }"
        :style="{ '--btn-color': color }"
        :aria-pressed="currentColor === color"
        :title="color"
        @click="$emit('color-change', color)"
      >
        <span class="color-btn__swatch" />
      </button>
      <label class="color-picker-label">
        <input
          type="color"
          class="color-picker-input"
          :value="currentColor"
          @input="$emit('color-change', ($event.target as HTMLInputElement).value)"
        />
        <span class="color-picker-icon">
          <IconPalette />
        </span>
      </label>
    </div>

    <div class="toolbar-separator" />

    <!-- Stroke Size -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.strokeSize')">
      <button
        v-for="size in sizePresets"
        :key="size.value"
        class="size-btn"
        :class="{ 'size-btn--active': currentSize === size.value }"
        :aria-pressed="currentSize === size.value"
        :title="size.label"
        @click="$emit('size-change', size.value)"
      >
        <span class="size-btn__dot" :style="{ width: `${size.value * 2}px`, height: `${size.value * 2}px` }" />
      </button>
    </div>

    <div class="toolbar-separator" />

    <!-- Actions -->
    <div class="toolbar-group" role="group" :aria-label="$t('classroom.tools.actions')">
      <button
        class="tool-btn"
        :disabled="!canUndo"
        :title="`${$t('classroom.tools.undo')} (Ctrl+Z)`"
        @click="$emit('undo')"
      >
        <IconUndo class="tool-btn__icon" />
      </button>
      <button
        class="tool-btn"
        :disabled="!canRedo"
        :title="`${$t('classroom.tools.redo')} (Ctrl+Shift+Z)`"
        @click="$emit('redo')"
      >
        <IconRedo class="tool-btn__icon" />
      </button>
      <button
        class="tool-btn tool-btn--danger"
        :title="$t('classroom.tools.clear')"
        @click="$emit('clear')"
      >
        <IconTrash class="tool-btn__icon" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

// Icons
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
import IconPalette from './icons/IconPalette.vue'

interface Props {
  currentTool?: string
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

const emit = defineEmits<{
  'tool-change': [tool: string]
  'color-change': [color: string]
  'size-change': [size: number]
  undo: []
  redo: []
  clear: []
}>()

// Drawing tools (Kami-style order)
const drawingTools = [
  { id: 'select', icon: IconSelect, shortcut: 'V' },
  { id: 'pen', icon: IconPen, shortcut: 'P' },
  { id: 'highlighter', icon: IconHighlighter, shortcut: 'H' },
  { id: 'line', icon: IconLine, shortcut: 'L' },
  { id: 'rectangle', icon: IconRectangle, shortcut: 'R' },
  { id: 'circle', icon: IconCircle, shortcut: 'C' },
  { id: 'text', icon: IconText, shortcut: 'T' },
  { id: 'eraser', icon: IconEraser, shortcut: 'E' },
]

// Color presets - ТЗ v0.28: #111111, #22c55e, #e879f9, #2563eb, #eab308
const colorPresets = [
  '#111111', // Black
  '#22c55e', // Green
  '#e879f9', // Pink
  '#2563eb', // Blue
  '#eab308', // Yellow
]

// Size presets - ТЗ v0.28: 1/2/4/8 px
const sizePresets = [
  { value: 1, label: '1px' },
  { value: 2, label: '2px' },
  { value: 4, label: '4px' },
  { value: 8, label: '8px' },
]

// Global keyboard shortcuts
function handleKeydown(event: KeyboardEvent): void {
  if (event.defaultPrevented) return
  if (event.repeat) return

  // Skip if in input
  if ((event.target as HTMLElement).tagName === 'INPUT') return

  const key = event.key.toUpperCase()
  const code = event.code

  // Tool shortcuts
  const tool = drawingTools.find((t) => t.shortcut === key)
  if (tool && !event.ctrlKey && !event.metaKey) {
    emit('tool-change', tool.id)
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
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
/* Kami-style vertical toolbar - ТЗ v0.28: 48px width, 40x40 buttons */
/* F29-AS.25: CSS containment to prevent layout/reflow of canvas */
.toolbar-vertical {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 4px;
  width: 48px;
  background: var(--toolbar-bg, #ffffff);
  border-right: 1px solid var(--toolbar-border, #e2e8f0);
  box-shadow: var(--toolbar-shadow, 2px 0 8px rgba(0, 0, 0, 0.06));
  overflow-y: auto;
  max-height: 100vh;
  /* F29-AS.25: CSS containment */
  contain: layout style;
  will-change: contents;
}

.toolbar-group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.toolbar-separator {
  height: 1px;
  margin: 6px 2px;
  background: var(--toolbar-border, #e2e8f0);
}

/* Tool buttons - 40x40 as per ТЗ */
.tool-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md, 8px);
  cursor: pointer;
  color: var(--color-fg-secondary, #475569);
  transition: all 0.15s ease;
}

.tool-btn:hover:not(:disabled) {
  background: var(--toolbar-btn-hover, #f1f5f9);
  color: var(--color-fg, #0f172a);
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.tool-btn--active {
  background: var(--color-brand-light, #dbeafe);
  color: var(--color-brand, #2563eb);
}

.tool-btn--danger:hover:not(:disabled) {
  background: var(--color-error-light, #fee2e2);
  color: var(--color-error, #dc2626);
}

/* Icons - 20x20 */
.tool-btn__icon {
  width: 20px;
  height: 20px;
}

/* Color buttons - 40x40 matching tool buttons */
.color-btn {
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

.color-btn--active {
  background: var(--color-bg-secondary, #f8fafc);
}

.color-btn__swatch {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--btn-color);
  border: 2px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  transition: transform 0.15s ease;
}

.color-btn--active .color-btn__swatch {
  transform: scale(1.1);
  box-shadow: 0 0 0 2px var(--color-brand, #2563eb);
}

/* Color picker */
.color-picker-label {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: var(--radius-md, 8px);
  transition: background 0.15s ease;
}

.color-picker-label:hover {
  background: var(--toolbar-btn-hover, #f1f5f9);
}

.color-picker-input {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.color-picker-icon {
  width: 20px;
  height: 20px;
  color: var(--color-fg-secondary, #475569);
}

/* Size buttons - 40x40 */
.size-btn {
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

.size-btn:hover {
  background: var(--toolbar-btn-hover, #f1f5f9);
}

.size-btn--active {
  background: var(--color-brand-light, #dbeafe);
}

.size-btn__dot {
  border-radius: 50%;
  background: var(--color-fg, #0f172a);
  transition: transform 0.15s ease;
}

.size-btn--active .size-btn__dot {
  background: var(--color-brand, #2563eb);
}

/* Responsive: compact on mobile (ТЗ v0.28: 44px width, 36x36 buttons) */
@media (max-width: 768px) {
  .toolbar-vertical {
    width: 44px;
    padding: 6px 3px;
    gap: 2px;
  }

  .tool-btn,
  .color-btn,
  .size-btn,
  .color-picker-label {
    width: 36px;
    height: 36px;
  }

  .tool-btn__icon,
  .color-picker-icon {
    width: 18px;
    height: 18px;
  }

  .color-btn__swatch {
    width: 16px;
    height: 16px;
  }
}
</style>
