<!--
  CalculusTray — секція «Аналіз функцій»:
    · Графічний калькулятор (f(x) grapher)
    · Похідна (derivative + tangent)
    · Первісна (integral + Riemann)

  Mirror pattern: TrigCircleTray.vue (об'єднана секція з кількома картками).

  HARD RULES:
    - Tray ONLY initiates drag з відповідним MIME + payload.
    - NO local asset create — default data hydrates у drop handler.
    - Tray не знає про boardStore/ops — pure presentational drag source.
-->
<template>
  <div class="calculus-tray" data-testid="calculus-tray">
    <div class="calculus-tray__header">
      {{ t('winterboard.contentSidebar.calculusHeader') }}
    </div>
    <div class="calculus-tray__grid">
      <!-- Графічний калькулятор — повна ширина (перший рядок) -->
      <div class="calculus-tray__card-wrap calculus-tray__card-wrap--graph">
        <button
          type="button"
          class="calculus-tray__btn calculus-tray__btn--graph"
          data-testid="graph-calculator-tray-btn"
          :draggable="true"
          :title="t('winterboard.contentSidebar.graphCalcLabel')"
          @dragstart="onDragStartGraph"
          v-bind="dragHandlers(GRAPH_CALCULATOR_MIME, '{}', t('winterboard.contentSidebar.graphCalcLabel'))"
        >
          <span class="calculus-tray__icon calculus-tray__icon--graph" aria-hidden="true">f(x)</span>
          <span class="calculus-tray__labels">
            <span class="calculus-tray__label">{{ t('winterboard.contentSidebar.graphCalcLabel') }}</span>
            <span class="calculus-tray__sublabel">y = f(x) · графік · функції</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${t('winterboard.contentSidebar.graphCalcLabel')}» на дошку`"
          @click.stop="addToolToBoard(GRAPH_CALCULATOR_MIME, '{}')"
        >+</button>
      </div>

      <!-- Похідна + Первісна — 2 кнопки у другому рядку -->
      <div
        v-for="item in items"
        :key="item.mode"
        class="calculus-tray__card-wrap"
      >
        <button
          type="button"
          class="calculus-tray__btn"
          :data-testid="`calculus-tray-${item.mode}`"
          :draggable="true"
          :title="`${modeLabel(item.mode)} — ${modeDesc(item.mode)}`"
          @dragstart="onDragStart($event, item.mode)"
          v-bind="dragHandlers(CALCULUS_DRAG_MIME, JSON.stringify({ mode: item.mode }), modeLabel(item.mode))"
        >
          <span class="calculus-tray__icon" aria-hidden="true">
            <ModeIcon :mode="item.mode" />
          </span>
          <span class="calculus-tray__labels">
            <span class="calculus-tray__label">{{ modeLabel(item.mode) }}</span>
            <span class="calculus-tray__sublabel">{{ item.short }}</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${modeLabel(item.mode)}» на дошку`"
          @click.stop="addToolToBoard(CALCULUS_DRAG_MIME, JSON.stringify({ mode: item.mode }))"
        >+</button>
      </div>
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
import { GRAPH_CALCULATOR_MIME } from '../../constants/graphCalculatorDefaults'
import type { CalculusMode } from '../../vendor/calculus'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'

const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

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

function onDragStartGraph(e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(GRAPH_CALCULATOR_MIME, JSON.stringify({}))
  e.dataTransfer.effectAllowed = 'copy'
}

const ModeIcon: FunctionalComponent<{ mode: CalculusMode }> = (props) => {
  const sw = '1.6'
  if (props.mode === 'derivative') {
    return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw }, [
      h('path', { d: 'M3 19 Q 9 19 12 12 T 21 5', fill: 'none' }),
      h('line', { x1: 7, y1: 18, x2: 17, y2: 9, stroke: '#3b7b9b' }),
      h('circle', { cx: 12, cy: 12, r: 1.8, fill: '#c4622a', stroke: 'none' }),
    ])
  }
  return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': sw }, [
    h('path', { d: 'M3 18 Q 12 4 21 18', fill: 'rgba(196,98,42,0.25)', stroke: 'currentColor' }),
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

/* 2-column grid: graph calculator spans full width (1/-1),
   derivative + integral у двох стовпцях.
   auto-fill: drops to 1 column when sidebar < ~260px (e.g. desktop narrow resize) */
.calculus-tray__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 4px;
}

/* ── Base button ── */
.calculus-tray__btn {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  line-height: 1.25;
  padding: 7px 9px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #1e293b;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 40px;
}

.calculus-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.calculus-tray__btn:active { cursor: grabbing; }

/* Graph calculator — full-width row, синій акцент */
.calculus-tray__btn--graph {
  grid-column: 1 / -1;
  border-color: rgba(59, 123, 155, 0.4);
}
.calculus-tray__btn--graph:hover {
  background: #e8f4f8;
  border-color: #3b7b9b;
}

/* ── Icon ── */
.calculus-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #c4622a;
  flex-shrink: 0;
  width: 22px;
}

/* Graph calculator f(x) text icon — синій, курсив */
.calculus-tray__icon--graph {
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  font-weight: 700;
  font-style: italic;
  color: #3b7b9b;
  width: 28px;
}

/* ── Labels ── */
.calculus-tray__labels {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.calculus-tray__label {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Sublabel: збільшено з 9px → 11px для читабельності формул */
.calculus-tray__sublabel {
  font-size: 11px;
  color: #64748b;
  white-space: nowrap;
  font-family: 'JetBrains Mono', monospace;
  overflow: hidden;
  text-overflow: ellipsis;
}

.calculus-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}

/* ── Card wrapper + add button ── */
.calculus-tray__card-wrap {
  position: relative;
}

.calculus-tray__card-wrap--graph {
  grid-column: 1 / -1;
}

.calculus-tray__card-wrap .calculus-tray__btn {
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

.calculus-tray__card-wrap:hover .tray-add-btn {
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
  /* 1-column on touch: fixes stacking/rendering bug with position:absolute
     tray-add-btn inside 2-column CSS grid on touch screens */
  .calculus-tray__grid {
    grid-template-columns: 1fr;
  }
  /* graph calc no longer needs manual full-width span when grid is 1-column */
  .calculus-tray__card-wrap--graph {
    grid-column: auto;
  }

  .tray-add-btn {
    opacity: 1;
    pointer-events: auto;
    width: 26px;
    height: 26px;
    font-size: 18px;
    top: 4px;
    right: 4px;
  }

  .calculus-tray__btn {
    font-size: 13px;
    min-height: 44px;
    padding: 9px 11px;
  }

  .calculus-tray__label {
    font-size: 13px;
  }

  .calculus-tray__sublabel {
    font-size: 12px;
  }
}
</style>
