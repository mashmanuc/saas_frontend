<template>
  <div class="docx-selector">
    <div class="docx-selector__header">
      <span class="docx-selector__title">{{ item.title }}</span>
      <span class="docx-selector__count">
        {{ sortedPages.length }} стор.
      </span>
      <button
        class="docx-selector__close"
        type="button"
        aria-label="Закрити"
        @click="$emit('close')"
      >
        &#x2715;
      </button>
    </div>

    <!-- PLAN_v4: Drag full document = document_viewer (NO extra → backend returns document_viewer) -->
    <div
      class="docx-selector__full"
      draggable="true"
      @dragstart="dragFullDocx($event)"
      @dragend="onDragEnd"
    >
      <span class="docx-selector__full-icon">&#x1F4DD;</span>
      <span>Перетягнути весь документ</span>
    </div>

    <!-- Page thumbnail grid -->
    <div v-if="sortedPages.length > 0" class="docx-selector__grid">
      <div
        v-for="page in sortedPages"
        :key="page.number"
        class="docx-selector__page"
        draggable="true"
        @dragstart="dragPage($event, page.number)"
        @dragend="onDragEnd"
      >
        <img
          :src="page.image_url"
          :alt="`Page ${page.number}`"
          class="docx-selector__page-thumb"
          loading="lazy"
          draggable="false"
        />
        <span class="docx-selector__page-num">{{ page.number }}</span>
        <!-- Touch/hover «+»: додати сторінку в центр дошки (альтернатива drag). -->
        <button
          v-if="placeContent"
          type="button"
          class="docx-selector__add-btn"
          :title="`+ ${page.number}`"
          @click.stop="addPage(page.number)"
        >+</button>
      </div>
    </div>

    <!-- Loading pages lazily -->
    <div v-else-if="isLoadingPages" class="docx-selector__empty docx-selector__empty--loading">
      <span class="docx-selector__loading-icon">&#x23F3;</span>
      <span>Loading pages...</span>
    </div>

    <!-- Empty state: processing / failed / ready but no pages -->
    <div v-else class="docx-selector__empty">
      <MediaStatusGuard :status="effectiveStatus" @retry="$emit('retry')">
        <span>No pages available</span>
      </MediaStatusGuard>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * Phase 35.5: DocxPageSelector — sidebar panel for DOCX page thumbnails.
 * Identical pattern to PdfPageSelector. Documents use content_json.pages
 * with image_url (not thumbnail_url) per page.
 */
import { computed, ref, onMounted, onUnmounted } from 'vue'
import type { AllowedContentItem } from '../../types/sidebar'
import { SIDEBAR_DRAG_MIME } from '../../types/boardDrop'
import MediaStatusGuard from '../shared/MediaStatusGuard.vue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import { usePlaceSidebarContent } from '../../composables/usePlaceSidebarContent'

// Touch «+» → кладе сторінку в центр видимої дошки (null у read-only контексті).
const placeContent = usePlaceSidebarContent()

const props = defineProps<{
  item: AllowedContentItem
}>()

defineEmits<{
  close: []
  retry: []
}>()

// Lazily loaded pages
const lazyPages = ref<Record<string, { image_url: string }> | null>(null)
const isLoadingPages = ref(false)

const sortedPages = computed(() => {
  const pages = lazyPages.value ?? props.item.pages ?? {}
  return Object.entries(pages)
    .map(([num, data]) => ({
      number: parseInt(num, 10),
      // Backend document_service stores image_url (not thumbnail_url)
      image_url: (data as Record<string, string>).image_url
        ?? (data as Record<string, string>).thumbnail_url
        ?? '',
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
    const raw = detail as unknown as Record<string, unknown>
    const cj = (raw.data as Record<string, unknown>)?.content_json
      ?? (raw.content_json as Record<string, unknown>)
      ?? {}
    const pages = (cj as Record<string, unknown>).pages as Record<string, { image_url: string }> | undefined
    if (pages && Object.keys(pages).length > 0) {
      lazyPages.value = pages
    }
  } catch {
    // Non-critical
  } finally {
    isLoadingPages.value = false
  }
})

// WS listener: backend sends 'content.processing_complete' when Celery finishes
function onProcessingComplete(e: Event) {
  const detail = (e as CustomEvent).detail
  if (!detail || detail.content_item_id !== props.item.content_item_id) return
  const pages = detail.pages as Record<string, { image_url: string }> | undefined
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
    asset_category: 'document',
    content_type: 'document',
    extra: { page_number: pageNumber },
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'

  // Ghost drag preview
  const pageThumbnail = sortedPages.value.find(p => p.number === pageNumber)?.image_url
    ?? (sortedPages.value[0]?.image_url ?? null)

  window.dispatchEvent(new CustomEvent('wb-drag-preview', {
    detail: {
      asset_category: 'document',
      thumbnail_url: pageThumbnail ?? null,
      title: `${props.item.title} — p.${pageNumber}`,
    },
  }))

  // Hide browser native drag ghost
  const phantom = document.createElement('div')
  phantom.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0'
  document.body.appendChild(phantom)
  e.dataTransfer!.setDragImage(phantom, 0, 0)
  requestAnimationFrame(() => { if (phantom.parentNode) document.body.removeChild(phantom) })
}

// PLAN_v4: Drag full DOCX — NO extra → backend returns type='document_viewer'
function dragFullDocx(e: DragEvent) {
  const payload = {
    content_item_id: props.item.content_item_id,
    asset_category: 'document',
    content_type: 'document',
    // NO extra → backend detects whole-document drag
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'

  window.dispatchEvent(new CustomEvent('wb-drag-preview', {
    detail: {
      asset_category: 'document',
      thumbnail_url: sortedPages.value[0]?.image_url ?? null,
      title: props.item.title,
    },
  }))

  const phantom = document.createElement('div')
  phantom.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0'
  document.body.appendChild(phantom)
  e.dataTransfer!.setDragImage(phantom, 0, 0)
  requestAnimationFrame(() => { if (phantom.parentNode) document.body.removeChild(phantom) })
}

function addPage(pageNumber: number) {
  placeContent?.({
    content_item_id: props.item.content_item_id,
    asset_category: 'document',
    content_type: 'document',
    extra: { page_number: pageNumber },
  })
}

function onDragEnd() {
  window.dispatchEvent(new CustomEvent('wb-drag-stop'))
}
</script>

<style scoped>
.docx-selector {
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
  max-height: 400px;
  overflow-y: auto;
  width: 100%;
}
.docx-selector__header {
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
.docx-selector__title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.docx-selector__count {
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}
.docx-selector__close {
  background: none;
  border: none;
  font-size: 14px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
}
.docx-selector__close:hover { color: #475569; }
.docx-selector__full {
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
.docx-selector__full:hover { background: #f0f9ff; }
.docx-selector__full-icon { font-size: 16px; }
.docx-selector__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: 8px;
}
.docx-selector__page {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  cursor: grab;
  border-radius: 4px;
  padding: 4px;
  transition: background 0.1s;
}
.docx-selector__page:hover { background: #f1f5f9; }

/* «+» додати сторінку — hover-reveal на десктопі, постійно на тачі. */
.docx-selector__add-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  display: none;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 5px;
  border: 1px solid #c7d2fe;
  background: #f5f3ff;
  color: #6366f1;
  font-size: 16px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  z-index: 2;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.docx-selector__page:hover .docx-selector__add-btn { display: flex; }
.docx-selector__add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}
@media (pointer: coarse) {
  .docx-selector__add-btn {
    display: flex;
    width: 30px;
    height: 30px;
    font-size: 18px;
  }
}
.docx-selector__page-thumb {
  width: 72px;
  height: 96px;
  object-fit: cover;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
}
.docx-selector__page-num {
  font-size: 10px;
  color: #64748b;
}
.docx-selector__empty {
  padding: 24px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.docx-selector__empty--loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #64748b;
}
.docx-selector__loading-icon {
  font-size: 15px;
  animation: docx-spin 1.2s linear infinite;
}
@keyframes docx-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
