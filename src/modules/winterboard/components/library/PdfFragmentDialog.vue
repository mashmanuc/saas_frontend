<template>
  <!-- «✂️ Взяти фрагмент» (TZ_PDF_FRAGMENT_2026-10-13, ред. 2): сторінка PDF велика поверх дошки, учитель обводить
       задачу рамкою (миша, палець, перо) → «Додати на дошку». Сервер вирізає ділянку з ОРИГІНАЛУ PDF; вікно лишається
       відкритим, щоб брати наступну задачу. -->
  <Teleport to="body">
  <div class="wb-frag__scrim" data-testid="pdf-fragment-dialog" @click.self="close" @keydown="onKey">
    <section ref="dialogRef" class="wb-frag" role="dialog" aria-modal="true" :aria-label="t('winterboard.pdfFragment.title')" tabindex="-1">
      <header class="wb-frag__top">
        <h2 class="wb-frag__title">✂️ {{ t('winterboard.pdfFragment.title') }} · <span class="wb-frag__doc">{{ title }}</span></h2>
        <div class="wb-frag__nav">
          <button type="button" class="wb-frag__btn" data-testid="pdf-fragment-prev" :disabled="pageIdx <= 0 || phase === 'working'" :aria-label="t('winterboard.pdfFragment.prev')" @click="go(-1)">◀</button>
          <span class="wb-frag__page" data-testid="pdf-fragment-page">{{ t('winterboard.pdfFragment.page', { n: pageIdx + 1, total: totalPages }) }}</span>
          <button type="button" class="wb-frag__btn" data-testid="pdf-fragment-next" :disabled="pageIdx >= totalPages - 1 || phase === 'working'" :aria-label="t('winterboard.pdfFragment.next')" @click="go(1)">▶</button>
          <button type="button" class="wb-frag__btn" :aria-label="t('winterboard.pdfFragment.zoomOut')" :disabled="zoom <= ZOOMS[0]" @click="stepZoom(-1)">−</button>
          <button type="button" class="wb-frag__btn" :aria-label="t('winterboard.pdfFragment.zoomIn')" :disabled="zoom >= ZOOMS[ZOOMS.length - 1]" @click="stepZoom(1)">+</button>
          <button type="button" class="wb-frag__btn" @click="zoom = 1">{{ t('winterboard.pdfFragment.fit') }}</button>
        </div>
        <button type="button" class="wb-frag__btn is-on" data-testid="pdf-fragment-close" @click="close">{{ t('winterboard.pdfFragment.done') }}</button>
      </header>

      <div class="wb-frag__stage">
        <div class="wb-frag__sheet" :style="{ height: `${zoom * 100}%` }">
          <img
            v-if="pageUrl"
            :src="pageUrl"
            class="wb-frag__img"
            draggable="false"
            alt=""
            data-testid="pdf-fragment-image"
            @load="imgReady = true"
          >
          <div
            ref="overlayRef"
            class="wb-frag__overlay"
            data-testid="pdf-fragment-overlay"
            @pointerdown="onDown"
            @pointermove="onMove"
            @pointerup="onUp"
            @pointercancel="onUp"
          >
            <template v-if="rect">
              <div class="wb-frag__shade" :style="shadeStyle" />
              <div class="wb-frag__rect" data-testid="pdf-fragment-rect" :style="rectStyle">
                <span v-for="h in HANDLES" :key="h" class="wb-frag__handle" :data-h="h" :class="`is-${h}`" />
              </div>
            </template>
          </div>
        </div>
      </div>

      <footer class="wb-frag__bottom">
        <p class="wb-frag__msg" :class="{ 'is-problem': messageKind === 'problem' }" role="status" data-testid="pdf-fragment-msg">
          {{ message || t('winterboard.pdfFragment.hint') }}
        </p>
        <button
          type="button"
          class="wb-frag__btn is-on is-main"
          data-testid="pdf-fragment-add"
          :disabled="!canAdd"
          @click="add"
        >{{ phase === 'working' ? t('winterboard.pdfFragment.adding') : t('winterboard.pdfFragment.add') }}</button>
      </footer>
    </section>
  </div>
  </Teleport>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { cutPdfFragment, type PdfFragmentResult } from '../../api/library'
import { getDocumentPageUrl } from '../../composables/useDocumentPageCache'
import { MIN_SIDE, normRect, type FragRect } from './pdfFragmentRect'

/** Що треба запамʼятати в момент «Додати», щоб не поставити результат на іншу сторінку (ТЗ §2.2). */
export interface FragmentContext { boardId: string; pageId: string; viewerId: string }

const props = withDefaults(defineProps<{
  contentItemId: number
  /** 'pdf' | 'document' | 'presentation' — звідки брати картинки сторінок */
  contentType?: string
  title: string
  totalPages: number
  startPage: number
  viewerId: string
  /** Дошка й сторінка зараз (на момент натискання) */
  snapshot: () => FragmentContext
  /** Поставити готовий фрагмент; 'not_placed' — дошка чи сторінка вже інша */
  place: (ctx: FragmentContext, res: PdfFragmentResult, rect: FragRect) => 'placed' | 'not_placed'
}>(), { contentType: 'pdf' })
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()

const ZOOMS = [1, 1.5, 2, 3]
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const

const dialogRef = ref<HTMLElement | null>(null)
const overlayRef = ref<HTMLElement | null>(null)
const pageIdx = ref(Math.max(0, Math.min(props.startPage, props.totalPages - 1)))
const pageUrl = ref<string | null>(null)
const imgReady = ref(false)
const zoom = ref(1)
const rect = ref<FragRect | null>(null)
const phase = ref<'idle' | 'working'>('idle')
const message = ref('')
const messageKind = ref<'info' | 'problem'>('info')

const canAdd = computed(() =>
  phase.value === 'idle' && !!rect.value && rect.value.w >= MIN_SIDE && rect.value.h >= MIN_SIDE)

const pct = (v: number) => `${(v * 100).toFixed(3)}%`
const rectStyle = computed(() => rect.value && {
  left: pct(rect.value.x), top: pct(rect.value.y), width: pct(rect.value.w), height: pct(rect.value.h),
})
/** Поза рамкою притемнено: тінь рамки на весь аркуш */
const shadeStyle = computed(() => rect.value && {
  left: pct(rect.value.x), top: pct(rect.value.y), width: pct(rect.value.w), height: pct(rect.value.h),
})

async function loadPage(): Promise<void> {
  imgReady.value = false
  pageUrl.value = await getDocumentPageUrl(props.contentItemId, props.contentType, pageIdx.value)
  if (!pageUrl.value) say(t('winterboard.pdfFragment.err.page'), 'problem')
}

function go(step: number): void {
  const next = pageIdx.value + step
  if (next < 0 || next >= props.totalPages) return
  pageIdx.value = next
}
watch(pageIdx, () => { rect.value = null; message.value = ''; void loadPage() })

function stepZoom(dir: number): void {
  const i = ZOOMS.indexOf(zoom.value)
  zoom.value = ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? 0 : i) + dir))]
}

function say(text: string, kind: 'info' | 'problem' = 'info'): void {
  message.value = text
  messageKind.value = kind
}

// ─── Рамка: намалювати, підтягнути за кут чи бік, пересунути ────────────────

type Drag =
  | { mode: 'new'; x0: number; y0: number }
  | { mode: 'move'; dx: number; dy: number }
  | { mode: 'resize'; handle: string; start: FragRect }
let drag: Drag | null = null

function point(e: PointerEvent): { x: number; y: number } | null {
  const box = overlayRef.value?.getBoundingClientRect()
  if (!box || box.width <= 0 || box.height <= 0) return null
  return {
    x: Math.max(0, Math.min(1, (e.clientX - box.left) / box.width)),
    y: Math.max(0, Math.min(1, (e.clientY - box.top) / box.height)),
  }
}

function onDown(e: PointerEvent): void {
  if (phase.value === 'working') return
  const p = point(e)
  if (!p) return
  ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  const handle = (e.target as HTMLElement).dataset?.h
  const r = rect.value
  if (handle && r) drag = { mode: 'resize', handle, start: { ...r } }
  else if (r && p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) drag = { mode: 'move', dx: p.x - r.x, dy: p.y - r.y }
  else { drag = { mode: 'new', x0: p.x, y0: p.y }; rect.value = { x: p.x, y: p.y, w: 0, h: 0 } }
  message.value = ''
  e.preventDefault()
}

function onMove(e: PointerEvent): void {
  if (!drag) return
  const p = point(e)
  if (!p) return
  if (drag.mode === 'new') {
    rect.value = normRect(drag.x0, drag.y0, p.x, p.y)
  } else if (drag.mode === 'move' && rect.value) {
    const r = rect.value
    rect.value = { ...r, x: Math.max(0, Math.min(1 - r.w, p.x - drag.dx)), y: Math.max(0, Math.min(1 - r.h, p.y - drag.dy)) }
  } else if (drag.mode === 'resize') {
    const s = drag.start
    let x0 = s.x, y0 = s.y, x1 = s.x + s.w, y1 = s.y + s.h
    if (drag.handle.includes('w')) x0 = p.x
    if (drag.handle.includes('e')) x1 = p.x
    if (drag.handle.includes('n')) y0 = p.y
    if (drag.handle.includes('s')) y1 = p.y
    rect.value = normRect(x0, y0, x1, y1)
  }
}

function onUp(): void { drag = null }

// ─── Додати на дошку ─────────────────────────────────────────────────────────

const ERR_KEYS: Record<string, string> = {
  bad_rect: 'rect', bad_page: 'page', not_pdf: 'notPdf', forbidden: 'forbidden', not_found: 'forbidden',
  board_not_found: 'forbidden', viewer_not_on_board: 'viewerGone', bad_viewer: 'viewerGone', quota_exceeded: 'quota',
  not_ready: 'notReady',
}

function errorText(err: unknown): string {
  const resp = (err as { response?: { status?: number; data?: { error?: string } } } | null)?.response
  if (!resp || typeof resp.status !== 'number') return t('winterboard.pdfFragment.err.offline')
  const key = resp.status === 507 ? 'quota' : ERR_KEYS[resp.data?.error ?? ''] ?? 'failed'
  return t(`winterboard.pdfFragment.err.${key}`)
}

async function add(): Promise<void> {
  if (!canAdd.value || !rect.value) return
  const ctx = props.snapshot()
  const page = pageIdx.value + 1
  const r = { ...rect.value }
  phase.value = 'working'
  say(t('winterboard.pdfFragment.adding'))
  let res: PdfFragmentResult
  try {
    res = await cutPdfFragment({ contentItem: props.contentItemId, page, rect: r, board: ctx.boardId, viewer: props.viewerId })
  } catch (err) {
    // Вирізати не вдалося — нічого не створено; рамка лишається (без автоповторів)
    phase.value = 'idle'
    say(t('winterboard.pdfFragment.cutFailed', { reason: errorText(err) }), 'problem')
    return
  }
  phase.value = 'idle'
  if (props.place(ctx, res, r) === 'placed') {
    rect.value = null
    say(t('winterboard.pdfFragment.added'))
  } else {
    say(t('winterboard.pdfFragment.notPlaced', { name: res.name }), 'problem')
  }
}

function close(): void {
  if (phase.value === 'working') return
  emit('close')
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') { e.stopPropagation(); close() }
  else if (e.key === 'Enter' && canAdd.value) { e.preventDefault(); void add() }
}

onMounted(async () => {
  await loadPage()
  await nextTick()
  dialogRef.value?.focus()
})
</script>

<style scoped>
.wb-frag__scrim {
  position: fixed; inset: 0; z-index: var(--z-modal, 210); display: flex; align-items: center; justify-content: center;
  padding: 12px; background: rgba(2, 6, 23, .6);
}
.wb-frag {
  width: min(1100px, 100%); height: calc(100dvh - 24px); display: flex; flex-direction: column; gap: 8px;
  padding: 12px 14px; border-radius: 14px; background: #fff; color: #0f172a; box-shadow: 0 20px 50px rgba(2, 6, 23, .35);
  outline: none;
}
.wb-frag__top, .wb-frag__bottom { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.wb-frag__title { margin: 0; font-size: 16px; font-weight: 700; flex: 1 1 200px; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.wb-frag__doc { font-weight: 500; color: #475569; }
.wb-frag__nav { display: flex; align-items: center; gap: 6px; }
.wb-frag__page { font-size: 14px; min-width: 80px; text-align: center; }
.wb-frag__stage { flex: 1; min-height: 0; overflow: auto; background: #e2e8f0; border-radius: 10px; display: flex; justify-content: center; }
.wb-frag__sheet { position: relative; aspect-ratio: auto; flex: none; margin: 8px; }
.wb-frag__img { display: block; height: 100%; width: auto; user-select: none; -webkit-user-drag: none; box-shadow: 0 2px 10px rgba(2, 6, 23, .2); }
.wb-frag__overlay { position: absolute; inset: 0; cursor: crosshair; touch-action: none; }
.wb-frag__shade { position: absolute; box-shadow: 0 0 0 9999px rgba(15, 23, 42, .35); pointer-events: none; }
.wb-frag__rect { position: absolute; border: 2px solid #047857; background: rgba(4, 120, 87, .06); cursor: move; }
.wb-frag__handle { position: absolute; width: 14px; height: 14px; margin: -7px; background: #fff; border: 2px solid #047857; border-radius: 3px; }
.wb-frag__handle.is-nw { left: 0; top: 0; cursor: nwse-resize; }
.wb-frag__handle.is-n { left: 50%; top: 0; cursor: ns-resize; }
.wb-frag__handle.is-ne { left: 100%; top: 0; cursor: nesw-resize; }
.wb-frag__handle.is-e { left: 100%; top: 50%; cursor: ew-resize; }
.wb-frag__handle.is-se { left: 100%; top: 100%; cursor: nwse-resize; }
.wb-frag__handle.is-s { left: 50%; top: 100%; cursor: ns-resize; }
.wb-frag__handle.is-sw { left: 0; top: 100%; cursor: nesw-resize; }
.wb-frag__handle.is-w { left: 0; top: 50%; cursor: ew-resize; }
.wb-frag__msg { margin: 0; flex: 1 1 260px; font-size: 14px; color: #334155; }
.wb-frag__msg.is-problem { color: #92400e; }
.wb-frag__btn {
  min-height: 36px; min-width: 36px; padding: 0 12px; border: 1px solid #cbd5e1; border-radius: 10px; background: #fff;
  color: #0f172a; font-size: 14px; font-weight: 600; cursor: pointer;
}
.wb-frag__btn.is-on { background: #047857; border-color: #047857; color: #fff; }
.wb-frag__btn.is-main { min-height: 40px; padding: 0 18px; }
.wb-frag__btn:disabled { opacity: .45; cursor: default; }
</style>
