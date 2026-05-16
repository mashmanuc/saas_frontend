<!--
  TrigCircle — drag-source tray для unit circle ↔ sin/cos graph widget.
  Mirror pattern: CalculusTray.vue.

  HARD RULES:
    - Tray ONLY initiates drag з MIME 'application/x-trig-circle' + payload {type}.
    - NO local asset create — default data hydrates у drop handler через
      buildDefaultTrigCircleData() (single source).
    - Tray не знає про boardStore/ops — pure presentational drag source.
-->
<template>
  <div class="trig-circle-tray" data-testid="trig-circle-tray">
    <div class="trig-circle-tray__header">
      {{ t('winterboard.contentSidebar.trigCircleHeader') }}
    </div>
    <div class="trig-circle-tray__grid">
      <button
        type="button"
        class="trig-circle-tray__btn"
        data-testid="trig-circle-tray-btn"
        :draggable="true"
        :title="t('winterboard.trigCircle.btnTitle')"
        @dragstart="onDragStart"
      >
        <span class="trig-circle-tray__icon" aria-hidden="true">
          <TrigCircleIcon />
        </span>
        <span class="trig-circle-tray__labels">
          <span class="trig-circle-tray__label">{{ t('winterboard.trigCircle.btnLabel') }}</span>
          <span class="trig-circle-tray__sublabel">sin · cos · tg · ctg</span>
        </span>
      </button>
    </div>
    <div class="trig-circle-tray__hint">
      {{ t('winterboard.contentSidebar.trayDragHint') }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { TRIG_CIRCLE_DRAG_MIME, type TrigCircleDragPayload } from '../../constants/trigCircleDefaults'

const { t } = useI18n()

function onDragStart(e: DragEvent): void {
  if (!e.dataTransfer) return
  const payload: TrigCircleDragPayload = { type: 'trig_circle' }
  e.dataTransfer.setData(TRIG_CIRCLE_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

const TrigCircleIcon: FunctionalComponent = () => {
  const c = 'currentColor'
  const sw = '1.5'
  return h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: c, 'stroke-width': sw }, [
    // Unit circle
    h('circle', { cx: 8, cy: 12, r: 6 }),
    // Radius line to ~60°
    h('line', { x1: 8, y1: 12, x2: 11, y2: 7, stroke: '#c4622a' }),
    // sin segment (red vertical)
    h('line', { x1: 11, y1: 7, x2: 11, y2: 12, stroke: '#a83a5b', 'stroke-width': '2' }),
    // cos segment (blue horizontal)
    h('line', { x1: 8, y1: 12, x2: 11, y2: 12, stroke: '#3b7b9b', 'stroke-width': '2' }),
    // Graph panel — sin wave
    h('path', { d: 'M15 12 Q17 8 19 12 T23 12', fill: 'none', stroke: '#a83a5b' }),
    // Graph panel — cos wave
    h('path', { d: 'M15 12 Q16 15 18 12 T23 12', fill: 'none', stroke: '#3b7b9b', 'stroke-dasharray': '2 1.5' }),
    // Point P
    h('circle', { cx: 11, cy: 7, r: 1.5, fill: '#c4622a', stroke: 'none' }),
  ])
}
</script>

<style scoped>
.trig-circle-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.trig-circle-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.trig-circle-tray__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 4px;
}

.trig-circle-tray__btn {
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
  width: 100%;
}

.trig-circle-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.trig-circle-tray__btn:active { cursor: grabbing; }

.trig-circle-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #a83a5b;
  flex-shrink: 0;
}

.trig-circle-tray__labels {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.trig-circle-tray__label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trig-circle-tray__sublabel {
  font-size: 9px;
  color: #64748b;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
}

.trig-circle-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}
</style>
