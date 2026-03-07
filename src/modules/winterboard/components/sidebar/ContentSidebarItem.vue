<template>
  <div
    class="sidebar-item"
    :class="{
      'sidebar-item--processing': !isReady,
      'sidebar-item--failed': item.processing_status === 'failed',
      'sidebar-item--pdf': isPdf || isPresentation,
    }"
    :draggable="isTutor && isReady && !isPresentation"
    @dragstart="onDragStart"
    @dragend="onDragEnd"
    @click="handleClick"
    @dblclick.prevent="handleDblClick"
  >
    <img
      v-if="item.thumbnail_url"
      :src="item.thumbnail_url"
      class="sidebar-item__thumb"
      :alt="item.title"
      loading="lazy"
      draggable="false"
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
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AllowedContentItem } from '../../types/sidebar'
import { SIDEBAR_DRAG_MIME, type SidebarDragPayload } from '../../types/boardDrop'
import PdfPageSelector from './PdfPageSelector.vue'
import PresentationSlideSelector from './PresentationSlideSelector.vue'

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

const isPdf = computed(() => props.item.asset_category === 'pdf')
const isPresentation = computed(() => props.item.asset_category === 'presentation')
const showPdfSelector = ref(false)
const showSlideSelector = ref(false)

function handleClick() {
  if (!isReady.value) return
  if (isPdf.value) {
    showPdfSelector.value = !showPdfSelector.value
    showSlideSelector.value = false
  } else if (isPresentation.value) {
    showSlideSelector.value = !showSlideSelector.value
    showPdfSelector.value = false
  }
}

function handleDblClick() {
  if (!isReady.value || !props.isTutor) return
  if (isPdf.value || isPresentation.value) return // uses click → selector
  emit('place', props.item)
}

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
  // Presentations and PDFs are dragged via child selectors (PresentationSlideSelector / PdfPageSelector).
  // Don't call e.preventDefault() here — that would cancel the child's drag operation.
  // Just bail out without setting SIDEBAR_DRAG_MIME (child already set it).
  if (isPresentation.value || isPdf.value) return
  const payload: SidebarDragPayload = {
    content_item_id: props.item.content_item_id as number,
    asset_category: props.item.asset_category,
    content_type: props.item.content_type,
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
.sidebar-item__pdf-inline {
  display: block;
}
</style>
