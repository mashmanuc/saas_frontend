<!--
  Nmt3dTray — drag-source секція «Стереометрія НМТ»:
    21 параметричний 3D шаблон (куб, піраміди, призми, тіла обертання, комбіновані).
    Замінює старий SolidsTray (Phase O geometry_solid / Three.js WebGL).

  Кожна картка:
    - drag: HTML5 DnD + touch (Pointer Events)
    - click "+": додати на дошку у центр

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-nmt3d' + payload { templateKey }.
    - NO local asset create — default data hydrates у drop handler.
    - Tray не знає про boardStore/ops — pure presentational drag source.

  Mirror pattern: TrigCircleTray.vue / CalculusTray.vue.
-->
<template>
  <div class="nmt3d-tray" data-testid="nmt3d-tray">
    <div class="nmt3d-tray__header">
      Стереометрія НМТ
    </div>

    <div v-if="!bundleLoaded" class="nmt3d-tray__loading">
      завантаження…
    </div>

    <div class="nmt3d-tray__grid">
      <div
        v-for="key in NMT3D_TEMPLATE_ORDER"
        :key="key"
        class="nmt3d-tray__card-wrap"
      >
        <button
          type="button"
          class="nmt3d-tray__btn"
          :data-testid="`nmt3d-tray-${key}`"
          :draggable="true"
          :title="templateLabel(key)"
          @dragstart="onDragStart($event, key)"
          v-bind="dragHandlers(NMT3D_DRAG_MIME, JSON.stringify({ templateKey: key }), templateLabel(key))"
        >
          <span class="nmt3d-tray__icon" aria-hidden="true">
            <TemplateIcon :tpl-key="key" />
          </span>
          <span class="nmt3d-tray__label">{{ templateLabel(key) }}</span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${templateLabel(key)}» на дошку`"
          @click.stop="addToolToBoard(NMT3D_DRAG_MIME, JSON.stringify({ templateKey: key }))"
        >+</button>
      </div>
    </div>

    <div class="nmt3d-tray__hint">
      Перетягни на дошку або натисни +
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, ref, onMounted, type FunctionalComponent } from 'vue'
import {
  NMT3D_DRAG_MIME,
  NMT3D_TEMPLATE_ORDER,
  NMT3D_TEMPLATE_LABELS,
  type Nmt3dDragPayload,
} from '../../constants/nmt3dDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'

const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

const bundleLoaded = ref(false)

/** Return runtime name from bundle, or Ukrainian fallback. */
function templateLabel(key: string): string {
  const W = window as any
  return W.NMT3D?.TEMPLATES?.[key]?.name ?? NMT3D_TEMPLATE_LABELS[key] ?? key
}

function onDragStart(e: DragEvent, templateKey: string): void {
  if (!e.dataTransfer) return
  const payload: Nmt3dDragPayload = { templateKey }
  e.dataTransfer.setData(NMT3D_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

onMounted(async () => {
  // Lazy-load bundle so sidebar renders instantly — 3D workspace builds on demand
  await import('../../vendor/nmt3d')
  bundleLoaded.value = true
})

// ── Compact SVG icons per template key ──────────────────────────────────────
const TemplateIcon: FunctionalComponent<{ tplKey: string }> = (props) => {
  const c = 'currentColor'
  const sw = '1.5'
  const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw, 'stroke-linejoin': 'round' }

  switch (props.tplKey) {
    case 'cube':
      return h('svg', base, [
        h('polygon', { points: '12,3 21,7.5 12,12 3,7.5' }),
        h('polygon', { points: '3,7.5 12,12 12,21 3,16.5' }),
        h('polygon', { points: '12,12 21,7.5 21,16.5 12,21' }),
      ])
    case 'cuboid':
      return h('svg', base, [
        h('polygon', { points: '12,5 22,8.5 12,12 2,8.5' }),
        h('polygon', { points: '2,8.5 12,12 12,21 2,17.5' }),
        h('polygon', { points: '12,12 22,8.5 22,17.5 12,21' }),
      ])
    case 'prism4':
      return h('svg', base, [
        h('polygon', { points: '5,17 17,17 21,12 9,12' }),
        h('polygon', { points: '5,7 17,7 21,2 9,2' }),
        h('line', { x1: 5, y1: 7, x2: 5, y2: 17 }),
        h('line', { x1: 17, y1: 7, x2: 17, y2: 17 }),
        h('line', { x1: 21, y1: 2, x2: 21, y2: 12 }),
        h('line', { x1: 9, y1: 2, x2: 9, y2: 12, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'prism6':
      return h('svg', base, [
        h('polygon', { points: '8,19 16,19 20,16 20,12 16,9 8,9 4,12 4,16' }),
        h('polygon', { points: '8,10 16,10 20,7 20,3 16,0 8,0 4,3 4,7', opacity: '0' }),
        h('line', { x1: 8, y1: 9, x2: 8, y2: 19 }),
        h('line', { x1: 16, y1: 9, x2: 16, y2: 19 }),
        h('line', { x1: 20, y1: 7, x2: 20, y2: 12 }),
        h('line', { x1: 4, y1: 7, x2: 4, y2: 12, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'obliquePrism4':
      return h('svg', base, [
        h('polygon', { points: '3,19 15,19 18,14 6,14' }),
        h('polygon', { points: '9,7 21,7 18,2 6,2' }),
        h('line', { x1: 3, y1: 19, x2: 9, y2: 7 }),
        h('line', { x1: 15, y1: 19, x2: 21, y2: 7 }),
        h('line', { x1: 18, y1: 14, x2: 18, y2: 2 }),
        h('line', { x1: 6, y1: 14, x2: 6, y2: 2, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'pyramid4':
      return h('svg', base, [
        h('line', { x1: 12, y1: 3, x2: 4, y2: 14 }),
        h('line', { x1: 12, y1: 3, x2: 20, y2: 14 }),
        h('line', { x1: 12, y1: 3, x2: 4, y2: 21 }),
        h('line', { x1: 12, y1: 3, x2: 20, y2: 21 }),
        h('line', { x1: 4, y1: 14, x2: 20, y2: 14 }),
        h('line', { x1: 4, y1: 14, x2: 4, y2: 21 }),
        h('line', { x1: 20, y1: 14, x2: 20, y2: 21 }),
        h('line', { x1: 4, y1: 21, x2: 20, y2: 21 }),
      ])
    case 'pyramid3':
      return h('svg', base, [
        h('line', { x1: 12, y1: 3, x2: 5, y2: 18 }),
        h('line', { x1: 12, y1: 3, x2: 19, y2: 18 }),
        h('line', { x1: 12, y1: 3, x2: 12, y2: 21 }),
        h('line', { x1: 5, y1: 18, x2: 19, y2: 18 }),
        h('line', { x1: 5, y1: 18, x2: 12, y2: 21 }),
        h('line', { x1: 19, y1: 18, x2: 12, y2: 21 }),
      ])
    case 'pyramid6':
      return h('svg', base, [
        h('polygon', { points: '12,4 20,9 20,15 12,20 4,15 4,9' }),
        h('line', { x1: 12, y1: 1, x2: 4, y2: 9 }),
        h('line', { x1: 12, y1: 1, x2: 12, y2: 4 }),
        h('line', { x1: 12, y1: 1, x2: 20, y2: 9 }),
        h('line', { x1: 12, y1: 1, x2: 20, y2: 15 }),
        h('line', { x1: 12, y1: 1, x2: 12, y2: 20 }),
        h('line', { x1: 12, y1: 1, x2: 4, y2: 15 }),
      ])
    case 'tetrahedron':
      return h('svg', base, [
        h('polygon', { points: '12,3 21,19 3,19' }),
        h('line', { x1: 3, y1: 19, x2: 15.5, y2: 11, 'stroke-dasharray': '2 1.5' }),
        h('line', { x1: 21, y1: 19, x2: 15.5, y2: 11 }),
        h('line', { x1: 12, y1: 3, x2: 15.5, y2: 11 }),
      ])
    case 'trapPyramid':
      return h('svg', base, [
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 8, y2: 13 }),
        h('line', { x1: 12, y1: 3, x2: 16, y2: 13 }),
        h('line', { x1: 3, y1: 19, x2: 21, y2: 19 }),
        h('line', { x1: 8, y1: 13, x2: 16, y2: 13, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'frustumPyramid4':
      return h('svg', base, [
        h('polygon', { points: '3,20 21,20 18,14 6,14' }),
        h('polygon', { points: '7,8 17,8 15,4 9,4' }),
        h('line', { x1: 3, y1: 20, x2: 7, y2: 8 }),
        h('line', { x1: 21, y1: 20, x2: 17, y2: 8 }),
        h('line', { x1: 18, y1: 14, x2: 15, y2: 4 }),
        h('line', { x1: 6, y1: 14, x2: 9, y2: 4, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'cylinder':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 6, rx: 8, ry: 2.5 }),
        h('line', { x1: 4, y1: 6, x2: 4, y2: 18 }),
        h('line', { x1: 20, y1: 6, x2: 20, y2: 18 }),
        h('ellipse', { cx: 12, cy: 18, rx: 8, ry: 2.5 }),
      ])
    case 'cone':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
      ])
    case 'frustumCone':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('ellipse', { cx: 12, cy: 7, rx: 5, ry: 1.5 }),
        h('line', { x1: 7, y1: 7, x2: 3, y2: 19 }),
        h('line', { x1: 17, y1: 7, x2: 21, y2: 19 }),
      ])
    case 'sphere':
      return h('svg', base, [
        h('circle', { cx: 12, cy: 12, r: 9 }),
        h('ellipse', { cx: 12, cy: 12, rx: 9, ry: 3.5, 'stroke-dasharray': '3 2' }),
      ])
    case 'cubeInscribedSphere':
      return h('svg', base, [
        h('polygon', { points: '12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5' }),
        h('circle', { cx: 12, cy: 12, r: 5, stroke: '#3b7b9b' }),
      ])
    case 'cubeCircumSphere':
      return h('svg', base, [
        h('circle', { cx: 12, cy: 12, r: 9, stroke: '#3b7b9b' }),
        h('polygon', { points: '8,7 16,7 19,12 16,17 8,17 5,12' }),
      ])
    case 'cylinderInscribedSphere':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 5, rx: 7, ry: 2 }),
        h('line', { x1: 5, y1: 5, x2: 5, y2: 19 }),
        h('line', { x1: 19, y1: 5, x2: 19, y2: 19 }),
        h('ellipse', { cx: 12, cy: 19, rx: 7, ry: 2 }),
        h('circle', { cx: 12, cy: 12, r: 7, stroke: '#3b7b9b' }),
      ])
    case 'sphereInscribedCone':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
        h('circle', { cx: 12, cy: 14, r: 5, stroke: '#3b7b9b' }),
      ])
    case 'coneInscribedCylinder':
      return h('svg', base, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
        h('ellipse', { cx: 12, cy: 12, rx: 5, ry: 1.5, stroke: '#3b7b9b' }),
        h('line', { x1: 7, y1: 12, x2: 7, y2: 19, stroke: '#3b7b9b' }),
        h('line', { x1: 17, y1: 12, x2: 17, y2: 19, stroke: '#3b7b9b' }),
      ])
    case 'cubeSection3':
      return h('svg', base, [
        h('polygon', { points: '12,3 21,7.5 12,12 3,7.5' }),
        h('polygon', { points: '3,7.5 12,12 12,21 3,16.5' }),
        h('polygon', { points: '12,12 21,7.5 21,16.5 12,21' }),
        h('polygon', { points: '5,10 18,5 18,15 9,19', fill: '#c4622a', 'fill-opacity': '0.25', stroke: '#c4622a' }),
      ])
    default:
      return h('svg', base, [h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 })])
  }
}
</script>

<style scoped>
.nmt3d-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nmt3d-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.nmt3d-tray__loading {
  font-size: 11px;
  color: #94a3b8;
  padding: 2px 0;
}

.nmt3d-tray__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.nmt3d-tray__btn {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 1.2;
  padding: 6px 8px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #1e293b;
  cursor: grab;
  user-select: none;
  touch-action: none;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 36px;
  width: 100%;
}

.nmt3d-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.nmt3d-tray__btn:active {
  cursor: grabbing;
}

.nmt3d-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #c4622a;
  flex-shrink: 0;
}

.nmt3d-tray__label {
  font-weight: 600;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.nmt3d-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}

/* ── Card wrapper + add button ── */
.nmt3d-tray__card-wrap {
  position: relative;
}

.tray-add-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 18px;
  height: 18px;
  background: #f5f3ff;
  color: #6366f1;
  border: 1px solid #c7d2fe;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.12s, background 0.12s, border-color 0.12s, color 0.12s;
  pointer-events: none;
}

.nmt3d-tray__card-wrap:hover .tray-add-btn {
  opacity: 1;
  pointer-events: auto;
}

.tray-add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}

/* ── Touch / coarse pointer ── */
@media (pointer: coarse) {
  .tray-add-btn {
    opacity: 1;
    pointer-events: auto;
    width: 26px;
    height: 26px;
    font-size: 18px;
    top: 4px;
    right: 4px;
  }

  .nmt3d-tray__btn {
    font-size: 13px;
    min-height: 44px;
    padding: 8px 10px;
  }

  .nmt3d-tray__label {
    font-size: 13px;
  }
}
</style>
