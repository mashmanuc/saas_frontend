<template>
  <v-group
    :config="groupConfig"
    @click="handleClick"
    @dblclick="handleDblClick"
    @dragend="handleDragEnd"
    @transformend="handleTransformEnd"
    @wheel="handleWheel"
    @pointerdown="onQuickDown"
    @mousedown="onQuickGuard"
    @touchstart="onQuickGuard"
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

    <!-- «✂️ Вирізка фрагмента» (TZ_PDF_FRAGMENT_2026-10-13): документ із хмари, лише той, хто редагує -->
    <template v-if="showCut">
      <v-rect :config="cutBtnConfig" @mouseenter="hoverHint = 'cut'" @mouseleave="hoverHint = null" />
      <v-text :config="cutBtnTextConfig" />
    </template>
    <!-- «⚡ Швидка вирізка фрагмента»: обвели на сторінці — одразу на дошці, без вікна й підтверджень -->
    <template v-if="showQuick">
      <v-rect :config="quickBtnConfig" @mouseenter="hoverHint = 'quick'" @mouseleave="hoverHint = null" />
      <v-text :config="quickBtnTextConfig" />
    </template>
    <v-rect v-if="quickSel" :config="quickSelConfig" />

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
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useI18n } from 'vue-i18n'
import type { WBAsset } from '../../types/winterboard'
import { documentHeaderText } from '../../board/documentTitle'
import { keepInsideTopLeft } from '../../board/konvaDragBounds'
import { getDocumentPageUrl } from '../../composables/useDocumentPageCache'
import {
  CUT_CONTENT_TYPES, QUICK_MIN_VIEWER_W, quickRelease, viewerPointToPage, type FragRect,
} from '../library/pdfFragmentRect'
import type { PdfFragmentSnap } from '../../api/library'

// ─── Props ──────────────────────────────────────────────────────────────────

interface Props {
  asset: WBAsset
  isSelected?: boolean
  scale?: number
  /** false коли активний НЕ select-інструмент (олівець/маркер/…) → нода не ловить
   *  pointer, щоб штрих малювався ПОВЕРХ документа, а не тягнув його (дзеркало
   *  KONVA_PROXY_TYPES: draggable/listening лише в select-режимі). */
  interactive?: boolean
  /** Показати «✂️ Вирізка фрагмента» і «⚡ Швидка вирізка» (вчитель, режим редагування) */
  canCut?: boolean
  /** Сервер саме вирізає швидкий фрагмент з цього вікна — у шапці «Вирізаю…» */
  cutting?: boolean
  /** «Клік по задачі»: що під кліком на сторінці (сервер, текстовий шар документа) */
  snapFn?: (pageIndex: number, point: { x: number; y: number }) => Promise<PdfFragmentSnap>
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  scale: 1,
  interactive: true,
  canCut: false,
  cutting: false,
})

// ─── Emits ──────────────────────────────────────────────────────────────────

const emit = defineEmits<{
  select: [id: string]
  dragEnd: [id: string, x: number, y: number]
  transformEnd: [id: string, w: number, h: number]
  pageChange: [id: string, page: number]
  expand: [asset: WBAsset]
  pageJump: [id: string]
  cut: [asset: WBAsset]
  /** Швидка вирізка: сторінка (з 0) і рамка в частках сторінки */
  quickCut: [asset: WBAsset, pageIndex: number, rect: FragRect]
}>()

// ─── Constants ──────────────────────────────────────────────────────────────

const HEADER_H = 28
/** Праворуч у шапці — віконні кнопки «— ×» виділеної картки й замок: назва під них не заходить. */
const HEADER_RIGHT_RESERVE = 56
const FOOTER_H = 32
const BTN_W = 36
const BTN_H = 24
const CORNER_R = 4
const CUT_W = 32
const CUT_GAP = 6

// ─── Per-instance state (page URLs from global cache in useDocumentPageCache) ─

const currentPageImage = ref<HTMLImageElement | null>(null)
const isFetchingPage = ref(false)

// Reactive trigger ТІЛЬКИ на user-driven page change.
// `immediate: true` видалено — initial load робить onMounted нижче.
// Це уникає duplicate fire при mount → 1 HTTP call замість 2.
watch(
  () => props.asset.currentPage,
  () => loadCurrentPage(),
)

/**
 * Адреса сторінки: або з бекенду (хмарний документ), або з самого об'єкта.
 *
 * Статичний режим (`pages[]` без `content_ref`) потрібен там, де API нема
 * взагалі — демо-дошка `/workspace` живе повністю в браузері. Хмарні
 * переглядачі завжди мають `content_ref` (див. useContentDrop), тож для них
 * гілка нижче не спрацьовує і поведінка не змінюється.
 */
async function resolvePageUrl(pageIndex: number): Promise<string | null> {
  const contentId = props.asset.content_ref?.content_id
  if (!contentId) return props.asset.pages?.[pageIndex]?.url ?? null
  const contentType = props.asset.content_ref?.content_type ?? 'pdf'
  return await getDocumentPageUrl(contentId, contentType, pageIndex)
}

/** Чи має об'єкт хоч якесь джерело сторінок (інакше малювати нічого). */
const hasPageSource = computed(() =>
  Boolean(props.asset.content_ref?.content_id) || Boolean(props.asset.pages?.length),
)

async function loadCurrentPage() {
  if (!hasPageSource.value) { currentPageImage.value = null; return }

  const pageIndex = props.asset.currentPage ?? 0
  isFetchingPage.value = true

  const url = await resolvePageUrl(pageIndex)
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
  if (!hasPageSource.value) return
  const total = props.asset.totalPages ?? 0
  for (const offset of [1, -1]) {
    const idx = current + offset
    if (idx >= 0 && idx < total) {
      const url = await resolvePageUrl(idx)
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
  // «⚡ Швидка вирізка»: поки обводять рамку, вікно не тягнеться
  draggable: props.interactive && !props.asset.locked && !quickMode.value,
  // Лівий/верхній край аркуша — межа й під час руху (власник 2026-09-24).
  dragBoundFunc: keepInsideTopLeft,
  // не select-інструмент → listening:false: pointerdown падає на stage-handler
  // малювання (штрих поверх PDF), а не на цю ноду (drag документа)
  listening: props.interactive,
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

const { t } = useI18n()

// Власник 2026-09-28 («так»): у шапці — назва файлу, як у «Сценарії» на пульті; без назви —
// вид документа мовою інтерфейсу, а не англійське «Presentation» (board/documentTitle.ts).
const headerTextConfig = computed(() => {
  return {
    x: 8,
    y: 6,
    width: Math.max(0, props.asset.w - 16 - HEADER_RIGHT_RESERVE),
    text: headerText.value,
    fontSize: 12,
    fontFamily: 'Inter, sans-serif',
    fontStyle: 'bold',
    fill: '#475569',
    // один рядок: довга назва обрізається «…», а не лізе на сторінку документа
    wrap: 'none',
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
/** Кнопка «✂️» — ліворуч від «▶»; документ із хмари (PDF, Word, PowerPoint), вікно достатньо широке */
const showCut = computed(() =>
  props.canCut && props.interactive && CUT_CONTENT_TYPES.includes(props.asset.content_ref?.content_type ?? '')
  && Boolean(props.asset.content_ref?.content_id) && props.asset.w >= 200,
)
const cutX = computed(() => props.asset.w - 8 - BTN_W - CUT_GAP - CUT_W)

// ─── «⚡ Швидка вирізка фрагмента» ────────────────────────────────────────────
// Натиснули ⚡ → режим рамки (хрестик, вікно не тягнеться) → обвели на сторінці → відпустили → `quickCut`.
// Замалий клік нічого не вирізає й режим не знімає; Esc чи ще раз ⚡ — вихід.

const showQuick = computed(() => showCut.value && props.asset.w >= QUICK_MIN_VIEWER_W)
const quickX = computed(() => cutX.value - CUT_GAP - CUT_W)
const quickMode = ref(false)
/** Рамка, що її зараз тягнуть, — у частках сторінки */
const quickSel = ref<FragRect | null>(null)
const hoverHint = ref<'cut' | 'quick' | null>(null)
let quickStart: { x: number; y: number } | null = null
let quickStage: any = null
let quickGroup: any = null
/** Запропонована «кліком по задачі» рамка — клік усередині неї вирізає */
const quickPending = ref<FragRect | null>(null)
const quickSnapping = ref(false)
/** Після кліку: нічого не знайшлося / сервер не відповів — у шапці підказка обвести рамкою */
const quickNote = ref<'nothing' | 'failed' | null>(null)
/** Номер останнього пошуку: вийшли з «⚡» чи клацнули знову — стара відповідь рамки не ставить */
let snapSeq = 0
/** Клік, що завершує рамку (Konva шле його після pointerup), — не виділяє вікно й не відкриває його сторінки */
let swallowClick = false

const headerText = computed(() => {
  if (props.cutting) return t('winterboard.pdfFragment.quickCutting')
  if (quickMode.value) {
    if (quickSnapping.value) return t('winterboard.pdfFragment.snapping')
    if (quickPending.value) return t('winterboard.pdfFragment.quickPending')
    if (quickNote.value === 'nothing') return t('winterboard.pdfFragment.quickNothing')
    if (quickNote.value === 'failed') return t('winterboard.pdfFragment.quickSnapFailed')
    return t('winterboard.pdfFragment.quickHint')
  }
  if (hoverHint.value === 'cut') return t('winterboard.pdfFragment.title')
  if (hoverHint.value === 'quick') return t('winterboard.pdfFragment.quick')
  return documentHeaderText(props.asset, t)
})

const quickBtnConfig = computed(() => ({
  x: quickX.value,
  y: props.asset.h - FOOTER_H + 4,
  width: CUT_W,
  height: BTN_H,
  fill: quickMode.value ? '#047857' : '#fef3c7',
  stroke: quickMode.value ? '#047857' : '#b45309',
  strokeWidth: 1,
  cornerRadius: 3,
  listening: true,
  name: 'doc-viewer-quick-cut',
}))

const quickBtnTextConfig = computed(() => ({
  x: quickX.value,
  y: props.asset.h - FOOTER_H + 4,
  width: CUT_W,
  height: BTN_H,
  text: '⚡',
  fontSize: 13,
  align: 'center',
  verticalAlign: 'middle',
  listening: false,
}))

const quickSelConfig = computed(() => {
  const r = quickSel.value ?? { x: 0, y: 0, w: 0, h: 0 }
  const pw = props.asset.w - 2
  return {
    x: 1 + r.x * pw,
    y: HEADER_H + r.y * contentH.value,
    width: r.w * pw,
    height: r.h * contentH.value,
    stroke: '#047857',
    strokeWidth: 2,
    dash: [6, 4],
    fill: 'rgba(4, 120, 87, 0.08)',
    listening: false,
  }
})

/** Вказівник у координатах групи вікна (група — з події натискання, не пошук за id) */
function localPoint(stage: any, group: any): { x: number; y: number } | null {
  const pointer = stage?.getPointerPosition?.()
  if (!pointer || !group) return null
  return group.getAbsoluteTransform().copy().invert().point(pointer)
}

function inPageArea(p: { x: number; y: number }): boolean {
  return p.y >= HEADER_H && p.y <= props.asset.h - FOOTER_H
}

/** Поки обводять рамку, звичні mousedown/touchstart дошки (виділення, рамка вибору) сюди не доходять */
function onQuickGuard(e: any): void {
  if (!quickMode.value) return
  const p = localPoint(e.target?.getStage?.(), e.currentTarget)
  if (p && inPageArea(p)) e.cancelBubble = true
}

function onKeyQuick(e: KeyboardEvent): void {
  if (e.key === 'Escape') exitQuick()
}

function enterQuick(stage: any): void {
  quickMode.value = true
  quickSel.value = null
  quickPending.value = null
  quickNote.value = null
  quickStage = stage
  const container = stage?.container?.()
  if (container) container.style.cursor = 'crosshair'
  window.addEventListener('keydown', onKeyQuick)
}

function stopQuickDrag(): void {
  quickStage?.off?.('pointermove.wbquick pointerup.wbquick')
  quickStart = null
  quickGroup = null
}

function exitQuick(): void {
  stopQuickDrag()
  quickMode.value = false
  quickSel.value = null
  quickPending.value = null
  quickSnapping.value = false
  quickNote.value = null
  snapSeq++
  const container = quickStage?.container?.()
  if (container) container.style.cursor = ''
  quickStage = null
  window.removeEventListener('keydown', onKeyQuick)
}

function onQuickDown(e: any): void {
  swallowClick = false
  if (!quickMode.value || quickSnapping.value) return
  const stage = e.target?.getStage?.()
  const group = e.currentTarget
  const p = localPoint(stage, group)
  if (!p) return
  // Лише по сторінці: шапка й футер (там ⚡, ◀ ▶) працюють як завжди
  if (!inPageArea(p)) return
  e.cancelBubble = true
  quickNote.value = null
  quickGroup = group
  quickStart = viewerPointToPage(p.x, p.y, props.asset.w, props.asset.h, HEADER_H, FOOTER_H)
  quickSel.value = { x: quickStart.x, y: quickStart.y, w: 0, h: 0 }
  stage.on('pointermove.wbquick', () => {
    const q = localPoint(stage, quickGroup)
    if (!q || !quickStart) return
    const b = viewerPointToPage(q.x, q.y, props.asset.w, props.asset.h, HEADER_H, FOOTER_H)
    quickSel.value = {
      x: Math.min(quickStart.x, b.x), y: Math.min(quickStart.y, b.y),
      w: Math.abs(b.x - quickStart.x), h: Math.abs(b.y - quickStart.y),
    }
  })
  stage.on('pointerup.wbquick', () => {
    const q = localPoint(stage, quickGroup)
    const a = quickStart
    stopQuickDrag()
    swallowClick = true
    if (!q || !a) { quickSel.value = quickPending.value; return }
    const end = viewerPointToPage(q.x, q.y, props.asset.w, props.asset.h, HEADER_H, FOOTER_H)
    const next = quickRelease(a, end, quickPending.value)
    if (next.action === 'cut') {
      emit('quickCut', props.asset, props.asset.currentPage ?? 0, next.rect)
      exitQuick()
      return
    }
    // Клік — «знайди сам»: рамка задачі (чи абзацу / картинки) стає пропозицією; вирізає клік усередині неї
    quickSel.value = quickPending.value
    if (next.action === 'snap') void snapAtPoint(next.point)
  })
}

// Перегорнули сторінку в «⚡» — рамка-пропозиція була для попередньої, клік у ній вирізав би не те
watch(() => props.asset.currentPage, () => {
  if (!quickMode.value) return
  quickPending.value = null
  quickSel.value = null
  quickNote.value = null
})

async function snapAtPoint(point: { x: number; y: number }): Promise<void> {
  if (!props.snapFn) return
  const page = props.asset.currentPage ?? 0
  const seq = ++snapSeq
  quickSnapping.value = true
  try {
    const res = await props.snapFn(page, point)
    if (seq !== snapSeq || !quickMode.value || (props.asset.currentPage ?? 0) !== page) return
    if (res.kind === 'none' || !res.rect) {
      quickPending.value = null
      quickSel.value = null
      quickNote.value = 'nothing'
      return
    }
    quickPending.value = { ...res.rect }
    quickSel.value = quickPending.value
  } catch (err) {
    // Видимо в шапці («не вдалося знайти — обведіть рамкою»), рамкою вручну працює як і було
    console.warn('[WB:DocViewer] snap failed', err)
    if (seq !== snapSeq || !quickMode.value) return
    quickPending.value = null
    quickSel.value = null
    quickNote.value = 'failed'
  } finally {
    if (seq === snapSeq) quickSnapping.value = false
  }
}

onBeforeUnmount(exitQuick)

const cutBtnConfig = computed(() => ({
  x: cutX.value,
  y: props.asset.h - FOOTER_H + 4,
  width: CUT_W,
  height: BTN_H,
  fill: '#d1fae5',
  stroke: '#047857',
  strokeWidth: 1,
  cornerRadius: 3,
  listening: true,
  name: 'doc-viewer-cut',
}))

const cutBtnTextConfig = computed(() => ({
  x: cutX.value,
  y: props.asset.h - FOOTER_H + 4,
  width: CUT_W,
  height: BTN_H,
  text: '✂️',
  fontSize: 13,
  align: 'center',
  verticalAlign: 'middle',
  listening: false,
}))

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
const nextBtnConfig = computed(() => ({
  x: props.asset.w - BTN_W - 8,
  y: props.asset.h - FOOTER_H + 4,
  width: BTN_W,
  height: BTN_H,
  fill: canGoNext.value ? '#e2e8f0' : '#f1f5f9',
  cornerRadius: 3,
  listening: true,
}))

const nextBtnTextConfig = computed(() => ({
  x: props.asset.w - BTN_W - 8,
  y: props.asset.h - FOOTER_H + 4,
  width: BTN_W,
  height: BTN_H,
  text: '\u25B6',
  fontSize: 12,
  fill: canGoNext.value ? '#334155' : '#cbd5e1',
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
  if (swallowClick) { swallowClick = false; e.cancelBubble = true; return }
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
    const nextX = props.asset.w - BTN_W - 8
    if (localPos.x >= nextX && localPos.x <= nextX + BTN_W && canGoNext.value) {
      e.cancelBubble = true
      emit('pageChange', props.asset.id, (props.asset.currentPage ?? 0) + 1)
      return
    }

    // «⚡ Швидка вирізка» — увімкнути / вимкнути режим рамки
    if (showQuick.value && localPos.x >= quickX.value && localPos.x <= quickX.value + CUT_W) {
      e.cancelBubble = true
      if (quickMode.value) exitQuick()
      else enterQuick(stage)
      return
    }

    // «✂️ Вирізка фрагмента»
    if (showCut.value && localPos.x >= cutX.value && localPos.x <= cutX.value + CUT_W) {
      e.cancelBubble = true
      exitQuick()
      emit('cut', props.asset)
      return
    }
  }

  // Поки обводять рамку, клік по сторінці — це рамка, а не виділення вікна
  if (quickMode.value) { e.cancelBubble = true; return }

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
