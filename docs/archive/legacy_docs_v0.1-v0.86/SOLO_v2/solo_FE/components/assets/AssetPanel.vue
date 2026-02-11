<template>
  <div class="asset-panel">
    <header class="asset-panel__header">
      <h3>{{ $t('classroom.board.layers') }}</h3>
      <AssetUploader @upload="handleUpload" />
    </header>

    <div class="asset-panel__list">
      <div
        v-for="asset in sortedAssets"
        :key="asset.id"
        class="asset-item"
        :class="{ 'asset-item--selected': selectedId === asset.id }"
        @click="$emit('select', asset.id)"
      >
        <div class="asset-item__preview">
          <img
            v-if="asset.type === 'image' || asset.type === 'svg'"
            :src="asset.src"
            :alt="'Asset'"
          />
          <span v-else class="icon">📄</span>
        </div>

        <div class="asset-item__info">
          <span class="asset-item__type">{{ asset.type.toUpperCase() }}</span>
          <span class="asset-item__size">
            {{ Math.round(asset.width) }}×{{ Math.round(asset.height) }}
          </span>
        </div>

        <div class="asset-item__actions">
          <button
            class="action-btn"
            @click.stop="$emit('toggle-lock', asset.id)"
            :title="asset.locked ? $t('common.unlock') : $t('common.lock')"
          >
            {{ asset.locked ? '🔒' : '🔓' }}
          </button>
          <button
            class="action-btn"
            @click.stop="$emit('move-up', asset.id)"
            :disabled="asset.zIndex >= maxZIndex"
            :title="$t('common.moveUp')"
          >
            ⬆️
          </button>
          <button
            class="action-btn"
            @click.stop="$emit('move-down', asset.id)"
            :disabled="asset.zIndex <= 1"
            :title="$t('common.moveDown')"
          >
            ⬇️
          </button>
          <button
            class="action-btn action-btn--danger"
            @click.stop="$emit('delete', asset.id)"
            :title="$t('solo.delete')"
          >
            🗑️
          </button>
        </div>
      </div>

      <div v-if="assets.length === 0" class="asset-panel__empty">
        <p>{{ $t('solo.assets.empty') }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { AssetLayer } from '../../types/solo'
import AssetUploader from './AssetUploader.vue'

const props = defineProps<{
  assets: AssetLayer[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'upload', file: File, type: 'image' | 'svg' | 'pdf'): void
  (e: 'delete', id: string): void
  (e: 'toggle-lock', id: string): void
  (e: 'move-up', id: string): void
  (e: 'move-down', id: string): void
}>()

const sortedAssets = computed(() =>
  [...props.assets].sort((a, b) => b.zIndex - a.zIndex)
)

const maxZIndex = computed(() =>
  Math.max(...props.assets.map((a) => a.zIndex), 0)
)

function handleUpload(file: File, type: 'image' | 'svg' | 'pdf'): void {
  emit('upload', file, type)
}
</script>

<style scoped>
.asset-panel {
  width: 280px;
  background: var(--card-bg, #fff);
  border-left: 1px solid var(--border-color, #e5e7eb);
  display: flex;
  flex-direction: column;
}

.asset-panel__header {
  padding: 1rem;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.asset-panel__header h3 {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.asset-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.asset-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 0.25rem;
}

.asset-item:hover {
  background: var(--hover-bg, #f3f4f6);
}

.asset-item--selected {
  background: var(--accent-bg, #eff6ff);
  border: 1px solid var(--accent-color, #3b82f6);
}

.asset-item__preview {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-secondary, #f3f4f6);
  display: flex;
  align-items: center;
  justify-content: center;
}

.asset-item__preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-item__info {
  flex: 1;
  min-width: 0;
}

.asset-item__type {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
}

.asset-item__size {
  display: block;
  font-size: 0.625rem;
  color: var(--text-secondary, #6b7280);
}

.asset-item__actions {
  display: flex;
  gap: 0.125rem;
}

.action-btn {
  padding: 0.25rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.75rem;
}

.action-btn:hover {
  background: var(--hover-bg, #f3f4f6);
}

.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.action-btn--danger:hover {
  background: var(--danger-bg, #fef2f2);
}

.asset-panel__empty {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--text-secondary, #6b7280);
}
</style>
