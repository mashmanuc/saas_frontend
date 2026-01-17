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
    
    <!-- v0.88.0: Follow mode toggle -->
    <button
      v-if="showFollowButton"
      class="board-tabs-bar__follow"
      :class="{ 'board-tabs-bar__follow--active': isFollowModeActive }"
      :title="isFollowModeActive ? $t('whiteboard.followMode.stop_following') : $t('whiteboard.followMode.start_following')"
      @click="$emit('toggle-follow')"
      data-testid="follow-mode-toggle"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path>
      </svg>
      <span class="board-tabs-bar__follow-text">
        {{ isFollowModeActive ? $t('whiteboard.followMode.following') : $t('whiteboard.followMode.follow') }}
      </span>
    </button>
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
  showFollowButton?: boolean
  isFollowModeActive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  canCreate: true,
  showFollowButton: false,
  isFollowModeActive: false,
})

defineEmits<{
  switch: [pageId: string]
  add: []
  delete: [pageId: string]
  'toggle-follow': []
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

/* v0.88.0: Follow mode button */
.board-tabs-bar__follow {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin-right: 8px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.board-tabs-bar__follow:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}

.board-tabs-bar__follow--active {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  border-color: #4facfe;
  color: white;
}

.board-tabs-bar__follow--active:hover {
  background: linear-gradient(135deg, #3f9ce8 0%, #00d8e8 100%);
}

.board-tabs-bar__follow svg {
  flex-shrink: 0;
}

.board-tabs-bar__follow-text {
  font-weight: 500;
}

@media (max-width: 768px) {
  .board-tabs-bar__follow-text {
    display: none;
  }
  
  .board-tabs-bar__follow {
    padding: 6px 8px;
  }
}
</style>
