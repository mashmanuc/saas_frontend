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

    <!-- Phase 3.1: Storage quota bar -->
    <StorageQuotaBar v-if="isTutor" :quota="storageQuota" />

    <!-- Header -->
    <div class="content-sidebar__header">
      <span class="content-sidebar__title">
        {{ t('learningContent.panel.lessonTitle') }}
      </span>
      <span class="content-sidebar__count">{{ sidebar.totalCount.value }}</span>
    </div>

    <!-- Phase 11 B8: YouTube URL inline input -->
    <div v-if="isTutor" class="content-sidebar__yt-section">
      <button
        v-if="!showYtInput"
        type="button"
        class="content-sidebar__yt-btn"
        @click="showYtInput = true"
      >
        <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style="vertical-align: -2px">
          <rect x="2" y="4" width="16" height="12" rx="3" fill="#FF0000"/>
          <path d="M8.5 7.5l5 2.5-5 2.5V7.5z" fill="#fff"/>
        </svg>
        + YouTube URL
      </button>
      <div v-else class="content-sidebar__yt-input-row">
        <input
          ref="ytInputRef"
          v-model="ytUrl"
          type="url"
          class="content-sidebar__yt-input"
          placeholder="https://youtube.com/watch?v=..."
          @keydown.enter="submitYouTube"
          @keydown.escape="showYtInput = false"
        />
        <button
          type="button"
          class="content-sidebar__yt-submit"
          :disabled="!ytUrl.trim()"
          @click="submitYouTube"
        >
          +
        </button>
      </div>
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
import { ref, toRef, onMounted, nextTick, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useContentSidebar } from '../../composables/useContentSidebar'
import { parseYouTubeVideoId } from '../../utils/youtubeParser'
import ContentSidebarItem from './ContentSidebarItem.vue'
import StorageQuotaBar from '@/modules/learning-content/components/StorageQuotaBar.vue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import type { StorageQuota } from '@/modules/learning-content/api/learningContentApi'

const props = defineProps<{
  lessonId: string | null
  isTutor: boolean
}>()

const { t } = useI18n()
const sidebar = useContentSidebar(toRef(props, 'lessonId'))

// Phase 3.1: Storage quota
const storageQuota = ref<StorageQuota | null>(null)

async function loadQuota() {
  try {
    storageQuota.value = await learningContentApi.getStorageQuota()
  } catch (e) {
    console.warn('[ContentSidebar] Quota load failed:', e)
  }
}

onMounted(loadQuota)

defineExpose({ reload: () => sidebar.reload() })

// Phase 11 B8: YouTube inline input
const showYtInput = ref(false)
const ytUrl = ref('')
const ytInputRef = ref<HTMLInputElement | null>(null)

const emit = defineEmits<{
  (e: 'youtube-add', url: string): void
}>()

watch(showYtInput, (v) => {
  if (v) nextTick(() => ytInputRef.value?.focus())
})

function submitYouTube(): void {
  const url = ytUrl.value.trim()
  if (!url) return
  const videoId = parseYouTubeVideoId(url)
  if (!videoId) return
  emit('youtube-add', url)
  ytUrl.value = ''
  showYtInput.value = false
}

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

  sidebar.uploadFiles(files).then(loadQuota)
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

/* Phase 11 B8: YouTube inline input */
.content-sidebar__yt-section {
  padding: 4px 12px 8px;
}
.content-sidebar__yt-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 10px;
  background: #fef2f2;
  border: 1px dashed #fca5a5;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  color: #dc2626;
  cursor: pointer;
  transition: background 0.12s;
}
.content-sidebar__yt-btn:hover { background: #fee2e2; }
.content-sidebar__yt-input-row {
  display: flex;
  gap: 4px;
}
.content-sidebar__yt-input {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  font-size: 12px;
  outline: none;
  transition: border-color 0.12s;
}
.content-sidebar__yt-input:focus { border-color: #6366f1; }
.content-sidebar__yt-submit {
  padding: 4px 10px;
  background: #6366f1;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}
.content-sidebar__yt-submit:disabled { opacity: 0.4; cursor: not-allowed; }

.fade-enter-active, .fade-leave-active { transition: opacity 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
