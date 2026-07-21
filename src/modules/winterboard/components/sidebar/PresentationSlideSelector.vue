<template>
  <div class="slide-selector">
    <div class="slide-selector__header">
      <span class="slide-selector__title">{{ item.title }}</span>
      <span class="slide-selector__count">
        {{ t('winterboard.slideSelector.slideCount', { count: sortedSlides.length }) }}
      </span>
      <!-- Кнопка запуску плеєра -->
      <button
        v-if="sortedSlides.length > 0"
        class="slide-selector__play"
        type="button"
        :aria-label="t('winterboard.player.play')"
        :title="t('winterboard.player.play')"
        @click="playerOpen = true"
      >
        ▶
      </button>
      <button
        class="slide-selector__close"
        type="button"
        :aria-label="t('winterboard.slideSelector.close')"
        @click="$emit('close')"
      >
        &#x2715;
      </button>
    </div>

    <!-- PLAN_v4: Drag full presentation = document_viewer (NO extra → backend returns document_viewer) -->
    <div
      class="slide-selector__full"
      draggable="true"
      @dragstart="dragFullPresentation($event)"
      @dragend="onDragEnd"
    >
      <span class="slide-selector__full-icon">📊</span>
      <span>{{ t('winterboard.slideSelector.dragFull') }}</span>
    </div>

  <!-- Fullscreen player -->
  <PresentationPlayer
    v-if="playerOpen"
    :item="effectiveItem"
    :start-index="playerStartIndex"
    @close="playerOpen = false"
  />

    <!-- Slide thumbnail grid -->
    <div v-if="sortedSlides.length > 0" class="slide-selector__grid">
      <div
        v-for="slide in sortedSlides"
        :key="slide.index"
        class="slide-selector__slide"
        draggable="true"
        :title="t('winterboard.player.dblClickToPlay')"
        @dragstart="dragSlide($event, slide.index)"
        @dragend="onDragEnd"
        @dblclick.prevent="openPlayerAt(slide.index - 1)"
      >
        <img
          :src="slide.image_url"
          :alt="t('winterboard.slideSelector.slideAlt', { n: slide.index })"
          class="slide-selector__slide-thumb"
          loading="lazy"
          draggable="false"
        />
        <span class="slide-selector__slide-num">{{ slide.index }}</span>
        <!-- Touch/hover «+»: додати слайд у центр дошки (альтернатива drag). -->
        <button
          v-if="placeContent"
          type="button"
          class="slide-selector__add-btn"
          :title="t('winterboard.slideSelector.slideAlt', { n: slide.index })"
          @click.stop="addSlide(slide.index)"
        >+</button>
      </div>
    </div>

    <!-- Loading slides lazily -->
    <div v-else-if="isLoadingSlides" class="slide-selector__empty slide-selector__empty--loading">
      <span class="slide-selector__loading-icon">&#x23F3;</span>
      <span>{{ t('winterboard.pdfSelector.loadingPages') }}</span>
    </div>

    <!-- Empty state: processing / failed / ready but no slides -->
    <div v-else class="slide-selector__empty">
      <MediaStatusGuard :status="effectiveStatus" @retry="$emit('retry')">
        <span>{{ t('winterboard.slideSelector.noSlides') }}</span>
      </MediaStatusGuard>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { AllowedContentItem } from '../../types/sidebar'
import { SIDEBAR_DRAG_MIME } from '../../types/boardDrop'
import MediaStatusGuard from '../shared/MediaStatusGuard.vue'
import PresentationPlayer from './PresentationPlayer.vue'
import { learningContentApi } from '@/modules/learning-content/api/learningContentApi'
import { usePlaceSidebarContent } from '../../composables/usePlaceSidebarContent'

// Touch «+» → кладе слайд у центр видимої дошки (null у read-only контексті).
const placeContent = usePlaceSidebarContent()

const props = defineProps<{
  item: AllowedContentItem
}>()

defineEmits<{
  close: []
  retry: []
}>()

const { t } = useI18n()

// ── Плеєр ──
const playerOpen = ref(false)
const playerStartIndex = ref(0)

function openPlayerAt(i: number) {
  playerStartIndex.value = i
  playerOpen.value = true
}

// Lazily loaded slides — populated on mount if item.slides is missing
const lazySlides = ref<Record<string, { image_url: string }> | null>(null)
const isLoadingSlides = ref(false)

const sortedSlides = computed(() => {
  const slides = lazySlides.value ?? props.item.slides ?? {}
  return Object.entries(slides)
    .map(([idx, data]) => ({
      index: parseInt(idx, 10),
      image_url: data.image_url,
    }))
    .sort((a, b) => a.index - b.index)
})

// Merged item passed to PresentationPlayer so it has access to lazily loaded slides
const effectiveItem = computed(() => {
  if (!lazySlides.value) return props.item
  return { ...props.item, slides: lazySlides.value }
})

// Trust backend processing_status — slides load lazily via onMounted fetch or WS event.
// Don't override 'ready' to 'pending' based on missing slides — that causes permanent "Обробка...".
const effectiveStatus = computed(() => {
  const status = props.item.processing_status || 'pending'
  if (status === 'pending' || status === 'processing' || status === 'failed') return status
  return 'ready'
})

// Load slides on mount if not present in props
onMounted(async () => {
  const hasPropSlides = props.item.slides && Object.keys(props.item.slides).length > 0
  if (hasPropSlides) return
  if (!props.item.content_item_id) return
  if (props.item.processing_status === 'failed') return

  isLoadingSlides.value = true
  try {
    const detail = await learningContentApi.getItemDetail(props.item.content_item_id as number)
    const raw = (detail as unknown as Record<string, unknown>)
    const cj = (raw.data as Record<string, unknown>)?.content_json
      ?? (raw.content_json as Record<string, unknown>)
      ?? {}
    const slides = (cj as Record<string, unknown>).slides as Record<string, { image_url: string }> | undefined
    if (slides && Object.keys(slides).length > 0) {
      lazySlides.value = slides
    }
  } catch {
    // Non-critical — silently fall through to "no slides" state
  } finally {
    isLoadingSlides.value = false
  }
})

// WS listener: backend sends 'content.processing_complete' when Celery finishes
function onProcessingComplete(e: Event) {
  const detail = (e as CustomEvent).detail
  if (!detail || detail.content_item_id !== props.item.content_item_id) return
  const slides = detail.slides as Record<string, { image_url: string }> | undefined
  if (slides && Object.keys(slides).length > 0) {
    lazySlides.value = slides
  }
}

window.addEventListener('content:processing-complete', onProcessingComplete)
onUnmounted(() => {
  window.removeEventListener('content:processing-complete', onProcessingComplete)
})

function dragSlide(e: DragEvent, slideIndex: number) {
  const payload = {
    content_item_id: props.item.content_item_id,
    asset_category: 'presentation',
    content_type: 'presentation',
    extra: { slide_index: slideIndex },
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'

  // Ghost drag preview — find thumbnail of the dragged slide
  const slideThumb = slideIndex === 1 && sortedSlides.value.length > 0
    ? sortedSlides.value[0].image_url
    : (sortedSlides.value.find(s => s.index === slideIndex)?.image_url ?? null)

  window.dispatchEvent(new CustomEvent('wb-drag-preview', {
    detail: {
      asset_category: 'presentation',
      thumbnail_url: slideThumb ?? props.item.thumbnail_url ?? null,
      title: `${props.item.title} — слайд ${slideIndex}`,
    },
  }))

  // Hide browser native drag ghost
  const phantom = document.createElement('div')
  phantom.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0'
  document.body.appendChild(phantom)
  e.dataTransfer!.setDragImage(phantom, 0, 0)
  requestAnimationFrame(() => { if (phantom.parentNode) document.body.removeChild(phantom) })
}

// PLAN_v4: Drag full presentation — NO extra → backend returns type='document_viewer'
function dragFullPresentation(e: DragEvent) {
  const payload = {
    content_item_id: props.item.content_item_id,
    asset_category: 'presentation',
    content_type: 'presentation',
    // NO extra → backend detects whole-document drag
  }
  e.dataTransfer?.setData(SIDEBAR_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer!.effectAllowed = 'copy'

  window.dispatchEvent(new CustomEvent('wb-drag-preview', {
    detail: {
      asset_category: 'presentation',
      thumbnail_url: sortedSlides.value[0]?.image_url ?? props.item.thumbnail_url ?? null,
      title: props.item.title,
    },
  }))

  const phantom = document.createElement('div')
  phantom.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0'
  document.body.appendChild(phantom)
  e.dataTransfer!.setDragImage(phantom, 0, 0)
  requestAnimationFrame(() => { if (phantom.parentNode) document.body.removeChild(phantom) })
}

function addSlide(slideIndex: number) {
  placeContent?.({
    content_item_id: props.item.content_item_id,
    asset_category: 'presentation',
    content_type: 'presentation',
    extra: { slide_index: slideIndex },
  })
}

function onDragEnd() {
  window.dispatchEvent(new CustomEvent('wb-drag-stop'))
}
</script>

<style scoped>
.slide-selector {
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
  max-height: 420px;
  overflow-y: auto;
  width: 100%;
}
.slide-selector__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  position: sticky;
  top: 0;
  background: #f8fafc;
  z-index: 1;
}
.slide-selector__play {
  background: #3b82f6;
  border: none;
  color: #fff;
  font-size: 11px;
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
  flex-shrink: 0;
  line-height: 1.4;
  transition: background 0.1s;
}
.slide-selector__play:hover {
  background: #2563eb;
}
.slide-selector__title {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.slide-selector__count {
  font-size: 11px;
  color: #64748b;
  flex-shrink: 0;
}
.slide-selector__close {
  background: none;
  border: none;
  font-size: 14px;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  line-height: 1;
}
.slide-selector__close:hover {
  color: #475569;
}
.slide-selector__full {
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
.slide-selector__full:hover {
  background: #f0f9ff;
}
.slide-selector__full-icon {
  font-size: 16px;
}
.slide-selector__grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
  padding: 8px;
}
.slide-selector__slide {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  cursor: grab;
  border-radius: 4px;
  padding: 4px;
  transition: background 0.1s;
}
.slide-selector__slide:hover {
  background: #e0f2fe;
}

/* «+» додати слайд — hover-reveal на десктопі, постійно на тачі. */
.slide-selector__add-btn {
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
.slide-selector__slide:hover .slide-selector__add-btn { display: flex; }
.slide-selector__add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}
@media (any-pointer: coarse) {
  .slide-selector__add-btn {
    display: flex;
    width: 30px;
    height: 30px;
    font-size: 18px;
  }
}
.slide-selector__slide-thumb {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border: 1px solid #e2e8f0;
  border-radius: 3px;
}
.slide-selector__slide-num {
  font-size: 10px;
  color: #64748b;
}
.slide-selector__empty {
  padding: 24px 12px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.slide-selector__empty--loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #64748b;
}
.slide-selector__loading-icon {
  font-size: 15px;
  animation: slide-spin 1.2s linear infinite;
}
@keyframes slide-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
