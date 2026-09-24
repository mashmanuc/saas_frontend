<!-- WBSheetScrollbars — смуги прокрутки аркуша (власник 2026-09-24).

     Колесо / тачпад гортають збільшений аркуш (75117419), але цього не було
     видно: верх аркуша з заголовками карток ховався без жодного знаку, і
     здавалось, що картку не зсунути. Смуги показують, що аркуш прогорнуто й
     куди; повзунок можна тягнути мишею. Лише вигляд: ops не пише.

     `data-wb-view-control` — натискання тут не вважається спробою змінити
     дошку (useFrozenEditGuard пропускає його на дошці з завершеним записом). -->
<template>
  <div
    v-if="showY"
    class="wb-sheet-scroll wb-sheet-scroll--y"
    data-wb-view-control
    @pointerdown.stop="onTrackDown($event, 'y')"
  >
    <div
      class="wb-sheet-scroll__thumb"
      :style="{ height: `${thumbY.size}px`, transform: `translateY(${thumbY.pos}px)` }"
      @pointerdown.stop="onThumbDown($event, 'y')"
    />
  </div>
  <div
    v-if="showX"
    class="wb-sheet-scroll wb-sheet-scroll--x"
    data-wb-view-control
    @pointerdown.stop="onTrackDown($event, 'x')"
  >
    <div
      class="wb-sheet-scroll__thumb"
      :style="{ width: `${thumbX.size}px`, transform: `translateX(${thumbX.pos}px)` }"
      @pointerdown.stop="onThumbDown($event, 'x')"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { scrollThumb, scrollFromThumbDelta } from './sheetScroll'

const props = defineProps<{
  scrollX: number
  scrollY: number
  /** Розмір аркуша на екрані (аркуш × масштаб). */
  contentW: number
  contentH: number
  /** Розмір поля полотна. */
  viewW: number
  viewH: number
}>()
const emit = defineEmits<{ (e: 'scroll', x: number, y: number): void }>()

/** Відступ смуг від країв: вертикальна не лягає на горизонтальну. */
const GAP = 12
const trackY = computed(() => Math.max(0, props.viewH - GAP))
const trackX = computed(() => Math.max(0, props.viewW - GAP))

const showY = computed(() => props.contentH > props.viewH + 1 && trackY.value > 0)
const showX = computed(() => props.contentW > props.viewW + 1 && trackX.value > 0)

const thumbY = computed(() => scrollThumb(props.scrollY, props.contentH, props.viewH, trackY.value))
const thumbX = computed(() => scrollThumb(props.scrollX, props.contentW, props.viewW, trackX.value))

function onThumbDown(e: PointerEvent, axis: 'x' | 'y'): void {
  if (e.button !== 0) return
  e.preventDefault()
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)
  const start = axis === 'y' ? e.clientY : e.clientX
  const startScroll = axis === 'y' ? props.scrollY : props.scrollX
  const move = (ev: PointerEvent) => {
    const d = (axis === 'y' ? ev.clientY : ev.clientX) - start
    const next = axis === 'y'
      ? scrollFromThumbDelta(startScroll, d, props.contentH, props.viewH, trackY.value)
      : scrollFromThumbDelta(startScroll, d, props.contentW, props.viewW, trackX.value)
    if (axis === 'y') emit('scroll', props.scrollX, next)
    else emit('scroll', next, props.scrollY)
  }
  const up = () => {
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

/** Клік по доріжці повз повзунок — гортаємо на одне поле в той бік. */
function onTrackDown(e: PointerEvent, axis: 'x' | 'y'): void {
  if (e.button !== 0 || e.target !== e.currentTarget) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  if (axis === 'y') {
    const at = e.clientY - rect.top
    const dir = at < thumbY.value.pos ? -1 : 1
    emit('scroll', props.scrollX, props.scrollY + dir * props.viewH * 0.9)
  } else {
    const at = e.clientX - rect.left
    const dir = at < thumbX.value.pos ? -1 : 1
    emit('scroll', props.scrollX + dir * props.viewW * 0.9, props.scrollY)
  }
}
</script>

<style scoped>
.wb-sheet-scroll {
  position: absolute;
  z-index: 30;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.06);
  touch-action: none;
}
.wb-sheet-scroll--y { top: 2px; right: 2px; bottom: 12px; width: 8px; }
.wb-sheet-scroll--x { left: 2px; right: 12px; bottom: 2px; height: 8px; }
.wb-sheet-scroll__thumb {
  position: absolute;
  top: 0;
  left: 0;
  border-radius: 6px;
  background: rgba(15, 23, 42, 0.32);
  cursor: grab;
}
.wb-sheet-scroll--y .wb-sheet-scroll__thumb { width: 100%; }
.wb-sheet-scroll--x .wb-sheet-scroll__thumb { height: 100%; }
.wb-sheet-scroll__thumb:hover,
.wb-sheet-scroll__thumb:active { background: rgba(15, 23, 42, 0.5); }
.wb-sheet-scroll:hover { background: rgba(15, 23, 42, 0.1); }
</style>
