<template>
  <div class="lc-collection-list" role="listbox" :aria-label="t('learningContent.panel.collections')">
    <div v-if="!collections.length" class="lc-empty">{{ t('learningContent.panel.noContent') }}</div>
    <button
      v-for="col in collections"
      :key="col.id"
      role="option"
      class="lc-collection-item"
      :class="{ selected: store.selectedCollection === col.id }"
      :aria-selected="store.selectedCollection === col.id"
      :aria-label="col.title"
      @click="store.selectCollection(col.id)"
    >
      <span class="lc-col-title">{{ col.title }}</span>
      <span class="lc-col-count">{{ col.topic_count }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useContentLibraryStore } from '../stores/contentLibraryStore'
import type { Collection } from '../types/learningContent'

defineProps<{ collections: Collection[] }>()
const { t } = useI18n()
const store = useContentLibraryStore()
</script>

<style scoped>
.lc-collection-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border-color);
}
.lc-empty {
  padding: 16px 12px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 13px;
}
.lc-collection-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 10px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: none;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s;
}
.lc-collection-item:hover {
  background: var(--bg-secondary);
  border-color: var(--border-color);
}
.lc-collection-item.selected {
  background: color-mix(in srgb, var(--accent) 10%, var(--card-bg));
  border-color: color-mix(in srgb, var(--accent) 30%, transparent);
}
.lc-collection-item:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.lc-col-title {
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-col-count {
  font-size: 10px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 1px 6px;
  border-radius: 8px;
  flex-shrink: 0;
}
</style>
