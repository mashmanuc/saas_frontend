<template>
  <div class="lc-tree" role="tree">
    <div v-if="!topics.length" class="lc-empty">{{ t('learningContent.panel.noContent') }}</div>

    <div v-for="topic in topics" :key="topic.id" class="lc-topic" role="treeitem">
      <button
        class="lc-topic-header"
        :aria-expanded="store.isTopicExpanded(topic.id)"
        :aria-label="topic.title"
        @click="store.toggleTopic(topic.id)"
      >
        <span class="lc-chevron" :class="{ open: store.isTopicExpanded(topic.id) }">&#9654;</span>
        <span class="lc-topic-title">{{ topic.title }}</span>
        <span class="lc-difficulty-badge">{{ topic.difficulty_level }}</span>
      </button>

      <div v-if="store.isTopicExpanded(topic.id)" class="lc-units" role="group">
        <div v-for="unit in topic.units" :key="unit.id" class="lc-unit" role="treeitem">
          <button
            class="lc-unit-header"
            :aria-expanded="store.isUnitExpanded(unit.id)"
            :aria-label="unit.title"
            @click="store.toggleUnit(unit.id)"
          >
            <span class="lc-chevron" :class="{ open: store.isUnitExpanded(unit.id) }">&#9654;</span>
            <span class="lc-unit-title">{{ unit.title }}</span>
            <span class="lc-item-count">{{ unit.item_count }}</span>
            <span v-if="store.isUnitLoading(unit.id)" class="lc-spinner" aria-label="loading">&#10227;</span>
          </button>

          <div v-if="store.isUnitExpanded(unit.id)" class="lc-items" role="group">
            <ContentItemCard
              v-for="item in store.getUnitItems(unit.id)"
              :key="item.id"
              :item="item"
              @preview="$emit('preview', $event)"
              @drag-start="$emit('dragStart', $event)"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useContentLibraryStore } from '../stores/contentLibraryStore'
import type { Topic, ContentItemSummary, ContentDragPayload } from '../types/learningContent'
import ContentItemCard from './ContentItemCard.vue'

defineProps<{ topics: Topic[] }>()
defineEmits<{
  preview: [item: ContentItemSummary]
  dragStart: [payload: ContentDragPayload]
}>()

const { t } = useI18n()
const store = useContentLibraryStore()
</script>

<style scoped>
.lc-tree {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 0;
}
.lc-empty {
  padding: 24px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.lc-topic-header,
.lc-unit-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 4px;
  text-align: left;
  transition: background 0.15s;
}
.lc-topic-header:hover,
.lc-unit-header:hover {
  background: #f3f4f6;
}
.lc-topic-header:focus-visible,
.lc-unit-header:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 1px;
}
.lc-chevron {
  font-size: 8px;
  color: #9ca3af;
  transition: transform 0.2s;
  flex-shrink: 0;
}
.lc-chevron.open {
  transform: rotate(90deg);
}
.lc-topic-title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1f2937;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-difficulty-badge {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #f3f4f6;
  color: #6b7280;
  flex-shrink: 0;
}
.lc-units {
  padding-left: 16px;
}
.lc-unit-title {
  flex: 1;
  font-size: 12px;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.lc-item-count {
  font-size: 10px;
  color: #9ca3af;
  flex-shrink: 0;
}
.lc-spinner {
  animation: spin 1s linear infinite;
  font-size: 12px;
  color: #6b7280;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.lc-items {
  padding-left: 16px;
}
</style>
