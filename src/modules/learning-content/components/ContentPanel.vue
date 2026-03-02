<template>
  <div class="lc-panel">
    <ContentSearchBar />

    <!-- Phase 2: Ownership filter -->
    <div class="lc-ownership-filter">
      <select
        v-model="ownershipFilter"
        class="lc-ownership-select"
        :aria-label="t('learningContent.ownership.all')"
        data-test="ownership-filter"
        @change="onOwnershipFilterChange"
      >
        <option value="">{{ t('learningContent.ownership.all') }}</option>
        <option value="PLATFORM">{{ t('learningContent.ownership.PLATFORM') }}</option>
        <option value="TUTOR">{{ t('learningContent.ownership.TUTOR') }}</option>
        <option value="me">{{ t('learningContent.ownership.myItems') }}</option>
      </select>
    </div>

    <div v-if="store.isLoading" class="lc-loading">
      {{ t('learningContent.panel.loading') }}
    </div>

    <div v-else-if="store.error" class="lc-error">
      <span>{{ store.error }}</span>
      <button class="lc-retry-btn" aria-label="Retry" @click="retry">&#8635;</button>
    </div>

    <template v-else-if="store.searchMode">
      <div v-if="store.isSearching" class="lc-loading">
        {{ t('learningContent.panel.loading') }}
      </div>
      <div v-else-if="!store.searchResults?.items.length" class="lc-empty">
        {{ t('learningContent.search.noResults') }}
      </div>
      <div v-else class="lc-search-results" role="list">
        <ContentItemCard
          v-for="item in store.searchResults!.items"
          :key="item.id"
          :item="item"
          @preview="previewItem = $event"
          @drag-start="$emit('dragStart', $event)"
        />
      </div>
    </template>

    <template v-else>
      <ContentSubjectTabs
        v-if="store.subjects.length"
        :subjects="store.subjects"
      />

      <ContentCollectionList
        v-if="store.selectedSubject"
        :collections="store.collections"
      />

      <ContentTree
        v-if="store.collectionTree"
        :topics="store.collectionTree.topics"
        @preview="previewItem = $event"
        @drag-start="$emit('dragStart', $event)"
      />

      <div v-if="!store.selectedSubject" class="lc-hint">
        {{ t('learningContent.panel.dragHint') }}
      </div>
    </template>

    <ContentItemPreview :item="previewItem" @close="previewItem = null" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentLibraryStore } from '../stores/contentLibraryStore'
import type { ContentItemSummary, ContentDragPayload } from '../types/learningContent'
import ContentSearchBar from './ContentSearchBar.vue'
import ContentSubjectTabs from './ContentSubjectTabs.vue'
import ContentCollectionList from './ContentCollectionList.vue'
import ContentTree from './ContentTree.vue'
import ContentItemCard from './ContentItemCard.vue'
import ContentItemPreview from './ContentItemPreview.vue'

defineProps<{ sessionId?: string | null }>()
defineEmits<{
  dragStart: [payload: ContentDragPayload]
  itemDrop: [payload: ContentDragPayload]
}>()

const { t } = useI18n()
const store = useContentLibraryStore()
const previewItem = ref<ContentItemSummary | null>(null)
const ownershipFilter = ref('')

onMounted(() => {
  if (!store.subjects.length) {
    store.fetchSubjects()
  }
})

function retry() {
  store.error = null
  store.fetchSubjects()
}

function onOwnershipFilterChange() {
  const val = ownershipFilter.value
  if (val === 'me') {
    store.searchParams.owner = 'me'
    store.searchParams.ownership_type = ''
  } else {
    store.searchParams.owner = ''
    store.searchParams.ownership_type = val as any
  }
  // Re-trigger search if in search mode
  if (store.searchMode && store.searchQuery) {
    store.searchItems({ ...store.searchParams, q: store.searchQuery })
  }
}
</script>

<style scoped>
.lc-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow-y: auto;
  background: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.lc-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  color: #9ca3af;
  font-size: 13px;
  gap: 8px;
}
.lc-error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  color: #dc2626;
  font-size: 13px;
  background: #fef2f2;
  margin: 8px;
  border-radius: 6px;
}
.lc-retry-btn {
  background: none;
  border: 1px solid #fca5a5;
  border-radius: 4px;
  color: #dc2626;
  font-size: 14px;
  cursor: pointer;
  padding: 2px 8px;
}
.lc-retry-btn:hover {
  background: #fee2e2;
}
.lc-retry-btn:focus-visible {
  outline: 2px solid #dc2626;
  outline-offset: 1px;
}
.lc-empty {
  padding: 32px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.lc-hint {
  padding: 32px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.lc-search-results {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 8px;
}
.lc-ownership-filter {
  padding: 4px 8px;
}
.lc-ownership-select {
  width: 100%;
  border-radius: 6px;
  border: 1px solid #e5e7eb;
  padding: 4px 8px;
  background: #f9fafb;
  font-size: 12px;
  color: #374151;
  cursor: pointer;
  transition: border-color 0.15s;
}
.lc-ownership-select:focus {
  outline: none;
  border-color: #4f46e5;
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.15);
}
</style>
