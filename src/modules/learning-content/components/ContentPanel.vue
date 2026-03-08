<template>
  <div class="lc-panel">
    <!-- Header: different for lesson vs library mode -->
    <div class="lc-panel-header">
      <span class="lc-panel-title">
        {{ store.isLessonMode
          ? t('learningContent.panel.lessonTitle')
          : t('learningContent.panel.title')
        }}
      </span>
    </div>

    <ContentSearchBar v-if="!store.isLessonMode" />

    <!-- Phase 1c: Storage quota bar -->
    <StorageQuotaBar
      v-if="storageQuota && !store.isLessonMode"
      :quota="storageQuota"
    />

    <!-- Ownership filter: only in library mode -->
    <div v-if="!store.isLessonMode" class="lc-ownership-filter">
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

    <!-- Phase 2: Lesson runtime banner -->
    <div v-if="lessonId && lessonRuntime.isActive" class="lc-lesson-banner">
      <span>{{ t('winterboard.lesson.materialsBanner') }}</span>
      <span class="lc-lesson-badge">{{ store.lessonItems.length }}</span>
    </div>

    <!-- LESSON MODE -->
    <template v-else-if="store.isLessonMode">
      <div v-if="!store.lessonItems.length" class="lc-empty">
        {{ t('learningContent.panel.lessonEmpty') }}
      </div>
      <div v-else class="lc-search-results" role="list">
        <ContentItemCard
          v-for="item in store.lessonItems"
          :key="item.id"
          :item="item"
          @preview="previewItem = $event"
          @drag-start="$emit('dragStart', $event)"
          @delete="onDeleteItem"
        />
      </div>
    </template>

    <!-- SEARCH MODE -->
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
          @delete="onDeleteItem"
        />
      </div>
    </template>

    <!-- LIBRARY / TREE MODE -->
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

    <!-- Phase 1c: Upload zone (library mode only) -->
    <div
      v-if="!store.isLessonMode"
      class="lc-upload-zone"
      :class="{ 'lc-upload-zone--active': isDragOverUpload }"
      @dragover.prevent="onDragOverUpload"
      @dragleave="isDragOverUpload = false"
      @drop.prevent="onUploadDrop"
    >
      <span v-if="isUploading" class="lc-upload-spinner">{{ t('learningContent.upload.uploading') }}</span>
      <span v-else>{{ t('learningContent.upload.dropHere') }}</span>
    </div>

    <ContentItemPreview :item="previewItem" @close="previewItem = null" />

    <!-- Phase 1c: Delete confirmation dialog -->
    <Teleport to="body">
      <div v-if="deleteTarget" class="lc-delete-overlay" @click.self="cancelDelete">
        <div class="lc-delete-dialog" role="alertdialog" :aria-label="t('learningContent.actions.confirmDelete')">
          <p class="lc-delete-msg">{{ t('learningContent.actions.confirmDeleteMessage', { title: deleteTarget.title }) }}</p>
          <div class="lc-delete-actions">
            <button class="lc-delete-cancel" @click="cancelDelete">
              {{ t('learningContent.actions.cancel') }}
            </button>
            <button class="lc-delete-confirm" :disabled="isDeleting" @click="confirmDelete">
              {{ isDeleting ? t('learningContent.actions.deleting') : t('learningContent.actions.confirmDeleteBtn') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentLibraryStore } from '../stores/contentLibraryStore'
import { useLessonRuntimeStore } from '../stores/useLessonRuntimeStore'
import { learningContentApi } from '../api/learningContentApi'
import type { ContentItemSummary, ContentDragPayload } from '../types/learningContent'
import ContentSearchBar from './ContentSearchBar.vue'
import ContentSubjectTabs from './ContentSubjectTabs.vue'
import ContentCollectionList from './ContentCollectionList.vue'
import ContentTree from './ContentTree.vue'
import ContentItemCard from './ContentItemCard.vue'
import ContentItemPreview from './ContentItemPreview.vue'
import StorageQuotaBar from './StorageQuotaBar.vue'
import type { StorageQuota } from '../api/learningContentApi'

const props = defineProps<{
  sessionId?: string | null
  lessonId?: number | null
}>()
defineEmits<{
  dragStart: [payload: ContentDragPayload]
  itemDrop: [payload: ContentDragPayload]
}>()

const { t } = useI18n()
const store = useContentLibraryStore()
const lessonRuntime = useLessonRuntimeStore()
const previewItem = ref<ContentItemSummary | null>(null)
const ownershipFilter = ref('')
const storageQuota = ref<StorageQuota | null>(null)

onMounted(async () => {
  if (props.lessonId) {
    store.enterLessonMode(props.lessonId)
  } else if (!store.subjects.length) {
    store.fetchSubjects()
  }

  // Phase 1c: Fetch storage quota (non-blocking)
  if (!props.lessonId) {
    try {
      storageQuota.value = await learningContentApi.getStorageQuota()
    } catch {
      // Quota display is non-critical
    }
  }
})

// Watch for lessonId prop changes (e.g. navigating between lessons)
watch(() => props.lessonId, (newId) => {
  if (newId) {
    store.enterLessonMode(newId)
  } else {
    store.exitLessonMode()
  }
})

function retry() {
  store.error = null
  if (store.isLessonMode) {
    store.fetchLessonItems()
  } else {
    store.fetchSubjects()
  }
}

// Phase 1c: Delete logic
const isDeleting = ref(false)
const deleteTarget = ref<ContentItemSummary | null>(null)

function onDeleteItem(item: ContentItemSummary) {
  deleteTarget.value = item
}

async function confirmDelete() {
  if (!deleteTarget.value || isDeleting.value) return
  isDeleting.value = true
  try {
    await learningContentApi.deleteContentItem(deleteTarget.value.id)
    // Refresh current view
    if (store.searchMode && store.searchQuery) {
      store.searchItems({ ...store.searchParams, q: store.searchQuery })
    } else if (store.isLessonMode) {
      store.fetchLessonItems()
    } else {
      // Re-fetch current tree
      if (store.selectedCollection) {
        store.fetchCollectionTree(store.selectedCollection)
      }
    }
    deleteTarget.value = null
  } catch (err) {
    console.error('[ContentPanel] Delete failed:', err)
  } finally {
    isDeleting.value = false
  }
}

function cancelDelete() {
  deleteTarget.value = null
}

// Phase 1c: Upload zone logic
const isDragOverUpload = ref(false)
const isUploading = ref(false)

function onDragOverUpload(event: DragEvent) {
  // Skip if this is a sidebar content drag (not a file upload)
  const types = event.dataTransfer?.types || []
  if (types.includes('application/learning-content')) return
  isDragOverUpload.value = true
}

async function onUploadDrop(event: DragEvent) {
  isDragOverUpload.value = false
  const files = event.dataTransfer?.files
  if (!files || files.length === 0) return

  // Skip if this is a sidebar content drag (not a file upload)
  const types = event.dataTransfer?.types || []
  if (types.includes('application/learning-content')) return

  const file = files[0]
  isUploading.value = true
  try {
    const formData = new FormData()
    formData.append('file', file)
    await learningContentApi.uploadFile(formData)
    // Refresh storage quota
    try {
      storageQuota.value = await learningContentApi.getStorageQuota()
    } catch { /* non-critical */ }
    // Refresh view if in search mode
    if (store.searchMode && store.searchQuery) {
      store.searchItems({ ...store.searchParams, q: store.searchQuery })
    }
  } catch (err: any) {
    const status = err?.response?.status
    if (status === 507) {
      console.warn('[ContentPanel] Storage quota exceeded')
    }
    console.error('[ContentPanel] Upload failed:', err)
  } finally {
    isUploading.value = false
  }
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
.lc-panel-header {
  padding: 8px 12px;
  border-bottom: 1px solid #e5e7eb;
}
.lc-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
}
.lc-lesson-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #eff6ff;
  border-bottom: 1px solid #dbeafe;
  font-size: 12px;
  font-weight: 500;
  color: #1e40af;
}
.lc-lesson-badge {
  padding: 1px 7px;
  background: #2563eb;
  color: white;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
}
/* Phase 1c: Delete confirmation dialog */
.lc-delete-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lc-delete-dialog {
  background: white;
  border-radius: 12px;
  padding: 20px 24px;
  max-width: 360px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
.lc-delete-msg {
  font-size: 14px;
  color: #374151;
  margin: 0 0 16px;
  line-height: 1.5;
}
.lc-delete-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.lc-delete-cancel {
  padding: 6px 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: white;
  color: #374151;
  font-size: 13px;
  cursor: pointer;
}
.lc-delete-cancel:hover { background: #f3f4f6; }
.lc-delete-confirm {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  background: #dc2626;
  color: white;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}
.lc-delete-confirm:hover { background: #b91c1c; }
.lc-delete-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
/* Phase 1c: Upload zone */
.lc-upload-zone {
  margin: 8px;
  padding: 12px;
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
  cursor: pointer;
  transition: border-color 0.2s, background 0.2s;
}
.lc-upload-zone:hover,
.lc-upload-zone--active {
  border-color: #4f46e5;
  background: #f5f3ff;
  color: #4f46e5;
}
.lc-upload-spinner {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #4f46e5;
}
</style>
