<!--
  Phase O PR-O4: Геометричні фігури — drag source tray.

  Refs:
    - saas_docs/domains/winterboard/phase_O_solid_objects/PLAN.md PR-O4
    - saas_docs/domains/winterboard/WINTERBOARD_SSOT.md §3.7.1

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-solid' + payload {src}.
    - NO local asset create — payload contains ONLY src; default state hydrates
      у drop handler через DEFAULT_SOLID_STATE constant (single source).
    - NO reuse `placeOnBoard` чи будь-якого demo code.
    - Tray не знає про boardStore/ops — це pure presentational drag source.
-->
<template>
  <div class="solids-tray" data-testid="solids-tray">
    <div class="solids-tray__header">{{ t('winterboard.contentSidebar.solidsSectionHeader') }}</div>
    <div class="solids-tray__grid">
      <button
        v-for="item in items"
        :key="item.type"
        type="button"
        class="solids-tray__btn"
        :data-testid="`solid-tray-${item.type}`"
        :draggable="true"
        :title="solidName(item)"
        @dragstart="onDragStart($event, item.type)"
      >
        <span class="solids-tray__icon" aria-hidden="true">
          <SolidIcon :type="item.type" />
        </span>
        <span class="solids-tray__label">{{ solidName(item) }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  SOLID_TYPES,
  SOLID_DRAG_MIME,
  type SolidDragPayload,
} from '../../constants/solidDefaults'
import type { SolidType } from '../../types/winterboard'

const { t, te } = useI18n()
const items = SOLID_TYPES

function solidName(item: { type: SolidType; label: string }): string {
  const key = `winterboard.solid.${item.type}`
  return te(key) ? t(key) : item.label
}

function onDragStart(e: DragEvent, src: SolidType): void {
  if (!e.dataTransfer) return
  const payload: SolidDragPayload = { src }
  e.dataTransfer.setData(SOLID_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

const SolidIcon: FunctionalComponent<{ type: SolidType }> = (props) => {
  const c = 'currentColor'
  const sw = '1.5'
  const a = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }
  switch (props.type) {
    case 'cube':
      return h('svg', a, [
        h('polygon', { points: '12,3 21,7.5 12,12 3,7.5' }),
        h('polygon', { points: '3,7.5 12,12 12,21 3,16.5' }),
        h('polygon', { points: '12,12 21,7.5 21,16.5 12,21' }),
      ])
    case 'cuboid':
      return h('svg', a, [
        h('polygon', { points: '12,5 22,8.5 12,12 2,8.5' }),
        h('polygon', { points: '2,8.5 12,12 12,21 2,17.5' }),
        h('polygon', { points: '12,12 22,8.5 22,17.5 12,21' }),
      ])
    case 'sphere':
      return h('svg', a, [
        h('circle', { cx: 12, cy: 12, r: 9 }),
        h('ellipse', { cx: 12, cy: 12, rx: 9, ry: 3.5, 'stroke-dasharray': '3 2' }),
      ])
    case 'cylinder':
      return h('svg', a, [
        h('ellipse', { cx: 12, cy: 6, rx: 8, ry: 2.5 }),
        h('line', { x1: 4, y1: 6, x2: 4, y2: 18 }),
        h('line', { x1: 20, y1: 6, x2: 20, y2: 18 }),
        h('ellipse', { cx: 12, cy: 18, rx: 8, ry: 2.5 }),
      ])
    case 'cone':
      return h('svg', a, [
        h('ellipse', { cx: 12, cy: 19, rx: 9, ry: 2.5 }),
        h('line', { x1: 12, y1: 3, x2: 3, y2: 19 }),
        h('line', { x1: 12, y1: 3, x2: 21, y2: 19 }),
      ])
    case 'tetrahedron':
      return h('svg', a, [
        h('polygon', { points: '12,3 21,19 3,19' }),
        h('line', { x1: 3, y1: 19, x2: 15.5, y2: 11, 'stroke-dasharray': '2 1.5' }),
      ])
    case 'pyramid3':
      return h('svg', a, [
        h('line', { x1: 12, y1: 3, x2: 5, y2: 18 }),
        h('line', { x1: 12, y1: 3, x2: 19, y2: 18 }),
        h('line', { x1: 12, y1: 3, x2: 12, y2: 21 }),
        h('line', { x1: 5, y1: 18, x2: 19, y2: 18 }),
        h('line', { x1: 5, y1: 18, x2: 12, y2: 21 }),
        h('line', { x1: 19, y1: 18, x2: 12, y2: 21 }),
      ])
    case 'pyramid4':
      return h('svg', a, [
        h('line', { x1: 12, y1: 3, x2: 4, y2: 14 }),
        h('line', { x1: 12, y1: 3, x2: 20, y2: 14 }),
        h('line', { x1: 12, y1: 3, x2: 4, y2: 21 }),
        h('line', { x1: 12, y1: 3, x2: 20, y2: 21 }),
        h('line', { x1: 4, y1: 14, x2: 20, y2: 14 }),
        h('line', { x1: 4, y1: 14, x2: 4, y2: 21 }),
        h('line', { x1: 20, y1: 14, x2: 20, y2: 21 }),
        h('line', { x1: 4, y1: 21, x2: 20, y2: 21 }),
      ])
    case 'prism3':
      return h('svg', a, [
        h('polygon', { points: '10,5 18,19 2,19' }),
        h('polygon', { points: '14,3 22,17 6,17' }),
        h('line', { x1: 10, y1: 5, x2: 14, y2: 3 }),
        h('line', { x1: 18, y1: 19, x2: 22, y2: 17 }),
        h('line', { x1: 2, y1: 19, x2: 6, y2: 17 }),
      ])
    case 'prism6':
      return h('svg', a, [
        h('polygon', { points: '12,3 20,7.5 20,16.5 12,21 4,16.5 4,7.5' }),
        h('line', { x1: 20, y1: 7.5, x2: 23, y2: 6 }),
        h('line', { x1: 20, y1: 16.5, x2: 23, y2: 15 }),
        h('line', { x1: 23, y1: 6, x2: 23, y2: 15 }),
      ])
    default:
      return h('svg', a, [h('rect', { x: 4, y: 4, width: 16, height: 16, rx: 2 })])
  }
}
</script>

<style scoped>
.solids-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.solids-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.solids-tray__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.solids-tray__btn {
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
  text-align: left;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
  min-height: 36px;
}

.solids-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  flex-shrink: 0;
}

.solids-tray__label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.solids-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.solids-tray__btn:active {
  cursor: grabbing;
}
</style>
