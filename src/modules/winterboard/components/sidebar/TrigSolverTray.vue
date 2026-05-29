<!--
  TrigSolverTray — одна кнопка «Тригонометрія» у сайдбарі.
  Додає trig_solver картку (sin, equation mode) на дошку.
  Режим та функція перемикаються всередині картки.
-->
<template>
  <div class="trig-solver-tray" data-testid="trig-solver-tray">
    <div class="trig-solver-tray__header">Тригонометрія</div>

    <div class="trig-solver-tray__card-wrap">
      <button
        type="button"
        class="trig-solver-tray__btn"
        :draggable="true"
        title="Тригонометричне рівняння / нерівність"
        data-testid="trig-solver-tray-btn"
        @dragstart="onDrag"
      >
        <span class="trig-solver-tray__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <circle cx="9" cy="12" r="5.5" stroke="#2b2118" stroke-width="1.3"/>
            <line x1="9" y1="12" x2="13.2" y2="8.2" stroke="#c4622a" stroke-width="1.8"/>
            <circle cx="13.2" cy="8.2" r="2" fill="#c4622a"/>
            <line x1="3" y1="8.2" x2="16" y2="8.2" stroke="#94a3b8" stroke-width="1.1" stroke-dasharray="2 1.5"/>
            <line x1="17.5" y1="10" x2="22" y2="10" stroke="#475569" stroke-width="1.6"/>
            <line x1="17.5" y1="13.5" x2="22" y2="13.5" stroke="#475569" stroke-width="1.6"/>
          </svg>
        </span>
        <span class="trig-solver-tray__label">рівняння / нерівності</span>
      </button>
      <button
        type="button"
        class="tray-add-btn"
        title="Додати на дошку"
        @click.stop="addToolToBoard(TRIG_SOLVER_DRAG_MIME, JSON.stringify({ type: 'sin' }))"
      >+</button>
    </div>

    <div class="trig-solver-tray__hint">{{ t('winterboard.contentSidebar.trayDragHint') }}</div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { TRIG_SOLVER_DRAG_MIME } from '../../constants/trigSolverDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'

const { t } = useI18n()
const addToolToBoard = useAddToolToBoard()

function onDrag(e: DragEvent): void {
  if (!e.dataTransfer) return
  e.dataTransfer.setData(TRIG_SOLVER_DRAG_MIME, JSON.stringify({ type: 'sin' }))
  e.dataTransfer.effectAllowed = 'copy'
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
}

.trig-solver-tray__card-wrap {
  position: relative;
}

.trig-solver-tray__btn {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 11px;
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  color: #1e293b;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
  width: 100%;
}
.trig-solver-tray__btn:hover {
  background: #fff7ed;
  border-color: rgba(196, 98, 42, 0.45);
}
.trig-solver-tray__btn:active { cursor: grabbing; }

.trig-solver-tray__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.trig-solver-tray__label {
  font-weight: 500;
  color: #334155;
}

.trig-solver-tray__hint {
  font-size: 11px;
  color: #94a3b8;
}

.tray-add-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 18px;
  height: 18px;
  background: #f5f3ff;
  color: #6366f1;
  border: 1px solid #c7d2fe;
  border-radius: 3px;
  font-size: 14px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
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
