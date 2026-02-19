<template>
  <v-group
    :config="groupConfig"
    @click="handleClick"
    @dblclick="handleDblClick"
    @dragend="handleDragEnd"
    @transformend="handleTransformEnd"
  >
    <!-- Background rect -->
    <v-rect :config="rectConfig" />
    <!-- Text content -->
    <v-text :config="textConfig" />
    <!-- Lock indicator -->
    <v-text v-if="sticky.locked" :config="lockConfig" />
  </v-group>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { WBAsset } from '../../types/winterboard'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  sticky: WBAsset
  isSelected?: boolean
  scale?: number
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  scale: 1,
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [id: string]
  dragEnd: [id: string, x: number, y: number]
  transformEnd: [id: string, w: number, h: number]
  editText: [id: string]
}>()

// ─── Configs ────────────────────────────────────────────────────────────────

const CORNER_RADIUS = 6
const SHADOW_BLUR = 8
const SHADOW_OFFSET = { x: 2, y: 2 }
const SHADOW_OPACITY = 0.15
const PADDING = 10
const LOCK_FONT_SIZE = 14

const groupConfig = computed(() => ({
  x: props.sticky.x,
  y: props.sticky.y,
  width: props.sticky.w,
  height: props.sticky.h,
  draggable: !props.sticky.locked,
  id: props.sticky.id,
  name: 'sticky',
}))

const rectConfig = computed(() => ({
  x: 0,
  y: 0,
  width: props.sticky.w,
  height: props.sticky.h,
  fill: props.sticky.bgColor || '#fde047',
  cornerRadius: CORNER_RADIUS,
  shadowColor: '#000',
  shadowBlur: SHADOW_BLUR,
  shadowOffset: SHADOW_OFFSET,
  shadowOpacity: SHADOW_OPACITY,
  stroke: props.isSelected ? '#3b82f6' : 'transparent',
  strokeWidth: props.isSelected ? 2 : 0,
  opacity: props.sticky.locked ? 0.85 : 1,
}))

const textConfig = computed(() => ({
  x: PADDING,
  y: PADDING,
  width: props.sticky.w - PADDING * 2,
  height: props.sticky.h - PADDING * 2,
  text: props.sticky.text || '',
  fontSize: props.sticky.fontSize || 14,
  fontFamily: 'Inter, system-ui, sans-serif',
  fill: props.sticky.textColor || '#1e293b',
  wrap: 'word',
  ellipsis: true,
  listening: false,
}))

const lockConfig = computed(() => ({
  x: props.sticky.w - LOCK_FONT_SIZE - 6,
  y: 4,
  text: '🔒',
  fontSize: LOCK_FONT_SIZE,
  listening: false,
}))

// ─── Handlers ───────────────────────────────────────────────────────────────

function handleClick(): void {
  emit('select', props.sticky.id)
}

function handleDblClick(): void {
  if (props.sticky.locked) return
  emit('editText', props.sticky.id)
}

function handleDragEnd(e: { target: { x: () => number; y: () => number } }): void {
  emit('dragEnd', props.sticky.id, e.target.x(), e.target.y())
}

function handleTransformEnd(e: { target: { width: () => number; height: () => number; scaleX: () => number; scaleY: () => number } }): void {
  const node = e.target
  const w = Math.max(50, Math.min(800, node.width() * node.scaleX()))
  const h = Math.max(50, Math.min(800, node.height() * node.scaleY()))
  emit('transformEnd', props.sticky.id, w, h)
}
</script>
