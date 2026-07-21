<template>
  <div
    class="sidebar-item"
    :class="{
      'sidebar-item--processing': !isReady && !isPlayableMedia,
      'sidebar-item--failed': item.processing_status === 'failed',
      'sidebar-item--pdf': isPdf || isPresentation || isDocx,
    }"
    :draggable="isTutor && isInteractable && !isPresentation && !isDocx"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="handleClick"
    @dblclick.prevent="handleDblClick"
  >
    <img
      v-if="thumbSrc"
      :src="thumbSrc"
      class="sidebar-item__thumb"
      :alt="item.title"
      loading="lazy"
      draggable="false"
    />
    <div v-else class="sidebar-item__icon" :aria-hidden="true">
      <svg v-if="item.asset_category === 'audio'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M10 3v10.5a3 3 0 1 1-2-2.83V5l6-1.5v8a3 3 0 1 1-2-2.83V3h-2z" fill="#8b5cf6"/>
      </svg>
      <svg v-else-if="item.asset_category === 'video'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="11" height="12" rx="2" fill="#3b82f6"/>
        <path d="M13 8l5-2.5v9L13 12V8z" fill="#3b82f6"/>
      </svg>
      <svg v-else-if="item.asset_category === 'pdf'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="1" width="14" height="18" rx="2" fill="#ef4444"/>
        <path d="M6 10h8M6 13h5" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M10 1v4h4" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else-if="item.asset_category === 'youtube_link' || item.asset_category === 'youtube'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="4" width="16" height="12" rx="3" fill="#FF0000"/>
        <path d="M8.5 7.5l5 2.5-5 2.5V7.5z" fill="#fff"/>
      </svg>
      <svg v-else-if="item.asset_category === 'presentation'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="3" width="16" height="12" rx="2" fill="#f59e0b"/>
        <path d="M6 9h8M6 12h5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
      <svg v-else-if="item.asset_category === 'document'" width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="1" width="14" height="18" rx="2" fill="#2563eb"/>
        <path d="M6 7h8M6 10h8M6 13h5" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>
        <path d="M10 1v4h4" stroke="#fff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="#94a3b8" stroke-width="1.5"/>
        <path d="M7 7h6M7 10h4" stroke="#94a3b8" stroke-width="1.2" stroke-linecap="round"/>
      </svg>
    </div>

    <span class="sidebar-item__title" :title="item.title">
      {{ item.title }}
    </span>

    <!-- Place on board button (shown on hover) -->
    <button
      v-if="isTutor && isInteractable"
      type="button"
      class="sidebar-item__add-btn"
      :title="t('winterboard.contentSidebar.addToBoard')"
      @click.stop="handleAddBtn"
      @mousedown.stop
    >+</button>

    <!-- Phase 11 B7: Drag hint overlay -->
    <span v-if="isTutor && isInteractable && !isPresentation && !isPdf && !isDocx" class="sidebar-item__drag-hint">
      ↗
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

  <!-- Phase 3B: PDF page selector — inline in sidebar -->
  <PdfPageSelector
    v-if="showPdfSelector && isPdf"
    class="sidebar-item__pdf-inline"
    :item="item"
    @close="showPdfSelector = false"
    @retry="$emit('retry', item)"
  />

  <!-- Phase 3B: Presentation slide selector — inline in sidebar -->
  <PresentationSlideSelector
    v-if="showSlideSelector && isPresentation"
    class="sidebar-item__pdf-inline"
    :item="item"
    @close="showSlideSelector = false"
    @retry="$emit('retry', item)"
  />

  <!-- Phase 35.5: DOCX page selector — inline in sidebar -->
  <DocxPageSelector
    v-if="showDocxSelector && isDocx"
    class="sidebar-item__pdf-inline"
    :item="item"
    @close="showDocxSelector = false"
    @retry="$emit('retry', item)"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AllowedContentItem } from '../../types/sidebar'
import { SIDEBAR_DRAG_MIME, type SidebarDragPayload } from '../../types/boardDrop'
import PdfPageSelector from './PdfPageSelector.vue'
import PresentationSlideSelector from './PresentationSlideSelector.vue'
import DocxPageSelector from './DocxPageSelector.vue'

const props = defineProps<{
  item: AllowedContentItem
  isTutor: boolean
}>()

const emit = defineEmits<{
  retry: [item: AllowedContentItem]
  place: [item: AllowedContentItem]
}>()

const { t } = useI18n()

const isReady = computed(() =>
  !props.item.processing_status || props.item.processing_status === 'ready',
)

// Audio/video можна відтворювати та перетягувати навіть без завершення processing
// (processing лише витягує thumbnail, файл вже playable одразу після upload)
const isPlayableMedia = computed(() =>
  props.item.asset_category === 'audio' || props.item.asset_category === 'video',
)

// Доступний для drag/dblclick: або повністю ready, або playable media (pending допустимий)
const isInteractable = computed(() => isReady.value || isPlayableMedia.value)

const isPdf = computed(() => props.item.asset_category === 'pdf')
const isPresentation = computed(() => props.item.asset_category === 'presentation')
const isDocx = computed(() => props.item.asset_category === 'document')

const thumbSrc = computed<string | null>(() => {
  // BUG-2 FIX: Skip thumbnail_url for categories that don't have real thumbnails
  // Backend returns cdn_url as thumbnail_url for audio/video/pdf, causing <img> to load .mp3/.mp4/.pdf
  const NO_THUMB_CATEGORIES = ['audio', 'video', 'pdf', 'presentation', 'document']
  if (props.item.thumbnail_url && !NO_THUMB_CATEGORIES.includes(props.item.asset_category)) {
    return props.item.thumbnail_url
  }
  if (props.item.asset_category === 'image' && props.item.cdn_url) return props.item.cdn_url
  return null
})
const showPdfSelector = ref(false)
const showSlideSelector = ref(false)
const showDocxSelector = ref(false)

function handleClick() {
  if (!isReady.value) return
  if (isPdf.value) {
    showPdfSelector.value = !showPdfSelector.value
    showSlideSelector.value = false
    showDocxSelector.value = false
  } else if (isPresentation.value) {
    showSlideSelector.value = !showSlideSelector.value
    showPdfSelector.value = false
    showDocxSelector.value = false
  } else if (isDocx.value) {
    showDocxSelector.value = !showDocxSelector.value
    showPdfSelector.value = false
    showSlideSelector.value = false
  }
}

function handleDblClick() {
  if (!isInteractable.value || !props.isTutor) return
  if (isPdf.value || isPresentation.value || isDocx.value) return // uses click → selector
  emit('place', props.item)
}

function handleAddBtn() {
  if (!isInteractable.value) return
  // PDF / presentation / docx → open inline selector (same as single click)
  if (isPdf.value || isPresentation.value || isDocx.value) {
    handleClick()
    return
  }
  emit('place', props.item)
}


function onDragStart(e: DragEvent) {
  if (!props.isTutor || !isInteractable.value) {
    e.preventDefault()
    return
  }
  // Presentations and PDFs are dragged via child selectors (PresentationSlideSelector / PdfPageSelector).
  // Don't call e.preventDefault() here — that would cancel the child's drag operation.
  // Just bail out without setting SIDEBAR_DRAG_MIME (child already set it).
  if (isPresentation.value || isPdf.value || isDocx.value) return
  const payload: SidebarDragPayload = {
    content_item_id: props.item.content_item_id,
    asset_category: props.item.asset_category,
    content_type: props.item.content_type,
    // Phase 9 fallback: для старих LibraryAsset без ContentItem FK (content_item_id=null)
    // передаємо cdn_url щоб handleSidebarDrop міг рендерити файл напряму
    cdn_url: props.item.cdn_url ?? null,
    title: props.item.title,
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'

  // Ghost drag preview — dispatch custom event for WBDragGhost overlay
  window.dispatchEvent(new CustomEvent('wb-drag-preview', {
    detail: {
      asset_category: props.item.asset_category,
      thumbnail_url: props.item.thumbnail_url ?? null,
      title: props.item.title,
    },
  }))

  // Hide browser native drag ghost — show our custom ghost instead
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
.sidebar-item--pdf {
  cursor: pointer;
}
.sidebar-item__drag-hint {
  display: none;
  font-size: 11px;
  color: #6366f1;
  font-weight: 700;
  flex-shrink: 0;
}
.sidebar-item:hover .sidebar-item__drag-hint {
  display: inline;
}

/* ── Add-to-board button ── */
.sidebar-item__add-btn {
  display: none;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  padding: 0;
  border-radius: 5px;
  border: 1px solid #c7d2fe;
  background: #f5f3ff;
  color: #6366f1;
  font-size: 15px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  transition: background 0.12s, border-color 0.12s, color 0.12s;
}
.sidebar-item:hover .sidebar-item__add-btn {
  display: flex;
}
.sidebar-item__add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}

/* Touch (2026-07-19): на тачі немає hover → «+» був невидимий на матеріалах.
   Показуємо постійно + більший тап-таргет (як у матем-треях і WBAssetItem). */
@media (any-pointer: coarse) {
  .sidebar-item__add-btn {
    display: flex;
    width: 32px;
    height: 32px;
    font-size: 18px;
  }
  /* drag-hint ↗ на тачі зайвий (drag капризний) — «+» тепер основний шлях */
  .sidebar-item__drag-hint { display: none !important; }
}
.sidebar-item__pdf-inline {
  display: block;
}
</style>
