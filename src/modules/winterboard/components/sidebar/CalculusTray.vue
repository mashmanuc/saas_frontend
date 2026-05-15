<!--
  Phase Calculus — drag-source tray для 2 calculus carток (derivative + integral).
  Mirror pattern: SolidsTray.vue, Geometry2DTray.vue.

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-calculus' + payload {mode}.
    - NO local asset create — payload містить тільки mode; default data hydrates
      у drop handler через buildDefaultCalculusData() (single source).
    - Tray не знає про boardStore/ops — pure presentational drag source.
-->
<template>
  <div class="calculus-tray" data-testid="calculus-tray">
    <div class="calculus-tray__header">
      {{ t('winterboard.contentSidebar.calculusHeader') }}
    </div>
    <div class="calculus-tray__grid">
      <button
        v-for="item in items"
        :key="item.mode"
        type="button"
        class="calculus-tray__btn"
        :data-testid="`calculus-tray-${item.mode}`"
        :draggable="true"
        :title="`${modeLabel(item.mode)} — ${modeDesc(item.mode)}`"
        @dragstart="onDragStart($event, item.mode)"
      >
        <span class="calculus-tray__icon" aria-hidden="true">
          <ModeIcon :mode="item.mode" />
        </span>
        <span class="calculus-tray__labels">
          <span class="calculus-tray__label">{{ modeLabel(item.mode) }}</span>
          <span class="calculus-tray__sublabel">{{ item.short }}</span>
        </span>
      </button>
    </div>
    <div class="calculus-tray__hint">
      {{ t('winterboard.contentSidebar.trayDragHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  CALCULUS_DRAG_MIME,
  CALCULUS_PRESETS,
  type CalculusDragPayload,
} from '../../constants/calculusDefaults'
import type { CalculusMode } from '../../vendor/calculus'

const { t } = useI18n()
const items = CALCULUS_PRESETS

function modeLabel(mode: CalculusMode): string {
  return t(`winterboard.calculus.mode.${mode}.full`)
}
function modeDesc(mode: CalculusMode): string {
  return t(`winterboard.calculus.mode.${mode}.desc`)
}

function onDragStart(e: DragEvent, mode: CalculusMode): void {
  if (!e.dataTransfer) return
  const payload: CalculusDragPayload = { mode }
  e.dataTransfer.setData(CALCULUS_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

const ModeIcon: FunctionalComponent<{ mode: CalculusMode }> = (props) => {
  const c = 'currentColor'
  const sw = '1.6'
  if (props.mode === 'derivative') {
    return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
      // crooked curve + tangent line
      h('path', { d: 'M3 19 Q 9 19 12 12 T 21 5', fill: 'none' }),
      h('line', { x1: 7, y1: 18, x2: 17, y2: 9, stroke: '#3b7b9b' }),
      h('circle', { cx: 12, cy: 12, r: 1.5, fill: '#c4622a', stroke: 'none' }),
    ])
  }
  // integral — curve with shaded area + ∫
  return h('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
    h('path', { d: 'M3 18 Q 12 4 21 18', fill: 'rgba(196,98,42,0.25)', stroke: c }),
    h('line', { x1: 3, y1: 18, x2: 21, y2: 18 }),
  ])
}
</script>

<style scoped>
.calculus-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.calculus-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.calculus-tray__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.calculus-tray__btn {
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
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 36px;
}

.calculus-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.calculus-tray__btn:active { cursor: grabbing; }

.calculus-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #c4622a;
  flex-shrink: 0;
}

.calculus-tray__labels {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.calculus-tray__label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calculus-tray__sublabel {
  font-size: 9px;
  color: #64748b;
  white-space: nowrap;
}

.calculus-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}
</style>
