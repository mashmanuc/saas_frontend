<!--
  TrigonometryTray — drag-source секція «Тригонометрія»:
    · TrigCircle (unit circle ↔ sin/cos/tg/ctg graph)
    · Helix 3D   (P=(θ, sin θ, cos θ) — три тіні гелікса)

  Mirror pattern: CalculusTray.vue.

  HARD RULES:
    - Tray ONLY initiates drag з відповідним MIME + payload {type}.
    - NO local asset create — default data hydrates у drop handler.
    - Tray не знає про boardStore/ops — pure presentational drag source.
-->
<template>
  <div class="trig-circle-tray" data-testid="trig-circle-tray">
    <div class="trig-circle-tray__header">
      {{ t('winterboard.contentSidebar.trigCircleHeader') }}
    </div>
    <div class="trig-circle-tray__grid">
      <!-- TrigCircle button -->
      <div class="trig-circle-tray__card-wrap">
        <button
          type="button"
          class="trig-circle-tray__btn"
          data-testid="trig-circle-tray-btn"
          :draggable="true"
          :title="t('winterboard.trigCircle.btnTitle')"
          @dragstart="onDragStartTrig"
          v-bind="dragHandlers(TRIG_CIRCLE_DRAG_MIME, JSON.stringify({ type: 'trig_circle' }), t('winterboard.trigCircle.btnLabel'))"
        >
          <span class="trig-circle-tray__icon" aria-hidden="true">
            <TrigCircleIcon />
          </span>
          <span class="trig-circle-tray__labels">
            <span class="trig-circle-tray__label">{{ t('winterboard.trigCircle.btnLabel') }}</span>
            <span class="trig-circle-tray__sublabel">sin · cos · tg · ctg</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${t('winterboard.trigCircle.btnLabel')}» на дошку`"
          @click.stop="addToolToBoard(TRIG_CIRCLE_DRAG_MIME, JSON.stringify({ type: 'trig_circle' }))"
        >+</button>
      </div>

      <!-- Helix 3D button -->
      <div class="trig-circle-tray__card-wrap">
        <button
          type="button"
          class="trig-circle-tray__btn trig-circle-tray__btn--helix"
          data-testid="helix-tray-btn"
          :draggable="true"
          :title="t('winterboard.helix.btnTitle')"
          @dragstart="onDragStartHelix"
          v-bind="dragHandlers(HELIX_DRAG_MIME, JSON.stringify({ type: 'helix' }), t('winterboard.helix.btnLabel'))"
        >
          <span class="trig-circle-tray__icon trig-circle-tray__icon--helix" aria-hidden="true">
            <HelixIcon />
          </span>
          <span class="trig-circle-tray__labels">
            <span class="trig-circle-tray__label">{{ t('winterboard.helix.btnLabel') }}</span>
            <span class="trig-circle-tray__sublabel">P = (θ, sin θ, cos θ)</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          :title="`Додати «${t('winterboard.helix.btnLabel')}» на дошку`"
          @click.stop="addToolToBoard(HELIX_DRAG_MIME, JSON.stringify({ type: 'helix' }))"
        >+</button>
      </div>

      <!-- TrigSolver button -->
      <div class="trig-circle-tray__card-wrap">
        <button
          type="button"
          class="trig-circle-tray__btn trig-circle-tray__btn--solver"
          data-testid="trig-solver-tray-btn"
          :draggable="true"
          title="Тригонометричне рівняння / нерівність"
          @dragstart="onDragStartSolver"
          v-bind="dragHandlers(TRIG_SOLVER_DRAG_MIME, JSON.stringify({ type: 'sin' }), 'рівняння / нерівності')"
        >
          <span class="trig-circle-tray__icon trig-circle-tray__icon--solver" aria-hidden="true">
            <TrigSolverIcon />
          </span>
          <span class="trig-circle-tray__labels">
            <span class="trig-circle-tray__label">рівняння / нерівності</span>
            <span class="trig-circle-tray__sublabel">sin · cos · tg · ctg · =/&gt;/&lt;</span>
          </span>
        </button>
        <button
          type="button"
          class="tray-add-btn"
          title="Додати «рівняння / нерівності» на дошку"
          @click.stop="addToolToBoard(TRIG_SOLVER_DRAG_MIME, JSON.stringify({ type: 'sin' }))"
        >+</button>
      </div>
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
import { HELIX_DRAG_MIME, type HelixDragPayload } from '../../constants/helixDefaults'
import { TRIG_SOLVER_DRAG_MIME } from '../../constants/trigSolverDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'

const { t } = useI18n()
const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

function onDragStartTrig(e: DragEvent): void {
  if (!e.dataTransfer) return
  const payload: TrigCircleDragPayload = { type: 'trig_circle' }
  e.dataTransfer.setData(TRIG_CIRCLE_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

function onDragStartHelix(e: DragEvent): void {
  if (!e.dataTransfer) return
  const payload: HelixDragPayload = { type: 'helix' }
  e.dataTransfer.setData(HELIX_DRAG_MIME, JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

function onDragStartSolver(e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(TRIG_SOLVER_DRAG_MIME, JSON.stringify({ type: 'sin' }))
  e.dataTransfer.effectAllowed = 'copy'
}

// ── Icons ──────────────────────────────────────────────────────────────────

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

const TrigSolverIcon: FunctionalComponent = () =>
  h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none' }, [
    h('circle', { cx: 9, cy: 12, r: 5.5, stroke: '#2b2118', 'stroke-width': '1.3' }),
    h('line', { x1: 9, y1: 12, x2: 13.2, y2: 8.2, stroke: '#c4622a', 'stroke-width': '1.8' }),
    h('circle', { cx: 13.2, cy: 8.2, r: 2, fill: '#c4622a' }),
    h('line', { x1: 3, y1: 8.2, x2: 16, y2: 8.2, stroke: '#94a3b8', 'stroke-width': '1.1', 'stroke-dasharray': '2 1.5' }),
    h('line', { x1: 17.5, y1: 10, x2: 22, y2: 10, stroke: '#475569', 'stroke-width': '1.6' }),
    h('line', { x1: 17.5, y1: 13.5, x2: 22, y2: 13.5, stroke: '#475569', 'stroke-width': '1.6' }),
  ])

const HelixIcon: FunctionalComponent = () =>
  h('svg', { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [
    // Ellipse (unit circle end-on)
    h('ellipse', { cx: 6, cy: 12, rx: 3.5, ry: 5, stroke: '#2b2118', 'stroke-width': '1.4' }),
    // Helix curve (orange)
    h('path', { d: 'M9.5 7 Q14 4 17 7 Q20 10 17 14 Q14 18 9.5 17', stroke: '#c4622a', 'stroke-width': '2', fill: 'none' }),
    // sin shadow on back wall (red dashed)
    h('path', { d: 'M9.5 7 Q13 7 15.5 12 Q18 17 21 17', stroke: '#a83a5b', 'stroke-width': '1.2', fill: 'none', 'stroke-dasharray': '2 1.5' }),
    // Point P
    h('circle', { cx: 17, cy: 7, r: 1.8, fill: '#c4622a', stroke: 'none' }),
  ])
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
  touch-action: pan-y;
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

/* Helix button — subtle warm tint to distinguish from TrigCircle */
.trig-circle-tray__btn--helix {
  border-color: rgba(196, 98, 42, 0.35);
}
.trig-circle-tray__btn--helix:hover {
  background: #fef3e8;
  border-color: #c4622a;
}

/* Solver button — amber-orange tint */
.trig-circle-tray__btn--solver {
  border-color: rgba(196, 98, 42, 0.45);
}
.trig-circle-tray__btn--solver:hover {
  background: #fff7ed;
  border-color: rgba(196, 98, 42, 0.7);
}
.trig-circle-tray__icon--solver {
  color: #c4622a;
}

.trig-circle-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #a83a5b;
  flex-shrink: 0;
}
.trig-circle-tray__icon--helix {
  color: #c4622a;
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

/* ── Card wrapper + add button ── */
.trig-circle-tray__card-wrap {
  position: relative;
}

.trig-circle-tray__card-wrap .trig-circle-tray__btn {
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

.trig-circle-tray__card-wrap:hover .tray-add-btn {
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

  .trig-circle-tray__btn {
    font-size: 13px;
    min-height: 44px;
    padding: 8px 10px;
  }

  .trig-circle-tray__label {
    font-size: 13px;
  }

  .trig-circle-tray__sublabel {
    font-size: 11px;
  }
}
</style>
