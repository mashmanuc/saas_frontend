<template>
  <div
    class="content-sidebar"
    :class="{ 'content-sidebar--dragover': isDragOver }"
    @dragover.prevent="onDragOver"
    @dragleave="isDragOver = false"
    @drop.prevent="onDrop"
  >
    <!-- Drop overlay for file upload from OS -->
    <Transition name="fade">
      <div v-if="isDragOver" class="content-sidebar__drop-overlay">
        {{ t('winterboard.contentSidebar.dropToUpload') }}
      </div>
    </Transition>

    <!-- Header -->
    <div class="content-sidebar__header">
      <span class="content-sidebar__title">
        {{ t('learningContent.panel.lessonTitle') }}
      </span>
      <span class="content-sidebar__count">{{ sidebar.totalCount.value }}</span>
    </div>

    <!-- Loading -->
    <div v-if="sidebar.isLoading.value" class="content-sidebar__loading">
      {{ t('winterboard.contentSidebar.loading') }}
    </div>

    <!-- Error -->
    <div v-else-if="sidebar.error.value" class="content-sidebar__error">
      <span>{{ t(`winterboard.contentSidebar.${sidebar.error.value}`) }}</span>
      <button class="content-sidebar__retry" @click="sidebar.reload">&#8635;</button>
    </div>

    <!-- Empty -->
    <div v-else-if="sidebar.totalCount.value === 0" class="content-sidebar__empty">
      {{ t('learningContent.panel.lessonEmpty') }}
    </div>

    <!-- Grouped items -->
    <template v-else>
      <template v-for="(categoryItems, category) in sidebar.grouped.value" :key="category">
        <div v-if="categoryItems.length > 0" class="content-sidebar__group">
          <div class="content-sidebar__group-header">
            {{ t(`winterboard.contentSidebar.category.${category}`) }}
            <span class="content-sidebar__group-count">{{ categoryItems.length }}</span>
          </div>
          <ContentSidebarItem
            v-for="item in categoryItems"
            :key="item.id || item.content_item_id"
            :item="item"
            :is-tutor="isTutor"
          />
        </div>
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, toRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentSidebar } from '../../composables/useContentSidebar'
import ContentSidebarItem from './ContentSidebarItem.vue'

const props = defineProps<{
  lessonId: string | null
  isTutor: boolean
}>()

const { t } = useI18n()
const sidebar = useContentSidebar(toRef(props, 'lessonId'))

// ── File drag-upload from OS ──
const isDragOver = ref(false)

function onDragOver(e: DragEvent) {
  // Distinguish OS file drag from sidebar content drag
  const hasFile = Array.from(e.dataTransfer?.items ?? [])
    .some(item => item.kind === 'file')
  if (hasFile && props.isTutor) {
    isDragOver.value = true
  }
}

function onDrop(e: DragEvent) {
  isDragOver.value = false

  // Ignore sidebar content drag (handled by canvas)
  if (e.dataTransfer?.getData(sidebar.SIDEBAR_DRAG_MIME)) return

  const files = Array.from(e.dataTransfer?.files ?? [])
  if (!files.length || !props.isTutor) return

  files.forEach(file => sidebar.uploadFile(file))
}
</script>

<style scoped>
.content-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  position: relative;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.content-sidebar--dragover {
  outline: 2px dashed #3b82f6;
  outline-offset: -2px;
  background: #eff6ff;
}
.content-sidebar__drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.1);
  color: #1d4ed8;
  font-size: 14px;
  font-weight: 600;
  z-index: 10;
  pointer-events: none;
}
.content-sidebar__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 12px 8px;
}
.content-sidebar__title {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}
.content-sidebar__count {
  font-size: 11px;
  font-weight: 600;
  background: #e2e8f0;
  color: #475569;
  padding: 1px 6px;
  border-radius: 10px;
}
.content-sidebar__loading,
.content-sidebar__empty {
  padding: 32px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.content-sidebar__error {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  color: #dc2626;
  font-size: 13px;
  background: #fef2f2;
  margin: 8px;
  border-radius: 6px;
}
.content-sidebar__retry {
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #dc2626;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 8px;
}
.content-sidebar__group {
  margin-bottom: 4px;
}
.content-sidebar__group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  background: #f8fafc;
  position: sticky;
  top: 0;
  z-index: 1;
}
.content-sidebar__group-count {
  font-size: 10px;
  background: #e2e8f0;
  color: #475569;
  padding: 0 4px;
  border-radius: 6px;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
