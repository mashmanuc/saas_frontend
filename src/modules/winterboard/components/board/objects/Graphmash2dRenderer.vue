<!--
  Graphmash2dRenderer — ЖИВИЙ GraphMASH 2D графік як WBAsset (§3.7.14, B2 2026-07-07).

  На відміну від mash_scene-картки (§3.7.13, статичний thumbnail), тут сцена
  рендериться НАТИВНО вбудованим движком `window.GraphCalculator` (vendor/graphmash2d)
  — справжні криві повної якості, оновлюються при зміні data.

  v1 = display-live: графік рендериться живим движком, board-drag/select/resize —
  через Konva-proxy (stage pointer-events:none). Редагування виразів = deep-link
  «Відкрити у MASH». Локальний pan/zoom на дошці — v1.1 (уникаємо конфлікту з board).
  Жодного нового ops write-шляху: data.scene незмінна на дошці → SYSTEM_LAW чисто.

  POINTER-EVENTS: дзеркало theory_card/nmt3d — root none, кнопки auto+stop.
-->
<template>
  <div
    ref="rootEl"
    class="gm2d-card"
    :class="{ 'is-selected': isSelected }"
    :data-testid="`graphmash2d-${asset.id}`"
  >
    <header class="gm2d-header">
      <span class="gm2d-badge">GraphMASH 2D</span>
      <a
        class="gm2d-open"
        :href="openHref"
        target="_blank"
        rel="noopener"
        title="Відкрити у MASH"
        @mousedown.stop
        @pointerdown.stop
        @click.stop
      >↗</a>
      <button
        v-if="!asset.locked && isSelected"
        type="button"
        class="gm2d-delete"
        title="Видалити"
        @click.stop="emit('delete')"
        @mousedown.stop
        @pointerdown.stop
      >×</button>
    </header>
    <div ref="stageEl" class="gm2d-stage" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { WBAsset, MashSceneData } from '../../../types/winterboard'
import type { GraphCalculatorInstance } from '../../../vendor/graphmash2d'
// side-effect: динамічний import у mountCalc() виконує IIFE-вендор (ставить window.__GM2D)
import { useExportCapture } from '../../../composables/useExportCapture'
import { snapshotElement } from '../../../utils/snapshotElement'

const props = withDefaults(
  defineProps<{
    asset: WBAsset
    isSelected?: boolean
    interactive?: boolean
  }>(),
  { isSelected: false, interactive: true },
)

const emit = defineEmits<{
  'update:asset': [asset: WBAsset]
  delete: []
}>()

const rootEl = ref<HTMLElement | null>(null)
const stageEl = ref<HTMLElement | null>(null)
let calc: GraphCalculatorInstance | null = null
let ro: ResizeObserver | null = null

const data = computed<MashSceneData>(
  () => (props.asset.data as MashSceneData) ?? { version: 1, app: 'g2d', sceneFormat: '', scene: {} },
)
const openHref = computed(() => '/mash/grapher/index.html')

/** Застосувати серіалізовану сцену GraphMASH-2D до інстансу (дзеркало grapher.js restore). */
function applyScene(inst: GraphCalculatorInstance, scene: Record<string, unknown>) {
  const gc = window.__GM2D?.GraphCalc
  inst.batch(() => {
    for (const e of [...inst.expressions]) inst.removeExpression(e.id)
    const items = (Array.isArray(scene.expressions) && scene.expressions)
      || (Array.isArray((scene as { items?: unknown[] }).items) && (scene as { items: unknown[] }).items)
      || []
    for (const raw of items as Array<Record<string, unknown>>) {
      if (raw.isTable && raw.table) {
        const t = inst.addTable(JSON.parse(JSON.stringify(raw.table)))
        if (typeof raw.color === 'string') inst.setColor(t.id, raw.color)
        if (raw.hidden) inst.setHidden(t.id, true)
        if (raw.regression) inst.setRegression(t.id, raw.regression)
      } else {
        const e = inst.addExpression(typeof raw.src === 'string' ? raw.src : '')
        if (typeof raw.color === 'string') inst.setColor(e.id, raw.color)
        if (raw.hidden) inst.setHidden(e.id, true)
        const tr = raw.tRange as { min: number; max: number } | undefined
        if (tr) inst.setTRange(e.id, tr.min, tr.max)
      }
    }
    const vp = scene.viewport as { cx: number; cy: number; scale: number } | undefined
    if (vp) inst.viewport = { ...vp }
  })
  // param-значення (слайдери) — після виразів (setParam ігнорує невідомі)
  const params = scene.params as Record<string, number> | undefined
  if (params && inst.setParam) {
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === 'number' && Number.isFinite(v)) inst.setParam(k, v)
    }
  }
  const angleMode = scene.angleMode as string | undefined
  if (angleMode && gc) { try { gc.setAngleMode(angleMode) } catch { /* noop */ } }
}

/**
 * Форсуємо сайзинг canvas. Внутрішній ResizeObserver движка у Vue-контексті
 * ненадійний (mount при 0-розмірі overlay + orphan першого інстансу), тому
 * ганяємо приватний `_resize()` самі: власний RO на stage + rAF-нудж.
 */
function forceResize() {
  const c = calc as unknown as { _resize?: () => void; _scheduleRender?: () => void }
  try { c?._resize?.() } catch { /* noop */ }
}

async function mountCalc() {
  // side-effect-завантаження ізольованого вендора (ставить window.__GM2D), дзеркало nmt3d
  await import('../../../vendor/graphmash2d')
  const Ctor = window.__GM2D?.GraphCalculator
  if (!stageEl.value || !Ctor) return
  calc = new Ctor(stageEl.value, {})
  try {
    applyScene(calc, data.value.scene)
  } catch (err) {
    console.warn('[graphmash2d] applyScene failed', err)
  }
  // Сайзинг: rAF (після layout) + власний RO (перекриваємо ненадійний внутрішній).
  requestAnimationFrame(() => { forceResize(); requestAnimationFrame(forceResize) })
  if (typeof ResizeObserver !== 'undefined' && stageEl.value) {
    ro = new ResizeObserver(() => forceResize())
    ro.observe(stageEl.value)
  }
}

onMounted(mountCalc)

// data.scene змінилась (replay / update) → перезастосувати сцену на існуючий інстанс
watch(
  () => JSON.stringify(data.value.scene),
  () => { if (calc) { try { applyScene(calc, data.value.scene) } catch { /* noop */ } } },
)

onBeforeUnmount(() => {
  try { ro?.disconnect() } catch { /* noop */ }
  ro = null
  try { calc?.destroy?.() } catch { /* noop */ }
  calc = null
})

// Export capture — як інші widget-и: картка потрапляє у PNG/PDF-експорт дошки.
useExportCapture(
  () => props.asset?.id,
  (signal) => snapshotElement(rootEl.value, signal),
)
</script>

<style scoped>
.gm2d-card {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #ffffff;
  border: 1px solid rgba(23, 162, 115, 0.4);
  border-radius: 10px;
  overflow: hidden;
  pointer-events: none; /* drag/select/resize — через Konva proxy */
  box-shadow: 0 2px 10px rgba(23, 162, 115, 0.12);
}
.gm2d-card.is-selected { border-color: #17a273; }

.gm2d-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  background: rgba(23, 162, 115, 0.08);
  flex-shrink: 0;
}
.gm2d-badge {
  font-size: 11px;
  font-weight: 700;
  color: #12855e;
  flex: 1;
}
.gm2d-open,
.gm2d-delete {
  pointer-events: auto;
  border: none;
  background: none;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  text-decoration: none;
  color: #12855e;
}
.gm2d-delete { color: #9ca3af; font-size: 16px; }
.gm2d-delete:hover { color: #ef4444; }

.gm2d-stage {
  flex: 1;
  min-height: 0;
  position: relative;
  pointer-events: none; /* v1 display-live: без board-side pan/zoom (уникаємо конфлікту) */
}
/* Движок додає плаваючі zoom-кнопки — у display-режимі ховаємо. */
.gm2d-stage :deep(.gc-zoom) { display: none; }
.gm2d-stage :deep(.gc-canvas) { display: block; width: 100%; height: 100%; }
</style>
