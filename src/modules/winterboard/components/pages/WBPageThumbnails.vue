<!-- WB: Page thumbnails sidebar — mini canvas previews with drag-and-drop reorder
     Ref: TASK_BOARD_V5.md B7
     a11y: tablist/tab pattern, aria-selected, keyboard navigation
     Drag-and-drop: visual drop indicator (before/after)
     Thumbnail rendering: debounced 500ms, simplified 2D canvas -->
<template>
  <div
    class="wb-page-thumbnails"
    role="tablist"
    :aria-label="t('winterboard.pages.page_list')"
  >
    <div
      v-for="(page, index) in pages"
      :key="page.id"
      class="wb-thumbnail"
      :class="{
        'wb-thumbnail--active': index === currentIndex,
        'wb-thumbnail--drag-over': dragOverIndex === index,
      }"
      role="tab"
      :aria-selected="index === currentIndex"
      :aria-label="t('winterboard.pages.page_n', { n: index + 1 })"
      :tabindex="index === currentIndex ? 0 : -1"
      draggable="true"
      @click="emit('select', index)"
      @keydown.enter="emit('select', index)"
      @keydown.space.prevent="emit('select', index)"
      @dragstart="handleDragStart(index, $event)"
      @dragover.prevent="handleDragOver(index, $event)"
      @dragleave="handleDragLeave"
      @drop="handleDrop(index, $event)"
      @dragend="handleDragEnd"
    >
      <!-- Thumbnail canvas preview -->
      <canvas
        ref="thumbnailCanvases"
        class="wb-thumbnail__canvas"
        :width="THUMB_W"
        :height="THUMB_H"
      />

      <!-- Page number label -->
      <span class="wb-thumbnail__label">{{ index + 1 }}</span>

      <!-- Delete button (not for last page) -->
      <button
        v-if="pages.length > 1"
        type="button"
        class="wb-thumbnail__delete"
        :aria-label="t('winterboard.pages.delete_page', { n: index + 1 })"
        @click.stop="emit('delete', index)"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
          <line x1="2" y1="2" x2="10" y2="10" />
          <line x1="10" y1="2" x2="2" y2="10" />
        </svg>
      </button>

      <!-- Drag indicator -->
      <div
        v-if="dragOverIndex === index && dragFromIndex !== index"
        class="wb-thumbnail__drop-indicator"
        :class="dropPosition === 'before' ? 'wb-thumbnail__drop-indicator--before' : 'wb-thumbnail__drop-indicator--after'"
      />
    </div>

    <!-- Add page button -->
    <button
      type="button"
      class="wb-thumbnail wb-thumbnail--add"
      :aria-label="t('winterboard.pages.add')"
      @click="emit('add')"
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <line x1="10" y1="4" x2="10" y2="16" />
        <line x1="4" y1="10" x2="16" y2="10" />
      </svg>
      <span>{{ t('winterboard.pages.add') }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBPage } from '../../types/winterboard'

const { t } = useI18n()

// Thumbnail dimensions (16:9 ratio)
const THUMB_W = 120
const THUMB_H = 68

// ─── Props / Emits ──────────────────────────────────────────────────────────

interface Props {
  pages: WBPage[]
  currentIndex: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  select: [index: number]
  add: []
  delete: [index: number]
  reorder: [fromIndex: number, toIndex: number]
}>()

const thumbnailCanvases = ref<HTMLCanvasElement[]>([])

// ─── Drag and Drop ──────────────────────────────────────────────────────────

const dragFromIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const dropPosition = ref<'before' | 'after'>('after')

function handleDragStart(index: number, e: DragEvent): void {
  dragFromIndex.value = index
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(index))
  }
}

function handleDragOver(index: number, e: DragEvent): void {
  dragOverIndex.value = index
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  dropPosition.value = e.clientY < midY ? 'before' : 'after'
}

function handleDragLeave(): void {
  dragOverIndex.value = null
}

function handleDrop(index: number, e: DragEvent): void {
  e.preventDefault()
  const from = dragFromIndex.value
  if (from === null || from === index) {
    resetDrag()
    return
  }

  let toIndex = dropPosition.value === 'before' ? index : index
  if (from < index && dropPosition.value === 'before') {
    toIndex = index - 1
  } else if (from > index && dropPosition.value === 'after') {
    toIndex = index + 1
  } else {
    toIndex = index
  }

  toIndex = Math.max(0, Math.min(toIndex, props.pages.length - 1))

  if (from !== toIndex) {
    emit('reorder', from, toIndex)
  }
  resetDrag()
}

function handleDragEnd(): void {
  resetDrag()
}

function resetDrag(): void {
  dragFromIndex.value = null
  dragOverIndex.value = null
}

// ─── Thumbnail Rendering ────────────────────────────────────────────────────

/**
 * Render a mini preview of page content onto a small canvas.
 * Uses simple 2D canvas drawing (not Konva) for performance.
 */
function renderThumbnail(canvas: HTMLCanvasElement, page: WBPage): void {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.clearRect(0, 0, THUMB_W, THUMB_H)

  // Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, THUMB_W, THUMB_H)

  // Scale factor (assume canvas is ~1920x1080 → scale to 120x68)
  const scaleX = THUMB_W / 1920
  const scaleY = THUMB_H / 1080
  const scale = Math.min(scaleX, scaleY)

  // Draw strokes (simplified polylines)
  for (const stroke of (page.strokes || [])) {
    if (!stroke.points || stroke.points.length < 2) continue
    ctx.beginPath()
    ctx.strokeStyle = stroke.color || '#000000'
    ctx.lineWidth = Math.max(1, (stroke.size || 2) * scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const p0 = stroke.points[0]
    ctx.moveTo(p0.x * scale, p0.y * scale)
    for (let i = 1; i < stroke.points.length; i++) {
      const p = stroke.points[i]
      ctx.lineTo(p.x * scale, p.y * scale)
    }
    ctx.stroke()
  }

  // Draw assets (rectangles)
  for (const asset of (page.assets || [])) {
    const x = (asset.x || 0) * scale
    const y = (asset.y || 0) * scale
    const w = (asset.w || 50) * scale
    const h = (asset.h || 50) * scale

    // Future-proof: sticky notes will have type='sticky'
    const assetAny = asset as unknown as Record<string, unknown>
    if (assetAny.type === 'sticky') {
      ctx.fillStyle = (assetAny.bgColor as string) || '#fde047'
      ctx.fillRect(x, y, w, h)
      ctx.strokeStyle = '#00000020'
      ctx.lineWidth = 0.5
      ctx.strokeRect(x, y, w, h)
    } else {
      ctx.fillStyle = '#e2e8f080'
      ctx.fillRect(x, y, w, h)
    }
  }
}

let renderTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleRender(): void {
  if (renderTimeout) clearTimeout(renderTimeout)
  renderTimeout = setTimeout(() => {
    renderAllThumbnails()
  }, 500)
}

function renderAllThumbnails(): void {
  const canvases = thumbnailCanvases.value
  for (let i = 0; i < props.pages.length; i++) {
    if (canvases[i]) {
      renderThumbnail(canvases[i], props.pages[i])
    }
  }
}

// Watch for page content changes
watch(
  () => props.pages.map(p => ({
    strokeCount: p.strokes?.length || 0,
    assetCount: p.assets?.length || 0,
  })),
  () => scheduleRender(),
  { deep: true }
)

// Watch for page list changes (add/delete/reorder)
watch(
  () => props.pages.length,
  async () => {
    await nextTick()
    renderAllThumbnails()
  }
)

onMounted(() => {
  nextTick(() => renderAllThumbnails())
})

onUnmounted(() => {
  if (renderTimeout) clearTimeout(renderTimeout)
})
</script>

<style scoped>
.wb-page-thumbnails {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  overflow-y: auto;
  max-height: 100%;
  width: 140px;
  background: #f8fafc;
  border-right: 1px solid #e2e8f0;
}

.wb-thumbnail {
  position: relative;
  width: 120px;
  border-radius: 6px;
  border: 2px solid transparent;
  cursor: pointer;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
  background: #ffffff;
  overflow: hidden;
}

.wb-thumbnail:hover {
  border-color: #cbd5e1;
  transform: scale(1.03);
}

.wb-thumbnail:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.wb-thumbnail--active {
  border-color: #3b82f6;
  box-shadow: 0 0 0 1px #3b82f6;
}

.wb-thumbnail--drag-over {
  border-color: #60a5fa;
}

.wb-thumbnail__canvas {
  display: block;
  width: 120px;
  height: 68px;
  background: #ffffff;
}

.wb-thumbnail__label {
  position: absolute;
  bottom: 2px;
  left: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #94a3b8;
  pointer-events: none;
}

.wb-thumbnail__delete {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 50%;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s;
  color: #64748b;
}

.wb-thumbnail:hover .wb-thumbnail__delete {
  opacity: 1;
}

.wb-thumbnail__delete:hover {
  background: #fef2f2;
  color: #dc2626;
}

.wb-thumbnail--add {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 48px;
  border: 2px dashed #cbd5e1;
  color: #94a3b8;
  font-size: 11px;
  background: transparent;
}

.wb-thumbnail--add:hover {
  border-color: #3b82f6;
  color: #3b82f6;
  background: #eff6ff;
}

/* Drop indicator */
.wb-thumbnail__drop-indicator {
  position: absolute;
  left: 4px;
  right: 4px;
  height: 3px;
  background: #3b82f6;
  border-radius: 2px;
  pointer-events: none;
}

.wb-thumbnail__drop-indicator--before {
  top: -5px;
}

.wb-thumbnail__drop-indicator--after {
  bottom: -5px;
}

/* Reduced motion (LAW-22) */
@media (prefers-reduced-motion: reduce) {
  .wb-thumbnail {
    transition: none;
  }
  .wb-thumbnail__delete {
    transition: none;
  }
}
</style>
