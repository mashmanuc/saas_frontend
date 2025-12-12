<script setup lang="ts">
import { Eye, EyeOff, Lock, Unlock, Plus, Trash2 } from 'lucide-vue-next'
import type { Layer } from '@/core/board/types'

interface Props {
  layers: Layer[]
  activeLayerId: number | null
}

defineProps<Props>()

const emit = defineEmits<{
  (e: 'select', id: number): void
  (e: 'create', name: string): void
  (e: 'delete', id: number): void
  (e: 'toggle-visibility', id: number): void
  (e: 'toggle-lock', id: number): void
}>()

function handleCreate() {
  const name = `Layer ${Date.now()}`
  emit('create', name)
}
</script>

<template>
  <div class="layers-panel">
    <div class="panel-header">
      <h3>Layers</h3>
      <button class="icon-btn" title="Add Layer" @click="handleCreate">
        <Plus :size="18" />
      </button>
    </div>

    <div class="layers-list">
      <div
        v-for="layer in layers"
        :key="layer.id"
        class="layer-item"
        :class="{ active: layer.id === activeLayerId }"
        @click="emit('select', layer.id)"
      >
        <div class="layer-info">
          <span
            class="layer-color"
            :style="{ background: layer.color || '#3b82f6' }"
          />
          <span class="layer-name">{{ layer.name }}</span>
          <span class="layer-count">({{ layer.componentCount }})</span>
        </div>

        <div class="layer-actions">
          <button
            class="icon-btn small"
            :title="layer.visible ? 'Hide' : 'Show'"
            @click.stop="emit('toggle-visibility', layer.id)"
          >
            <Eye v-if="layer.visible" :size="14" />
            <EyeOff v-else :size="14" />
          </button>
          <button
            class="icon-btn small"
            :title="layer.locked ? 'Unlock' : 'Lock'"
            @click.stop="emit('toggle-lock', layer.id)"
          >
            <Lock v-if="layer.locked" :size="14" />
            <Unlock v-else :size="14" />
          </button>
          <button
            class="icon-btn small danger"
            title="Delete"
            :disabled="layers.length <= 1"
            @click.stop="emit('delete', layer.id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layers-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #e0e0e0;
}

.panel-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.layers-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.layer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.layer-item:hover {
  background: #f5f5f5;
}

.layer-item.active {
  background: #e3f2fd;
}

.layer-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.layer-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.layer-name {
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.layer-count {
  font-size: 0.75rem;
  color: #999;
}

.layer-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.2s;
}

.layer-item:hover .layer-actions {
  opacity: 1;
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
}

.icon-btn:hover {
  background: #e0e0e0;
}

.icon-btn.small {
  width: 24px;
  height: 24px;
}

.icon-btn.danger:hover {
  background: #fee2e2;
  color: #ef4444;
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
