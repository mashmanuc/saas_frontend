<!--
  TrigSolverTray — tray секція «Тригонометрія».
  4 кнопки (sin/cos/tan/cot) — кожна додає trig_solver картку (equation mode за замовчуванням).
  Режим рівняння/нерівності перемикається всередині картки.

  Mirror pattern: TrigCircleTray.vue.

  HARD RULES:
    - Tray ONLY initiates drag з MIME + payload {func}.
    - NO local asset create — all asset building is in useContentDrop.addAtPosition.
    - Tray не знає про boardStore/ops.
-->
<template>
  <div class="trig-solver-tray" data-testid="trig-solver-tray">
    <div class="trig-solver-tray__header">
      Тригонометрія
      <span class="trig-solver-tray__tag">рівняння / нерівності</span>
    </div>

    <div class="trig-solver-tray__grid">
      <div
        v-for="fn in FUNC_LIST"
        :key="fn"
        class="trig-solver-tray__card-wrap"
      >
        <button
          type="button"
          class="trig-solver-tray__btn"
          :draggable="true"
          :title="`${fn}(x) — рівняння / нерівність`"
          :data-testid="`trig-solver-tray-${fn}`"
          @dragstart="onDrag(fn, $event)"
        >
          <span class="trig-solver-tray__icon" aria-hidden="true">
            <SolverIcon :func="fn" />
          </span>
          <span class="trig-solver-tray__labels">
            <span class="trig-solver-tray__label">{{ fn }}(x)</span>
            <span class="trig-solver-tray__sublabel">рівн. / нерівн.</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${fn}(x)» на дошку`"
          @click.stop="addToolToBoard(TRIG_SOLVER_DRAG_MIME, JSON.stringify({ func: fn }))"
        >+</button>
      </div>
    </div>

    <div class="trig-solver-tray__hint">{{ t('winterboard.contentSidebar.trayDragHint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import { TRIG_SOLVER_DRAG_MIME } from '../../constants/trigSolverDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import type { TrigSolverFunc } from '../../types/trigSolver'

const { t } = useI18n()
const addToolToBoard = useAddToolToBoard()

const FUNC_LIST: TrigSolverFunc[] = ['sin', 'cos', 'tan', 'cot']

function onDrag(fn: TrigSolverFunc, e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(TRIG_SOLVER_DRAG_MIME, JSON.stringify({ func: fn }))
  e.dataTransfer.effectAllowed = 'copy'
}

// ── Inline SVG icon ───────────────────────────────────────────────────────

const FUNC_COLORS: Record<TrigSolverFunc, string> = {
  sin: '#a83a5b', cos: '#3b7b9b', tan: '#3a8a4f', cot: '#7b6193',
}

const SolverIcon: FunctionalComponent<{ func: TrigSolverFunc }> = ({ func }) => {
  const c = FUNC_COLORS[func]
  return h('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' }, [
    // Unit circle
    h('circle', { cx: 9, cy: 12, r: 5.5, stroke: '#2b2118', 'stroke-width': '1.2' }),
    // Radius line + point
    h('line', { x1: 9, y1: 12, x2: 12.9, y2: 8.5, stroke: c, 'stroke-width': '1.6' }),
    h('circle', { cx: 12.9, cy: 8.5, r: 1.8, fill: c }),
    // Guide line (y=a)
    h('line', { x1: 3, y1: 8.5, x2: 15, y2: 8.5, stroke: '#94a3b8', 'stroke-width': '1', 'stroke-dasharray': '2 1.5' }),
    // "=" or ">" on right
    h('line', { x1: 17, y1: 10.5, x2: 21, y2: 10.5, stroke: '#475569', 'stroke-width': '1.5' }),
    h('line', { x1: 17, y1: 13.5, x2: 21, y2: 13.5, stroke: '#475569', 'stroke-width': '1.5' }),
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

.trig-solver-tray__tag {
  font-size: 9px;
  padding: 1px 5px;
  border-radius: 3px;
  background: #fef3c7;
  color: #92400e;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
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
.trig-solver-tray__btn:hover {
  background: #fff7ed;
  border-color: rgba(196, 98, 42, 0.4);
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
