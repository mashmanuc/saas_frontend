<!--
  Phase G — graph_calculator drag source tray.

  Per OPS_SYNC_SSOT.md INV-21 + UX-RULE-3:
    - Tray ONLY initiates drag з MIME 'application/x-graph-calculator'.
    - NO state generation — DEFAULT_GRAPH_STATE hydrates у drop handler.
    - NO boardStore/ops awareness — pure presentational drag source.
-->
<template>
  <div class="gc-tray" data-testid="graph-calculator-tray">
    <div class="gc-tray__header">Інтерактивні</div>
    <button
      type="button"
      class="gc-tray__btn"
      data-testid="graph-calculator-tray-btn"
      :draggable="true"
      title="Графічний калькулятор"
      @dragstart="onDragStart"
    >
      <span class="gc-tray__icon">f(x)</span>
      <span class="gc-tray__label">Графічний калькулятор</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { GRAPH_CALCULATOR_MIME } from '../../constants/graphCalculatorDefaults'

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
  transition: background 0.12s, border-color 0.12s;
  text-align: left;
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
</style>
