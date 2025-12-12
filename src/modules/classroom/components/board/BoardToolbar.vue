<template>
  <div class="board-toolbar">
    <!-- Drawing tools -->
    <div class="toolbar-group">
      <button
        v-for="tool in tools"
        :key="tool.id"
        class="tool-btn"
        :class="{ 'tool-btn--active': currentTool === tool.id }"
        :title="$t(`classroom.tools.${tool.id}`)"
        :disabled="!canUseTool(tool.id)"
        @click="$emit('tool-change', tool.id)"
      >
        <span class="icon">{{ tool.icon }}</span>
      </button>
    </div>

    <!-- Separator -->
    <div class="toolbar-separator"></div>

    <!-- Colors -->
    <div class="toolbar-group">
      <button
        v-for="color in colors"
        :key="color"
        class="color-btn"
        :class="{ 'color-btn--active': currentColor === color }"
        :style="{ backgroundColor: color }"
        @click="$emit('color-change', color)"
      ></button>
      <input
        type="color"
        class="color-picker"
        :value="currentColor"
        @input="$emit('color-change', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Separator -->
    <div class="toolbar-separator"></div>

    <!-- Size -->
    <div class="toolbar-group">
      <button
        v-for="size in sizes"
        :key="size.value"
        class="size-btn"
        :class="{ 'size-btn--active': currentSize === size.value }"
        :title="size.label"
        @click="$emit('size-change', size.value)"
      >
        <span class="size-dot" :style="{ width: `${size.value * 2}px`, height: `${size.value * 2}px` }"></span>
      </button>
    </div>

    <!-- Separator -->
    <div class="toolbar-separator"></div>

    <!-- Actions -->
    <div class="toolbar-group">
      <button
        class="tool-btn"
        :title="$t('classroom.tools.undo')"
        @click="$emit('undo')"
      >
        <span class="icon">↩️</span>
      </button>
      <button
        class="tool-btn"
        :title="$t('classroom.tools.redo')"
        @click="$emit('redo')"
      >
        <span class="icon">↪️</span>
      </button>
      <button
        v-if="permissions?.can_clear_board"
        class="tool-btn tool-btn--danger"
        :title="$t('classroom.tools.clear')"
        @click="handleClear"
      >
        <span class="icon">🗑️</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { RoomPermissions } from '../../api/classroom'

interface Props {
  permissions?: RoomPermissions | null
  currentTool?: string
  currentColor?: string
  currentSize?: number
}

withDefaults(defineProps<Props>(), {
  permissions: null,
  currentTool: 'pen',
  currentColor: '#000000',
  currentSize: 2,
})

const emit = defineEmits<{
  'tool-change': [tool: string]
  'color-change': [color: string]
  'size-change': [size: number]
  undo: []
  redo: []
  clear: []
}>()

// Tools
const tools = [
  { id: 'pen', icon: '✏️' },
  { id: 'highlighter', icon: '🖍️' },
  { id: 'eraser', icon: '🧹' },
  { id: 'line', icon: '📏' },
  { id: 'rectangle', icon: '⬜' },
  { id: 'circle', icon: '⭕' },
  { id: 'text', icon: '📝' },
  { id: 'select', icon: '👆' },
]

// Colors
const colors = [
  '#000000',
  '#FF0000',
  '#00FF00',
  '#0000FF',
  '#FFFF00',
  '#FF00FF',
  '#00FFFF',
  '#FFFFFF',
]

// Sizes
const sizes = [
  { value: 1, label: 'Fine' },
  { value: 2, label: 'Medium' },
  { value: 4, label: 'Thick' },
  { value: 8, label: 'Extra thick' },
]

// Methods
function canUseTool(toolId: string): boolean {
  // Check permissions based on tool
  return true
}

function handleClear(): void {
  if (confirm('Clear the entire board?')) {
    emit('clear')
  }
}
</script>

<style scoped>
.board-toolbar {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toolbar-separator {
  width: 1px;
  height: 24px;
  background: var(--color-border);
}

.tool-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.tool-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.tool-btn--active {
  background: var(--color-primary-light);
}

.tool-btn--danger:hover {
  background: var(--color-error-light);
}

.tool-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.icon {
  font-size: 1.25rem;
}

.color-btn {
  width: 24px;
  height: 24px;
  border: 2px solid var(--color-border);
  border-radius: 50%;
  cursor: pointer;
  transition: transform 0.2s;
}

.color-btn:hover {
  transform: scale(1.2);
}

.color-btn--active {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.color-picker {
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  overflow: hidden;
}

.size-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
}

.size-btn:hover {
  background: var(--color-bg-hover);
}

.size-btn--active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.size-dot {
  background: var(--color-text-primary);
  border-radius: 50%;
}
</style>
