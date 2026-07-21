<!--
  Phase G — graph_calculator drag source tray.

  Per OPS_SYNC_SSOT.md INV-21 + UX-RULE-3:
    - Tray ONLY initiates drag з MIME 'application/x-graph-calculator'.
    - NO state generation — DEFAULT_GRAPH_STATE hydrates у drop handler.
    - NO boardStore/ops awareness — pure presentational drag source.
-->
<template>
  <div class="gc-tray" data-testid="graph-calculator-tray">
    <div class="gc-tray__header">{{ t('winterboard.contentSidebar.interactiveHeader') }}</div>
    <div class="gc-tray__card-wrap">
      <button
        type="button"
        class="gc-tray__btn"
        data-testid="graph-calculator-tray-btn"
        :draggable="true"
        :title="t('winterboard.contentSidebar.graphCalcLabel')"
        @dragstart="onDragStart"
        v-bind="dragHandlers(GRAPH_CALCULATOR_MIME, '{}', t('winterboard.contentSidebar.graphCalcLabel'))"
      >
        <span class="gc-tray__icon">f(x)</span>
        <span class="gc-tray__label">{{ t('winterboard.contentSidebar.graphCalcLabel') }}</span>
      </button>
      <button
        type="button"
        class="tray-add-btn"
        :title="`Додати «${t('winterboard.contentSidebar.graphCalcLabel')}» на дошку`"
        @click.stop="addToolToBoard(GRAPH_CALCULATOR_MIME, '{}')"
      >+</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { GRAPH_CALCULATOR_MIME } from '../../constants/graphCalculatorDefaults'
import { useAddToolToBoard } from '../../composables/useAddToolToBoard'
import { useTouchDragFromTray } from '../../composables/useTouchDragFromTray'

const { t } = useI18n()
const addToolToBoard = useAddToolToBoard()
const { dragHandlers } = useTouchDragFromTray()

function onDragStart(e: DragEvent): void {
  if (!e.dataTransfer) return
  // UX-RULE-4: drop handler is pure — payload deliberately empty (no params,
  // no expressions). Drop builds DEFAULT_GRAPH_STATE asset.
  e.dataTransfer.setData(GRAPH_CALCULATOR_MIME, JSON.stringify({}))
  e.dataTransfer.effectAllowed = 'copy'
}
</script>

<style scoped>
.gc-tray {
  border-top: 1px solid #e5e7eb;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.gc-tray__header {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.gc-tray__card-wrap {
  position: relative;
}

.gc-tray__card-wrap .gc-tray__btn {
  width: 100%;
}

.gc-tray__btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #f8fafc;
  cursor: grab;
  user-select: none;
  touch-action: pan-y;
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
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

.gc-tray__card-wrap:hover .tray-add-btn {
  opacity: 1;
  pointer-events: auto;
}

.tray-add-btn:hover {
  background: #ede9fe;
  border-color: #818cf8;
  color: #4338ca;
}

.gc-tray__btn:hover {
  background: #e2e8f0;
  border-color: #94a3b8;
}

.gc-tray__btn:active {
  cursor: grabbing;
}

.gc-tray__icon {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  font-weight: 700;
  color: #3b7b9b;
  font-style: italic;
  width: 32px;
  text-align: center;
}

.gc-tray__label {
  font-size: 12px;
  color: #1e293b;
  line-height: 1.2;
}

/* ── Touch / coarse pointer ── */
@media (any-pointer: coarse) {
  /* FIX Android repaint: position:static flex-sibling замість position:absolute */
  .gc-tray__card-wrap {
    display: flex;
    align-items: stretch;
    gap: 2px;
  }
  .gc-tray__card-wrap .gc-tray__btn {
    flex: 1;
    min-width: 0;
  }
  .tray-add-btn {
    position: static;
    opacity: 1;
    pointer-events: auto;
    width: 36px;
    height: auto;
    flex-shrink: 0;
    font-size: 20px;
    border-radius: 6px;
    z-index: auto;
  }

  .gc-tray__btn {
    font-size: 13px;
    min-height: 44px;
    padding: 10px 12px;
  }

  .gc-tray__label {
    font-size: 13px;
  }
}
</style>
