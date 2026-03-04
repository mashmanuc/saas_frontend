<template>
  <div
    class="sidebar-item"
    :class="{
      'sidebar-item--processing': !isReady,
      'sidebar-item--failed': item.processing_status === 'failed',
    }"
    :draggable="isTutor && isReady"
    @dragstart="onDragStart"
  >
    <img
      v-if="item.thumbnail_url"
      :src="item.thumbnail_url"
      class="sidebar-item__thumb"
      :alt="item.title"
      loading="lazy"
    />
    <div v-else class="sidebar-item__icon" :aria-hidden="true">
      {{ categoryIcon }}
    </div>

    <span class="sidebar-item__title" :title="item.title">
      {{ item.title }}
    </span>

    <span
      v-if="item.processing_status === 'pending' || item.processing_status === 'processing'"
      class="sidebar-item__badge sidebar-item__badge--pending"
    >
      {{ t('winterboard.contentSidebar.processing') }}
    </span>
    <span
      v-else-if="item.processing_status === 'failed'"
      class="sidebar-item__badge sidebar-item__badge--error"
    >
      {{ t('winterboard.contentSidebar.failed') }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AllowedContentItem, SidebarDragPayload } from '../../types/sidebar'
import { SIDEBAR_DRAG_MIME } from '../../composables/useContentSidebar'

const props = defineProps<{
  item: AllowedContentItem
  isTutor: boolean
}>()

const { t } = useI18n()

const isReady = computed(() =>
  !props.item.processing_status || props.item.processing_status === 'ready',
)

const CATEGORY_ICONS: Record<string, string> = {
  problem: '📐',
  image: '🖼',
  pdf: '📄',
  audio: '🎵',
  video: '▶️',
  presentation: '📊',
}

const categoryIcon = computed(() =>
  CATEGORY_ICONS[props.item.asset_category] ?? '📎',
)

function onDragStart(e: DragEvent) {
  if (!props.isTutor || !isReady.value) {
    e.preventDefault()
    return
  }
  const payload: SidebarDragPayload = {
    content_item_id: props.item.content_item_id as number,
    asset_category: props.item.asset_category,
    content_type: props.item.content_type,
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'
}
</script>

<style scoped>
.sidebar-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid #f1f5f9;
  cursor: grab;
  transition: background 0.1s;
  min-height: 44px;
}
.sidebar-item:hover {
  background: #f8fafc;
}
.sidebar-item--processing {
  opacity: 0.6;
  cursor: not-allowed;
}
.sidebar-item--failed {
  opacity: 0.5;
  background: #fef2f2;
}
.sidebar-item__thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}
.sidebar-item__icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  border-radius: 4px;
  font-size: 18px;
  flex-shrink: 0;
}
.sidebar-item__title {
  flex: 1;
  font-size: 13px;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sidebar-item__badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}
.sidebar-item__badge--pending {
  background: #fef9c3;
  color: #854d0e;
}
.sidebar-item__badge--error {
  background: #fef2f2;
  color: #991b1b;
}
</style>
