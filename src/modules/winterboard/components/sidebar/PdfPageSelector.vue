<template>
  <div class="pdf-selector">
    <div class="pdf-selector__header">
      <span class="pdf-selector__title">{{ item.title }}</span>
      <span class="pdf-selector__count">
        {{ t('winterboard.pdfSelector.pageCount', { count: sortedPages.length }) }}
      </span>
      <button
        class="pdf-selector__close"
        type="button"
        :aria-label="t('winterboard.pdfSelector.close')"
        @click="$emit('close')"
      >
        &#x2715;
      </button>
    </div>

    <!-- PLAN_v4: Drag full PDF = document_viewer (NO extra → backend returns document_viewer) -->
    <div
      class="pdf-selector__full"
      draggable="true"
      @dragstart="dragFullDocument($event)"
      @dragend="onDragEnd"
    >
      <span class="pdf-selector__full-icon">&#x1F4C4;</span>
      <span>{{ t('winterboard.pdfSelector.dragFull') }}</span>
    </div>

    <!-- Page thumbnail grid -->
    <div v-if="sortedPages.length > 0" class="pdf-selector__grid">
      <div
        v-for="page in sortedPages"
        :key="page.number"
        class="pdf-selector__page"
        draggable="true"
        @dragstart="dragPage($event, page.number)"
        @dragend="onDragEnd"
      >
        <img
          :src="page.thumbnail_url"
          :alt="t('winterboard.pdfSelector.pageAlt', { n: page.number })"
          class="pdf-selector__page-thumb"
          loading="lazy"
          draggable="false"
        />
        <span class="pdf-selector__page-num">{{ page.number }}</span>
      </div>
    </div>

    <!-- Loading pages lazily -->
    <div v-else-if="isLoadingPages" class="pdf-selector__empty pdf-selector__empty--loading">
      <span class="pdf-selector__loading-icon">&#x23F3;</span>
      <span>{{ t('winterboard.pdfSelector.loadingPages') }}</span>
    </div>

    <!-- Empty state: processing / failed / ready but no pages -->
    <div v-else class="pdf-selector__empty">
      <MediaStatusGuard :status="effectiveStatus" @retry="$emit('retry')">
        <span>{{ t('winterboard.pdfSelector.noPages') }}</span>
      </MediaStatusGuard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AllowedContentItem } from '../../types/sidebar'
import { SIDEBAR_DRAG_MIME } from '../../types/boardDrop'
import MediaStatusGuard from '../shared/MediaStatusGuard.vue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'

const props = defineProps<{
  item: AllowedContentItem
}>()

defineEmits<{
  close: []
  retry: []
}>()

const { t } = useI18n()

// Lazily loaded pages — populated on mount if item.pages is missing
const lazyPages = ref<Record<string, { thumbnail_url: string }> | null>(null)
const isLoadingPages = ref(false)

const sortedPages = computed(() => {
  const pages = lazyPages.value ?? props.item.pages ?? {}
  return Object.entries(pages)
    .map(([num, data]) => ({
      number: parseInt(num, 10),
      thumbnail_url: data.thumbnail_url,
    }))
    .sort((a, b) => a.number - b.number)
})

// If status='ready' but pages missing → display as 'pending' (backend will fix via validate hook)
const effectiveStatus = computed(() => {
  if (
    sortedPages.value.length === 0 &&
    (props.item.processing_status === 'ready' || !props.item.processing_status)
  ) {
    return 'pending'
  }
  return props.item.processing_status ?? 'ready'
})

// Load pages on mount if not present in props
onMounted(async () => {
  const hasPropPages = props.item.pages && Object.keys(props.item.pages).length > 0
  if (hasPropPages) return
  if (!props.item.content_item_id) return
  if (props.item.processing_status === 'failed') return

  isLoadingPages.value = true
  try {
    const detail = await learningContentApi.getItemDetail(props.item.content_item_id as number)
    const raw = (detail as unknown as Record<string, unknown>)
    const cj = (raw.data as Record<string, unknown>)?.content_json
      ?? (raw.content_json as Record<string, unknown>)
      ?? {}
    const pages = (cj as Record<string, unknown>).pages as Record<string, { thumbnail_url: string }> | undefined
    if (pages && Object.keys(pages).length > 0) {
      lazyPages.value = pages
    }
  } catch {
    // Non-critical — silently fall through to "no pages" state
  } finally {
    isLoadingPages.value = false
  }
})

// WS listener: backend sends 'content.processing_complete' when Celery finishes
function onProcessingComplete(e: Event) {
  const detail = (e as CustomEvent).detail
  if (!detail || detail.content_item_id !== props.item.content_item_id) return
  const pages = detail.pages as Record<string, { thumbnail_url: string }> | undefined
  if (pages && Object.keys(pages).length > 0) {
    lazyPages.value = pages
  }
}

window.addEventListener('content:processing-complete', onProcessingComplete)
onUnmounted(() => {
  window.removeEventListener('content:processing-complete', onProcessingComplete)
})

function dragPage(e: DragEvent, pageNumber: number) {
  const payload = {
    content_item_id: props.item.content_item_id,
    asset_category: 'pdf',
    content_type: 'pdf',
    extra: { page_number: pageNumber },
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'

  // Ghost drag preview — use page thumbnail
  const pageThumbnail = sortedPages.value.find(p => p.number === pageNumber)?.thumbnail_url
    ?? (sortedPages.value[0]?.thumbnail_url ?? null)

  window.dispatchEvent(new CustomEvent('wb-drag-preview', {
    detail: {
      asset_category: 'pdf',
      thumbnail_url: pageThumbnail ?? null,
      title: `${props.item.title} — стор. ${pageNumber}`,
    },
  }))

  // Hide browser native drag ghost
  const phantom = document.createElement('div')
  phantom.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0'
  document.body.appendChild(phantom)
  e.dataTransfer!.setDragImage(phantom, 0, 0)
  requestAnimationFrame(() => { if (phantom.parentNode) document.body.removeChild(phantom) })
}

// PLAN_v4: Drag full document — NO extra → backend returns type='document_viewer'
function dragFullDocument(e: DragEvent) {
  const payload = {
    content_item_id: props.item.content_item_id,
    asset_category: 'pdf',
    content_type: 'pdf',
    // NO extra → backend detects whole-document drag
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'

  window.dispatchEvent(new CustomEvent('wb-drag-preview', {
    detail: {
      asset_category: 'pdf',
      thumbnail_url: sortedPages.value[0]?.thumbnail_url ?? null,
      title: props.item.title,
    },
  }))

  const phantom = document.createElement('div')
  phantom.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0'
  document.body.appendChild(phantom)
  e.dataTransfer!.setDragImage(phantom, 0, 0)
  requestAnimationFrame(() => { if (phantom.parentNode) document.body.removeChild(phantom) })
}

function onDragEnd() {
  window.dispatchEvent(new CustomEvent('wb-drag-stop'))
}
</script>

<style scoped>
.pdf-selector {
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
  max-height: 400px;
  overflow-y: auto;
  width: 100%;
}
.pdf-selector__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  position: sticky;
  top: 0;
  background: #fff;
  z-index: 1;
}
.pdf-selector__title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pdf-selector__count {
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}
.pdf-selector__close {
  background: none;
  border: none;
  font-size: 14px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
}
.pdf-selector__close:hover {
  color: #475569;
}
.pdf-selector__full {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  cursor: grab;
  border-bottom: 1px solid #f1f5f9;
  font-size: 12px;
  color: #3b82f6;
  transition: background 0.1s;
}
.pdf-selector__full:hover {
  background: #f0f9ff;
}
.pdf-selector__full-icon {
  font-size: 16px;
}
.pdf-selector__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 8px;
}
.pdf-selector__page {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: grab;
  border-radius: 4px;
  padding: 4px;
  transition: background 0.1s;
}
.pdf-selector__page:hover {
  background: #f1f5f9;
}
.pdf-selector__page-thumb {
  width: 72px;
  height: 96px;
  object-fit: cover;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
}
.pdf-selector__page-num {
  font-size: 10px;
  color: #64748b;
}
.pdf-selector__empty {
  padding: 24px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.pdf-selector__empty--loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #64748b;
}
.pdf-selector__loading-icon {
  font-size: 15px;
  animation: pdf-spin 1.2s linear infinite;
}
@keyframes pdf-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
