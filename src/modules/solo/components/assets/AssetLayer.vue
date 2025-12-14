<template>
  <div
    class="asset-layer"
    :class="{
      'asset-layer--selected': selected,
      'asset-layer--locked': asset.locked,
    }"
    :style="layerStyle"
    @mousedown="handleMouseDown"
  >
    <!-- Image/SVG content -->
    <img
      v-if="asset.type === 'image' || asset.type === 'svg'"
      :src="asset.src"
      :alt="'Asset'"
      class="asset-layer__content"
      draggable="false"
    />

    <!-- PDF preview (first page) -->
    <div v-else-if="asset.type === 'pdf'" class="asset-layer__pdf">
      <span class="icon">📄</span>
      <span>PDF</span>
    </div>

    <!-- Resize handles (when selected) -->
    <template v-if="selected && !asset.locked">
      <div
        v-for="handle in resizeHandles"
        :key="handle"
        class="asset-layer__handle"
        :class="`asset-layer__handle--${handle}`"
        @mousedown.stop="startResize(handle)"
      />
    </template>

    <!-- Lock indicator -->
    <div v-if="asset.locked" class="asset-layer__lock">
      🔒
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AssetLayer } from '../../types/solo'

const props = defineProps<{
  asset: AssetLayer
  selected: boolean
}>()

const emit = defineEmits<{
  (e: 'select'): void
  (e: 'move', dx: number, dy: number): void
  (e: 'resize', handle: string, dx: number, dy: number): void
}>()

const resizeHandles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const layerStyle = computed(() => ({
  left: `${props.asset.x}px`,
  top: `${props.asset.y}px`,
  width: `${props.asset.width}px`,
  height: `${props.asset.height}px`,
  transform: `rotate(${props.asset.rotation}deg)`,
  zIndex: props.asset.zIndex,
}))

function handleMouseDown(e: MouseEvent): void {
  if (props.asset.locked) return

  emit('select')

  const startX = e.clientX
  const startY = e.clientY

  function onMouseMove(moveEvent: MouseEvent): void {
    const dx = moveEvent.clientX - startX
    const dy = moveEvent.clientY - startY
    emit('move', dx, dy)
  }

  function onMouseUp(): void {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startResize(handle: string): void {
  // Resize logic would be implemented here
  console.log('Start resize:', handle)
}
</script>

<style scoped>
.asset-layer {
  position: absolute;
  cursor: move;
  user-select: none;
}

.asset-layer--selected {
  outline: 2px solid var(--accent-color, #3b82f6);
}

.asset-layer--locked {
  cursor: not-allowed;
  opacity: 0.8;
}

.asset-layer__content {
  width: 100%;
  height: 100%;
  object-fit: contain;
  pointer-events: none;
}

.asset-layer__pdf {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary, #f3f4f6);
  border: 1px solid var(--border-color, #e5e7eb);
  border-radius: 4px;
}

.asset-layer__pdf .icon {
  font-size: 2rem;
}

.asset-layer__handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: white;
  border: 2px solid var(--accent-color, #3b82f6);
  border-radius: 2px;
}

.asset-layer__handle--nw { top: -5px; left: -5px; cursor: nwse-resize; }
.asset-layer__handle--n { top: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
.asset-layer__handle--ne { top: -5px; right: -5px; cursor: nesw-resize; }
.asset-layer__handle--e { top: 50%; right: -5px; transform: translateY(-50%); cursor: ew-resize; }
.asset-layer__handle--se { bottom: -5px; right: -5px; cursor: nwse-resize; }
.asset-layer__handle--s { bottom: -5px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
.asset-layer__handle--sw { bottom: -5px; left: -5px; cursor: nesw-resize; }
.asset-layer__handle--w { top: 50%; left: -5px; transform: translateY(-50%); cursor: ew-resize; }

.asset-layer__lock {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 0.75rem;
}
</style>
