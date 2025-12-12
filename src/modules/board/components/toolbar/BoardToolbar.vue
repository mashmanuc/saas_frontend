<script setup lang="ts">
import {
  MousePointer2,
  Hand,
  Pencil,
  Highlighter,
  Eraser,
  Square,
  Type,
  Image,
  StickyNote,
  ArrowRight,
  Undo2,
  Redo2,
} from 'lucide-vue-next'
import type { ToolType, ToolConfig } from '@/core/board/types'

interface Props {
  activeTool: ToolType
  toolConfig: ToolConfig
  canUndo: boolean
  canRedo: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'tool-change', tool: ToolType): void
  (e: 'config-change', config: Partial<ToolConfig>): void
  (e: 'undo'): void
  (e: 'redo'): void
}>()

const tools: Array<{ type: ToolType; icon: typeof MousePointer2; label: string; shortcut: string }> = [
  { type: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V' },
  { type: 'pan', icon: Hand, label: 'Pan', shortcut: 'H' },
  { type: 'pencil', icon: Pencil, label: 'Pencil', shortcut: 'P' },
  { type: 'marker', icon: Highlighter, label: 'Marker', shortcut: 'M' },
  { type: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E' },
  { type: 'shape', icon: Square, label: 'Shape', shortcut: 'S' },
  { type: 'text', icon: Type, label: 'Text', shortcut: 'T' },
  { type: 'image', icon: Image, label: 'Image', shortcut: 'I' },
  { type: 'sticky', icon: StickyNote, label: 'Sticky', shortcut: 'N' },
  { type: 'connector', icon: ArrowRight, label: 'Connector', shortcut: 'L' },
]
</script>

<template>
  <div class="board-toolbar">
    <!-- History buttons -->
    <div class="toolbar-section">
      <button
        class="tool-btn"
        :disabled="!canUndo"
        title="Undo (Ctrl+Z)"
        @click="emit('undo')"
      >
        <Undo2 :size="20" />
      </button>
      <button
        class="tool-btn"
        :disabled="!canRedo"
        title="Redo (Ctrl+Y)"
        @click="emit('redo')"
      >
        <Redo2 :size="20" />
      </button>
    </div>

    <div class="toolbar-divider" />

    <!-- Tool buttons -->
    <div class="toolbar-section">
      <button
        v-for="tool in tools"
        :key="tool.type"
        class="tool-btn"
        :class="{ active: activeTool === tool.type }"
        :title="`${tool.label} (${tool.shortcut})`"
        @click="emit('tool-change', tool.type)"
      >
        <component :is="tool.icon" :size="20" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.board-toolbar {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.5rem;
  gap: 0.25rem;
}

.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toolbar-divider {
  width: 32px;
  height: 1px;
  background: #e0e0e0;
  margin: 0.5rem 0;
}

.tool-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  color: #666;
  transition: all 0.2s;
}

.tool-btn:hover:not(:disabled) {
  background: #f0f0f0;
  color: #333;
}

.tool-btn.active {
  background: #3b82f6;
  color: white;
}

.tool-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
