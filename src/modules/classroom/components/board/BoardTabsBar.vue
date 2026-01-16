<template>
  <div class="board-tabs-bar">
    <div class="board-tabs-bar__scroll-container" ref="scrollContainer">
      <div class="board-tabs-bar__tabs">
        <button
          v-for="page in pages"
          :key="page.id"
          class="board-tab"
          :class="{ 'board-tab--active': page.id === activePageId }"
          :title="page.title"
          @click="$emit('switch', page.id)"
        >
          <span class="board-tab__title">{{ page.title || `Page ${page.index + 1}` }}</span>
          <button
            v-if="pages.length > 1"
            class="board-tab__close"
            :title="$t('whiteboard.deletePage')"
            @click.stop="$emit('delete', page.id)"
          >
            ×
          </button>
        </button>
        <button
          class="board-tab board-tab--add"
          :title="$t('whiteboard.addPage')"
          :disabled="!canCreate"
          @click="$emit('add')"
        >
          +
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { PageMetadata } from '@/core/whiteboard/adapters'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

interface Props {
  pages: PageMetadata[]
  activePageId: string | null
  canCreate?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canCreate: true,
})

defineEmits<{
  switch: [pageId: string]
  add: []
  delete: [pageId: string]
}>()

const scrollContainer = ref<HTMLElement | null>(null)

// Auto-scroll to active tab
watch(() => props.activePageId, async () => {
  await nextTick()
  scrollToActiveTab()
})

function scrollToActiveTab() {
  if (!scrollContainer.value) return
  
  const activeTab = scrollContainer.value.querySelector('.board-tab--active') as HTMLElement
  if (!activeTab) return

  const container = scrollContainer.value
  const tabLeft = activeTab.offsetLeft
  const tabWidth = activeTab.offsetWidth
  const containerWidth = container.clientWidth
  const scrollLeft = container.scrollLeft

  // Check if tab is not fully visible
  if (tabLeft < scrollLeft || tabLeft + tabWidth > scrollLeft + containerWidth) {
    // Scroll to center the tab
    container.scrollTo({
      left: tabLeft - containerWidth / 2 + tabWidth / 2,
      behavior: 'smooth',
    })
  }
}
</script>

<style scoped>
.board-tabs-bar {
  display: flex;
  align-items: center;
  background: var(--color-background-soft);
  border-top: 1px solid var(--color-border);
  height: 40px;
  overflow: hidden;
}

.board-tabs-bar__scroll-container {
  flex: 1;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}

.board-tabs-bar__scroll-container::-webkit-scrollbar {
  height: 4px;
}

.board-tabs-bar__scroll-container::-webkit-scrollbar-track {
  background: transparent;
}

.board-tabs-bar__scroll-container::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 2px;
}

.board-tabs-bar__tabs {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  min-width: min-content;
}

.board-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px 6px 0 0;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
  min-width: 80px;
  max-width: 200px;
}

.board-tab:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.board-tab--active {
  background: var(--color-background-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
  font-weight: 500;
}

.board-tab__title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.board-tab__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 3px;
  font-size: 16px;
  line-height: 1;
  color: var(--color-text-secondary);
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
}

.board-tab:hover .board-tab__close {
  opacity: 1;
}

.board-tab__close:hover {
  background: var(--color-danger-soft);
  color: var(--color-danger);
}

.board-tab--add {
  min-width: 40px;
  max-width: 40px;
  padding: 6px;
  justify-content: center;
  font-size: 18px;
  font-weight: 500;
}

.board-tab--add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.board-tab--add:not(:disabled):hover {
  background: var(--color-primary-soft);
  border-color: var(--color-primary);
  color: var(--color-primary);
}
</style>
