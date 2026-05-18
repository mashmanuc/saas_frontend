<!--
  TrigSolverTray — tray секція «Рівняння / Нерівності».
  4 кнопки рівнянь (sin/cos/tan/cot) + 4 кнопки нерівностей.
  Mirror pattern: TrigCircleTray.vue + Geometry2DTray.vue.

  HARD RULES:
    - Tray ONLY initiates drag з MIME + payload {type, func}.
    - NO local asset create — all asset building is in useContentDrop.addAtPosition.
    - Tray не знає про boardStore/ops.
-->
<template>
  <div class="trig-solver-tray" data-testid="trig-solver-tray">

    <!-- Equations section -->
    <div class="trig-solver-tray__header">Рівняння  <span class="trig-solver-tray__tag">f(x) = a</span></div>
    <div class="trig-solver-tray__grid">
      <div
        v-for="fn in FUNC_LIST"
        :key="`eq-${fn}`"
        class="trig-solver-tray__card-wrap"
      >
        <button
          type="button"
          class="trig-solver-tray__btn trig-solver-tray__btn--eq"
          :draggable="true"
          :title="`${fn}(x) = a — рівняння`"
          :data-testid="`trig-eq-tray-${fn}`"
          @dragstart="onDragEq(fn, $event)"
        >
          <span class="trig-solver-tray__icon trig-solver-tray__icon--eq" aria-hidden="true">
            <EqIcon :func="fn" />
          </span>
          <span class="trig-solver-tray__labels">
            <span class="trig-solver-tray__label">{{ fn }}(x) = a</span>
            <span class="trig-solver-tray__sublabel">рівняння</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${fn}(x) = a» на дошку`"
          @click.stop="addToolToBoard(TRIG_EQUATION_DRAG_MIME, JSON.stringify({ type: 'trig_equation', func: fn }))"
        >+</button>
      </div>
    </div>

    <!-- Inequalities section -->
    <div class="trig-solver-tray__header trig-solver-tray__header--ineq">
      Нерівності <span class="trig-solver-tray__tag trig-solver-tray__tag--ineq">f(x) &gt; a</span>
    </div>
    <div class="trig-solver-tray__grid">
      <div
        v-for="fn in FUNC_LIST"
        :key="`ineq-${fn}`"
        class="trig-solver-tray__card-wrap"
      >
        <button
          type="button"
          class="trig-solver-tray__btn trig-solver-tray__btn--ineq"
          :draggable="true"
          :title="`${fn}(x) > a — нерівність`"
          :data-testid="`trig-ineq-tray-${fn}`"
          @dragstart="onDragIneq(fn, $event)"
        >
          <span class="trig-solver-tray__icon trig-solver-tray__icon--ineq" aria-hidden="true">
            <IneqIcon :func="fn" />
          </span>
          <span class="trig-solver-tray__labels">
            <span class="trig-solver-tray__label">{{ fn }}(x) &gt; a</span>
            <span class="trig-solver-tray__sublabel">нерівність</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${fn}(x) > a» на дошку`"
          @click.stop="addToolToBoard(TRIG_INEQUALITY_DRAG_MIME, JSON.stringify({ type: 'trig_inequality', func: fn }))"
        >+</button>
      </div>
    </div>

    <div class="trig-solver-tray__hint">{{ t('winterboard.contentSidebar.trayDragHint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { TRIG_EQUATION_DRAG_MIME }   from '../../constants/trigEquationDefaults'
import { TRIG_INEQUALITY_DRAG_MIME } from '../../constants/trigInequalityDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import type { TrigEqFunc }   from '../../types/trigEquation'
import type { TrigIneqFunc } from '../../types/trigInequality'

const { t } = useI18n()
const addToolToBoard = useAddToolToBoard()

type FuncKey = 'sin' | 'cos' | 'tan' | 'cot'
const FUNC_LIST: FuncKey[] = ['sin', 'cos', 'tan', 'cot']

function onDragEq(fn: FuncKey, e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(TRIG_EQUATION_DRAG_MIME, JSON.stringify({ type: 'trig_equation', func: fn }))
  e.dataTransfer.effectAllowed = 'copy'
}

function onDragIneq(fn: FuncKey, e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(TRIG_INEQUALITY_DRAG_MIME, JSON.stringify({ type: 'trig_inequality', func: fn }))
  e.dataTransfer.effectAllowed = 'copy'
}

// ── Inline SVG icons ──────────────────────────────────────────────────────

const FUNC_COLORS: Record<FuncKey, string> = {
  sin: '#a83a5b', cos: '#3b7b9b', tan: '#3a8a4f', cot: '#7b6193',
}

const EqIcon: FunctionalComponent<{ func: FuncKey }> = ({ func }) => {
  const c = FUNC_COLORS[func]
  const sw = '1.6'
  return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' }, [
    // Unit circle
    h('circle', { cx: 9, cy: 12, r: 5.5, stroke: '#2b2118', 'stroke-width': '1.2' }),
    // Guide line (y=a for sin, x=a for cos)
    h('line', {
      x1: 3, y1: func === 'cos' ? 12 : 10,
      x2: 15, y2: func === 'cos' ? 12 : 10,
      stroke: '#94a3b8', 'stroke-width': '1', 'stroke-dasharray': '2 1.5',
      transform: func === 'cos' ? 'rotate(90 9 12)' : '',
    }),
    // Radius line + point
    h('line', { x1: 9, y1: 12, x2: 12.9, y2: 8.5, stroke: c, 'stroke-width': sw }),
    h('circle', { cx: 12.9, cy: 8.5, r: 1.8, fill: c }),
    // "=" sign on right
    h('line', { x1: 17, y1: 10.5, x2: 21, y2: 10.5, stroke: '#475569', 'stroke-width': '1.5' }),
    h('line', { x1: 17, y1: 13.5, x2: 21, y2: 13.5, stroke: '#475569', 'stroke-width': '1.5' }),
    h('text', { x: 17, y: 18, 'font-size': '5', fill: '#475569', 'font-family': 'sans-serif' }, 'a'),
  ])
}

const IneqIcon: FunctionalComponent<{ func: FuncKey }> = ({ func }) => {
  const c = FUNC_COLORS[func]
  return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' }, [
    // Circle
    h('circle', { cx: 9, cy: 12, r: 5.5, stroke: '#2b2118', 'stroke-width': '1.2' }),
    // Shaded arc (upper)
    h('path', {
      d: 'M4.7 9.5 A5.5 5.5 0 0 1 13.3 9.5',
      stroke: c, 'stroke-width': '2.5', fill: 'none', opacity: '0.55',
    }),
    // Guide line
    h('line', { x1: 3, y1: 9.5, x2: 15, y2: 9.5, stroke: '#94a3b8', 'stroke-width': '1', 'stroke-dasharray': '2 1.5' }),
    // ">" sign on right
    h('path', { d: 'M17 9 L21 12 L17 15', stroke: '#475569', 'stroke-width': '1.5', fill: 'none' }),
    h('text', { x: 17, y: 20, 'font-size': '5', fill: '#475569', 'font-family': 'sans-serif' }, 'a'),
  ])
}
</script>

<style scoped>
.trig-solver-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.trig-solver-tray__header {
  font-size: 11px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  display: flex;
  align-items: center;
  gap: 6px;
}

.trig-solver-tray__header--ineq {
  margin-top: 4px;
}

.trig-solver-tray__tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #fce7f3;
  color: #be185d;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  font-family: 'JetBrains Mono', monospace;
}

.trig-solver-tray__tag--ineq {
  background: #dcfce7;
  color: #15803d;
}

.trig-solver-tray__grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.trig-solver-tray__card-wrap {
  position: relative;
}

.trig-solver-tray__btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10.5px;
  line-height: 1.2;
  padding: 5px 7px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #1e293b;
  cursor: grab;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  min-height: 34px;
  width: 100%;
}

.trig-solver-tray__btn--eq:hover {
  background: #fce7f3;
  border-color: #f9a8d4;
}

.trig-solver-tray__btn--ineq {
  border-color: rgba(58,138,79,0.3);
}
.trig-solver-tray__btn--ineq:hover {
  background: #f0fdf4;
  border-color: #86efac;
}

.trig-solver-tray__btn:active { cursor: grabbing; }

.trig-solver-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.trig-solver-tray__labels {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

.trig-solver-tray__label {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
}

.trig-solver-tray__sublabel {
  font-size: 9px;
  color: #64748b;
}

.trig-solver-tray__hint {
  font-size: 11px;
  color: #94a3b8;
  padding: 0 2px;
}

/* ── Add button ── */
.tray-add-btn {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 16px;
  height: 16px;
  background: #f5f3ff;
  color: #6366f1;
  border: 1px solid #c7d2fe;
  border-radius: 3px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  z-index: 2;
  opacity: 0;
  transition: opacity 0.12s;
  pointer-events: none;
}

.trig-solver-tray__card-wrap:hover .tray-add-btn {
  opacity: 1;
  pointer-events: auto;
}

.tray-add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}
</style>
