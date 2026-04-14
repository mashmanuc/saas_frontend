<template>
  <v-group
    :config="groupConfig"
    @click="handleClick"
    @dblclick="handleDblClick"
    @dragend="handleDragEnd"
    @transformend="handleTransformEnd"
    @wheel="handleWheel"
  >
    <!-- Background frame -->
    <v-rect :config="frameConfig" />

    <!-- Current page image (ONLY 1 page rendered — P1 invariant) -->
    <v-image v-if="currentPageImage" :config="pageImageConfig" />

    <!-- Loading placeholder when image not ready -->
    <v-rect v-else :config="loadingPlaceholderConfig" />
    <v-text v-if="!currentPageImage" :config="loadingTextConfig" />

    <!-- Header bar with title -->
    <v-rect :config="headerConfig" />
    <v-text :config="headerTextConfig" />

    <!-- Footer bar with navigation -->
    <v-rect :config="footerConfig" />

    <!-- Prev button -->
    <v-rect :config="prevBtnConfig" />
    <v-text :config="prevBtnTextConfig" />

    <!-- Page counter -->
    <v-text :config="pageCounterConfig" />

    <!-- Next button -->
    <v-rect :config="nextBtnConfig" />
    <v-text :config="nextBtnTextConfig" />

    <!-- Expand button (presentations only) -->
    <v-rect v-if="isPresentation" :config="expandBtnConfig" />
    <v-text v-if="isPresentation" :config="expandBtnTextConfig" />

    <!-- Lock indicator -->
    <v-text v-if="asset.locked" :config="lockConfig" />
  </v-group>
</template>

<script setup lang="ts">
/**
 * PLAN_v4: DocumentViewerAsset — interactive document viewer as canvas asset.
 *
 * Performance invariants:
 *   P1: Renders ONLY 1 page (currentPage)
 *   P2: Preloads ONLY ±1 neighbor (browser cache, not rendered)
 *   P3: pages[] NOT sent via WS
 */
import { computed, ref, watch, onMounted } from 'vue'
import type { WBAsset } from '../../types/winterboard'
import { getDocumentPageUrl } from '../../composables/useDocumentPageCache'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  asset: WBAsset
  isSelected?: boolean
  scale?: number
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  scale: 1,
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [id: string]
  dragEnd: [id: string, x: number, y: number]
  transformEnd: [id: string, w: number, h: number]
  pageChange: [id: string, page: number]
  expand: [asset: WBAsset]
  pageJump: [id: string]
}>()

// ─── Constants ──────────────────────────────────────────────────────────────

const HEADER_H = 28
const FOOTER_H = 32
const BTN_W = 36
const BTN_H = 24
const CORNER_R = 4

// ─── Per-instance state (page URLs from global cache in useDocumentPageCache) ─

const currentPageImage = ref<HTMLImageElement | null>(null)
const isFetchingPage = ref(false)

watch(
  () => props.asset.currentPage,
  () => loadCurrentPage(),
  { immediate: true },
)

async function loadCurrentPage() {
  const contentId = props.asset.content_ref?.content_id
  const contentType = props.asset.content_ref?.content_type ?? 'pdf'
  if (!contentId) { currentPageImage.value = null; return }

  const pageIndex = props.asset.currentPage ?? 0
  isFetchingPage.value = true

  const url = await getDocumentPageUrl(contentId, contentType, pageIndex)
  isFetchingPage.value = false

  if (!url) {
    currentPageImage.value = null
    return
  }

  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    currentPageImage.value = img
    preloadNeighbors(pageIndex)
  }
  img.onerror = () => {
    const imgNoCors = new Image()
    imgNoCors.onload = () => { currentPageImage.value = imgNoCors }
    imgNoCors.onerror = () => { currentPageImage.value = null }
    imgNoCors.src = url
  }
  img.src = url
}

/** P2: Preload ±1 neighbor (browser image cache only, NOT rendered) */
async function preloadNeighbors(current: number) {
  const contentId = props.asset.content_ref?.content_id
  const contentType = props.asset.content_ref?.content_type ?? 'pdf'
  if (!contentId) return
  const total = props.asset.totalPages ?? 0
  for (const offset of [1, -1]) {
    const idx = current + offset
    if (idx >= 0 && idx < total) {
      const url = await getDocumentPageUrl(contentId, contentType, idx)
      if (url) {
        const img = new Image()
        img.src = url // browser caches it
      }
    }
  }
}

onMounted(() => loadCurrentPage())

// ─── Computed state ─────────────────────────────────────────────────────────

const isPresentation = computed(() =>
  props.asset.content_ref?.content_type === 'presentation'
)

const canGoPrev = computed(() => (props.asset.currentPage ?? 0) > 0)
const canGoNext = computed(() =>
  (props.asset.currentPage ?? 0) < (props.asset.totalPages ?? 1) - 1
)

const contentH = computed(() => props.asset.h - HEADER_H - FOOTER_H)

// ─── Konva configs ──────────────────────────────────────────────────────────

const groupConfig = computed(() => ({
  x: props.asset.x,
  y: props.asset.y,
  width: props.asset.w,
  height: props.asset.h,
  draggable: !props.asset.locked,
  id: props.asset.id,
  name: `asset-${props.asset.id}`,
  // Clip region gives Transformer explicit bounding box for resize
  clipFunc: (ctx: any) => {
    ctx.rect(0, 0, props.asset.w, props.asset.h)
  },
}))

const frameConfig = computed(() => ({
  x: 0,
  y: 0,
  width: props.asset.w,
  height: props.asset.h,
  fill: '#ffffff',
  cornerRadius: CORNER_R,
  stroke: props.isSelected ? '#3b82f6' : '#cbd5e1',
  strokeWidth: props.isSelected ? 2 : 1,
  shadowColor: '#000',
  shadowBlur: 6,
  shadowOffset: { x: 1, y: 2 },
  shadowOpacity: 0.1,
}))

// Header
const headerConfig = computed(() => ({
  x: 0,
  y: 0,
  width: props.asset.w,
  height: HEADER_H,
  fill: '#f1f5f9',
  cornerRadius: [CORNER_R, CORNER_R, 0, 0],
}))

const headerTextConfig = computed(() => {
  const ct = props.asset.content_ref?.content_type ?? 'pdf'
  const label = ct === 'presentation' ? 'Presentation'
    : ct === 'document' ? 'Document'
    : 'PDF'
  return {
    x: 8,
    y: 6,
    width: props.asset.w - 16,
    text: label,
    fontSize: 12,
    fontFamily: 'Inter, sans-serif',
    fontStyle: 'bold',
    fill: '#475569',
    ellipsis: true,
    listening: false,
  }
})

// Page image area
const pageImageConfig = computed(() => ({
  x: 1,
  y: HEADER_H,
  width: props.asset.w - 2,
  height: contentH.value,
  image: currentPageImage.value,
  listening: false,
}))

const loadingPlaceholderConfig = computed(() => ({
  x: 1,
  y: HEADER_H,
  width: props.asset.w - 2,
  height: contentH.value,
  fill: '#f8fafc',
  listening: false,
}))

const loadingTextConfig = computed(() => ({
  x: 0,
  y: HEADER_H + contentH.value / 2 - 8,
  width: props.asset.w,
  text: '...',
  fontSize: 16,
  fontFamily: 'Inter, sans-serif',
  fill: '#94a3b8',
  align: 'center',
  listening: false,
}))

// Footer
const footerConfig = computed(() => ({
  x: 0,
  y: props.asset.h - FOOTER_H,
  width: props.asset.w,
  height: FOOTER_H,
  fill: '#f8fafc',
  cornerRadius: [0, 0, CORNER_R, CORNER_R],
}))

// Prev button
const prevBtnConfig = computed(() => ({
  x: 8,
  y: props.asset.h - FOOTER_H + 4,
  width: BTN_W,
  height: BTN_H,
  fill: canGoPrev.value ? '#e2e8f0' : '#f1f5f9',
  cornerRadius: 3,
  listening: true,
}))

const prevBtnTextConfig = computed(() => ({
  x: 8,
  y: props.asset.h - FOOTER_H + 4,
  width: BTN_W,
  height: BTN_H,
  text: '\u25C0',
  fontSize: 12,
  fill: canGoPrev.value ? '#334155' : '#cbd5e1',
  align: 'center',
  verticalAlign: 'middle',
  listening: false,
}))

// Page counter
const pageCounterConfig = computed(() => ({
  x: BTN_W + 16,
  y: props.asset.h - FOOTER_H + 4,
  width: props.asset.w - BTN_W * 2 - 40 - (isPresentation.value ? BTN_W + 8 : 0),
  height: BTN_H,
  text: `${(props.asset.currentPage ?? 0) + 1} / ${props.asset.totalPages ?? 0}`,
  fontSize: 12,
  fontFamily: 'Inter, sans-serif',
  fill: '#64748b',
  align: 'center',
  verticalAlign: 'middle',
  listening: false,
}))

// Next button
const nextBtnConfig = computed(() => {
  const rightOffset = isPresentation.value ? BTN_W + 16 : 8
  return {
    x: props.asset.w - BTN_W - rightOffset,
    y: props.asset.h - FOOTER_H + 4,
    width: BTN_W,
    height: BTN_H,
    fill: canGoNext.value ? '#e2e8f0' : '#f1f5f9',
    cornerRadius: 3,
    listening: true,
  }
})

const nextBtnTextConfig = computed(() => {
  const rightOffset = isPresentation.value ? BTN_W + 16 : 8
  return {
    x: props.asset.w - BTN_W - rightOffset,
    y: props.asset.h - FOOTER_H + 4,
    width: BTN_W,
    height: BTN_H,
    text: '\u25B6',
    fontSize: 12,
    fill: canGoNext.value ? '#334155' : '#cbd5e1',
    align: 'center',
    verticalAlign: 'middle',
    listening: false,
  }
})

// Expand button (presentations only)
const expandBtnConfig = computed(() => ({
  x: props.asset.w - BTN_W - 8,
  y: props.asset.h - FOOTER_H + 4,
  width: BTN_W,
  height: BTN_H,
  fill: '#3b82f6',
  cornerRadius: 3,
  listening: true,
}))

const expandBtnTextConfig = computed(() => ({
  x: props.asset.w - BTN_W - 8,
  y: props.asset.h - FOOTER_H + 4,
  width: BTN_W,
  height: BTN_H,
  text: '\u26F6',
  fontSize: 14,
  fill: '#ffffff',
  align: 'center',
  verticalAlign: 'middle',
  listening: false,
}))

const lockConfig = computed(() => ({
  x: props.asset.w - 22,
  y: 6,
  text: '\uD83D\uDD12',
  fontSize: 14,
  listening: false,
}))

// ─── Event handlers ─────────────────────────────────────────────────────────

function handleClick(e: any): void {
  const node = e.target
  const stage = node.getStage()
  if (!stage) { emit('select', props.asset.id); return }

  const pointer = stage.getPointerPosition()
  if (!pointer) { emit('select', props.asset.id); return }

  // Convert stage pointer to group-local coordinates
  const groupNode = node.findAncestor('Group') || node
  const localPos = groupNode.getAbsoluteTransform().copy().invert().point(pointer)

  const footerY = props.asset.h - FOOTER_H

  // Check if click is in footer area
  if (localPos.y >= footerY) {
    // Prev button
    if (localPos.x >= 8 && localPos.x <= 8 + BTN_W && canGoPrev.value) {
      e.cancelBubble = true
      emit('pageChange', props.asset.id, (props.asset.currentPage ?? 0) - 1)
      return
    }

    // Next button
    const nextRightOffset = isPresentation.value ? BTN_W + 16 : 8
    const nextX = props.asset.w - BTN_W - nextRightOffset
    if (localPos.x >= nextX && localPos.x <= nextX + BTN_W && canGoNext.value) {
      e.cancelBubble = true
      emit('pageChange', props.asset.id, (props.asset.currentPage ?? 0) + 1)
      return
    }

    // Expand button (presentations)
    if (isPresentation.value) {
      const expandX = props.asset.w - BTN_W - 8
      if (localPos.x >= expandX && localPos.x <= expandX + BTN_W) {
        e.cancelBubble = true
        emit('expand', props.asset)
        return
      }
    }
  }

  // Default: select
  emit('select', props.asset.id)
}

function handleDragEnd(e: { target: { x: () => number; y: () => number } }): void {
  emit('dragEnd', props.asset.id, e.target.x(), e.target.y())
}

function handleTransformEnd(e: { target: { width: () => number; height: () => number; scaleX: () => number; scaleY: () => number } }): void {
  const node = e.target
  const w = Math.max(200, node.width() * node.scaleX())
  const h = Math.max(200, node.height() * node.scaleY())
  emit('transformEnd', props.asset.id, Math.round(w), Math.round(h))
}

// ─── Scroll navigation (wheel = page turn) ────────────────────────────────

let _wheelThrottled = false

function handleWheel(e: any): void {
  const evt = e.evt as WheelEvent
  if (!evt) return
  // Ctrl+wheel = canvas zoom — don't intercept
  if (evt.ctrlKey || evt.metaKey) return

  evt.preventDefault()
  e.cancelBubble = true

  if (_wheelThrottled) return
  _wheelThrottled = true
  setTimeout(() => { _wheelThrottled = false }, 120)

  const cur = props.asset.currentPage ?? 0
  const total = props.asset.totalPages ?? 0
  const next = evt.deltaY > 0
    ? Math.min(total - 1, cur + 1)
    : Math.max(0, cur - 1)

  if (next !== cur) {
    emit('pageChange', props.asset.id, next)
  }
}

// ─── Double-click on footer page counter → page jump input ────────────────

function handleDblClick(e: any): void {
  const node = e.target
  const stage = node?.getStage?.()
  if (!stage) return

  const pointer = stage.getPointerPosition()
  if (!pointer) return

  const groupNode = node.findAncestor?.('Group') || node
  const localPos = groupNode.getAbsoluteTransform().copy().invert().point(pointer)

  const footerY = props.asset.h - FOOTER_H
  // Click must be in footer area, near center (page counter)
  if (localPos.y >= footerY) {
    const centerX = props.asset.w / 2
    if (Math.abs(localPos.x - centerX) < 50) {
      e.cancelBubble = true
      emit('pageJump', props.asset.id)
    }
  }
}
</script>
