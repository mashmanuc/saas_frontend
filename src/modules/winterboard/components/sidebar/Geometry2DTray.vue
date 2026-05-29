<!--
  Phase G v2 — Geometry 2D v2 drag-source tray (bundle-backed).

  Refs:
    - vendor/geo2d/index.ts — engine + GEO_PRESETS registry
    - Mirror pattern: SolidsTray.vue, GraphCalculatorTray.vue

  EXTENSIBILITY:
    - Список карток приходить з window.GEO_PRESETS (set by geo2d-card.js).
    - Додавання нової картки → редагувати vendor/geo2d/geo2d-presets.js
      (add Geo2D.PRESETS[name] = { build, toggles, defaults })
      + vendor/geo2d/geo2d-card.js (add metadata у GEO_PRESETS array).
    - Цей tray НЕ потребує змін при додаванні нової картки.

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-geo2d' + payload {preset, name}.
    - NO local asset create — payload preset; default data hydrates у drop handler.
    - Tray не знає про boardStore/ops — pure presentational drag source.
-->
<template>
  <div class="geo2dv2-tray" data-testid="geometry-2d-v2-tray">
    <div class="geo2dv2-tray__header">
      {{ t('winterboard.contentSidebar.geo2dHeader') }}
    </div>
    <div v-if="!loaded" class="geo2dv2-tray__loading">
      {{ t('winterboard.contentSidebar.loading') }}
    </div>
    <div v-else class="geo2dv2-tray__grid">
      <div
        v-for="item in items"
        :key="item.type"
        class="geo2dv2-tray__card-wrap"
      >
        <button
          type="button"
          class="geo2dv2-tray__btn"
          :data-testid="`geometry-2d-v2-tray-${item.type}`"
          :draggable="true"
          :title="`${presetLabel(item)} — ${presetDesc(item)}`"
          @dragstart="onDragStart($event, item.type, presetLabel(item))"
          v-bind="dragHandlers(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({ preset: item.type }), presetLabel(item))"
        >
          <span class="geo2dv2-tray__icon" aria-hidden="true">
            <PresetIcon :type="item.type" />
          </span>
          <span class="geo2dv2-tray__label">{{ presetLabel(item) }}</span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${presetLabel(item)}» на дошку`"
          @click.stop="addToolToBoard(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify({ preset: item.type }))"
        >+</button>
      </div>
    </div>
    <div class="geo2dv2-tray__hint">
      {{ t('winterboard.contentSidebar.trayDragHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  GEOMETRY_2D_V2_DRAG_MIME,
  type Geometry2DV2DragPayload,
} from '../../constants/geometry2dV2Defaults'
import type { GeoPresetMeta } from '../../vendor/geo2d'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'

const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

const { t, te } = useI18n()
const items = ref<GeoPresetMeta[]>([])
const loaded = ref(false)

// Translated preset name з fallback на bundle's GEO_PRESETS.full (українська).
// Це дозволяє додавати нові presets у bundle без обов'язкового оновлення i18n
// одразу — буде показано українська назва до додавання ключа.
function presetLabel(item: GeoPresetMeta): string {
  const key = `winterboard.geo2dV2.preset.${item.type}.full`
  return te(key) ? t(key) : item.full
}

function presetDesc(item: GeoPresetMeta): string {
  const key = `winterboard.geo2dV2.preset.${item.type}.desc`
  return te(key) ? t(key) : item.desc
}

onMounted(async () => {
  // Lazy-import vendor так саме як renderer — bundle parse тільки коли tray mounted
  // (sidebar відкрита). Це zero overhead для replay сесій без tray.
  await import('../../vendor/geo2d')
  items.value = window.GEO_PRESETS || []
  loaded.value = true
})

function onDragStart(e: DragEvent, preset: string, name: string): void {
  if (!e.dataTransfer) return
  const payload: Geometry2DV2DragPayload = { preset, name }
  e.dataTransfer.setData(GEOMETRY_2D_V2_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

/** Compact SVG icon per preset type. Fallback — grid square. */
const PresetIcon: FunctionalComponent<{ type: string }> = (props) => {
  const c = 'currentColor'
  const sw = '1.6'
  switch (props.type) {
    case 'triangle':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [h('polygon', { points: '12,4 4,20 20,20' })])
    case 'circle':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [h('circle', { cx: 12, cy: 12, r: 8 })])
    case 'polygon':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [h('polygon', { points: '6,5 19,8 18,19 5,16' })])
    case 'pythagoras':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        h('polygon', { points: '4,20 4,8 16,20' }),
        h('rect', { x: 1, y: 8, width: 3, height: 3 }),
        h('rect', { x: 16, y: 20, width: 3, height: 3 }),
      ])
    case 'thales':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        h('line', { x1: 3, y1: 6, x2: 21, y2: 6 }),
        h('line', { x1: 3, y1: 12, x2: 21, y2: 12 }),
        h('line', { x1: 3, y1: 18, x2: 21, y2: 18 }),
        h('line', { x1: 6, y1: 3, x2: 18, y2: 21 }),
      ])
    case 'unitCircle':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        h('circle', { cx: 12, cy: 12, r: 8 }),
        h('line', { x1: 4, y1: 12, x2: 20, y2: 12 }),
        h('line', { x1: 12, y1: 4, x2: 12, y2: 20 }),
        h('line', { x1: 12, y1: 12, x2: 18, y2: 7 }),
      ])
    case 'similar':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        // малий синій △ + великий помаранчевий ~△, обидва з common vertex
        h('polygon', { points: '3,18 8,18 5,13', stroke: '#2563eb' }),
        h('polygon', { points: '3,18 21,18 13,4', stroke: '#ea580c' }),
      ])
    case 'parallels':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        // дві сині паралельні + червона січна по діагоналі
        h('line', { x1: 2, y1: 8, x2: 22, y2: 8, stroke: '#2563eb' }),
        h('line', { x1: 2, y1: 16, x2: 22, y2: 16, stroke: '#2563eb' }),
        h('line', { x1: 6, y1: 3, x2: 18, y2: 21, stroke: '#dc2626' }),
      ])
    case 'trapezium':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        // трапеція з більшою нижньою основою
        h('polygon', { points: '3,19 21,19 17,6 7,6' }),
      ])
    case 'euler9':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        // △ + dashed Euler line + small inner circle
        h('polygon', { points: '4,20 20,20 12,4' }),
        h('circle', { cx: 12, cy: 14, r: 5, 'stroke-dasharray': '2 2', stroke: '#ea580c' }),
        h('line', { x1: 6, y1: 17, x2: 18, y2: 11, stroke: '#a855f7', 'stroke-dasharray': '2 1.5' }),
      ])
    case 'simson':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        // △ + circumcircle + 3 dot перп
        h('circle', { cx: 12, cy: 13, r: 9 }),
        h('polygon', { points: '5,18 19,18 12,6' }),
        h('circle', { cx: 4, cy: 13, r: 1, fill: '#dc2626', stroke: 'none' }),
        h('line', { x1: 7, y1: 15, x2: 13, y2: 21, stroke: '#a855f7', 'stroke-width': '1.2' }),
      ])
    case 'inversion':
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        h('circle', { cx: 12, cy: 12, r: 8, stroke: '#2563eb' }),
        h('circle', { cx: 12, cy: 12, r: 0.8, fill: c, stroke: 'none' }),
        h('circle', { cx: 9, cy: 12, r: 1, fill: '#dc2626', stroke: 'none' }),
        h('circle', { cx: 19, cy: 12, r: 1, fill: '#ea580c', stroke: 'none' }),
        h('line', { x1: 12, y1: 12, x2: 21, y2: 12, stroke: '#94a3b8', 'stroke-dasharray': '1.5 1.5', 'stroke-width': '0.8' }),
      ])
    default:
      return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
        h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 }),
      ])
  }
}
</script>

<style scoped>
.geo2dv2-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.geo2dv2-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.geo2dv2-tray__loading {
  font-size: 11px;
  color: #94a3b8;
  padding: 4px;
}

.geo2dv2-tray__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.geo2dv2-tray__btn {
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
  touch-action: pan-y;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 36px;
}

.geo2dv2-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.geo2dv2-tray__btn:active {
  cursor: grabbing;
}

.geo2dv2-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  flex-shrink: 0;
}

.geo2dv2-tray__label {
  font-weight: 600;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.geo2dv2-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}

/* ── Card wrapper + add button ── */
.geo2dv2-tray__card-wrap {
  position: relative;
}

.geo2dv2-tray__card-wrap .geo2dv2-tray__btn {
  width: 100%;
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

.geo2dv2-tray__card-wrap:hover .tray-add-btn {
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

  .geo2dv2-tray__btn {
    font-size: 13px;
    min-height: 44px;
    padding: 8px 10px;
  }

  .geo2dv2-tray__label {
    font-size: 13px;
  }
}
</style>
