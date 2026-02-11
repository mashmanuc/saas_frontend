<template>
  <aside class="solo-toolbar">
    <!-- Drawing tools -->
    <div class="solo-toolbar__section">
      <ToolButton
        icon="✏️"
        tooltip="Pen"
        shortcut="P"
        :active="currentTool === 'pen'"
        @click="$emit('tool-change', 'pen')"
      />
      <ToolButton
        icon="🖍️"
        tooltip="Highlighter"
        shortcut="H"
        :active="currentTool === 'highlighter'"
        @click="$emit('tool-change', 'highlighter')"
      />
      <ToolButton
        icon="🧹"
        tooltip="Eraser"
        shortcut="E"
        :active="currentTool === 'eraser'"
        @click="$emit('tool-change', 'eraser')"
      />
    </div>

    <div class="solo-toolbar__divider" />

    <!-- Shape tools -->
    <div class="solo-toolbar__section">
      <ToolButton
        icon="📏"
        tooltip="Line"
        shortcut="L"
        :active="currentTool === 'line'"
        @click="$emit('tool-change', 'line')"
      />
      <ToolButton
        icon="⬜"
        tooltip="Rectangle"
        shortcut="R"
        :active="currentTool === 'rectangle'"
        @click="$emit('tool-change', 'rectangle')"
      />
      <ToolButton
        icon="⭕"
        tooltip="Circle"
        shortcut="C"
        :active="currentTool === 'circle'"
        @click="$emit('tool-change', 'circle')"
      />
    </div>

    <div class="solo-toolbar__divider" />

    <!-- Text tools -->
    <div class="solo-toolbar__section">
      <ToolButton
        icon="📝"
        tooltip="Text"
        shortcut="T"
        :active="currentTool === 'text'"
        @click="$emit('tool-change', 'text')"
      />
      <ToolButton
        icon="📌"
        tooltip="Sticky Note"
        shortcut="N"
        :active="currentTool === 'note'"
        @click="$emit('tool-change', 'note')"
      />
      <ToolButton
        icon="👆"
        tooltip="Select"
        shortcut="S"
        :active="currentTool === 'select'"
        @click="$emit('tool-change', 'select')"
      />
    </div>

    <div class="solo-toolbar__divider" />

    <!-- Colors -->
    <ColorPicker
      :model-value="currentColor"
      :preset-colors="presetColors"
      @update:model-value="$emit('color-change', $event)"
    />

    <div class="solo-toolbar__divider" />

    <!-- Sizes -->
    <SizePicker
      :model-value="currentSize"
      :preset-sizes="presetSizes"
      @update:model-value="$emit('size-change', $event)"
    />

    <div class="solo-toolbar__divider" />

    <!-- Actions -->
    <div class="solo-toolbar__section">
      <ToolButton
        icon="↩️"
        tooltip="Undo"
        shortcut="Ctrl+Z"
        :active="false"
        @click="$emit('undo')"
      />
      <ToolButton
        icon="↪️"
        tooltip="Redo"
        shortcut="Ctrl+Y"
        :active="false"
        @click="$emit('redo')"
      />
      <ToolButton
        icon="🗑️"
        tooltip="Clear Page"
        :active="false"
        @click="$emit('clear')"
      />
    </div>
  </aside>
</template>

<script setup lang="ts">
import type { Tool } from '../../types/solo'
import ToolButton from './ToolButton.vue'
import ColorPicker from './ColorPicker.vue'
import SizePicker from './SizePicker.vue'

defineProps<{
  currentTool: Tool
  currentColor: string
  currentSize: number
  presetColors: string[]
  presetSizes: number[]
}>()

defineEmits<{
  'tool-change': [tool: Tool]
  'color-change': [color: string]
  'size-change': [size: number]
  undo: []
  redo: []
  clear: []
}>()
</script>
